# Guide: Implementing Circular Slide Rules with Logarithmic Scales

Lessons learned from calibrating the BMI2 circular slide rule.

---

## 1. Understand the Physical Setup First

A circular slide rule typically has:

- **Rotating disc** — carries one or more scales (e.g. height, BMI2 output)
- **Static background** — carries one or more scales (e.g. weight) and fixed reference pointers

Before writing any code, answer these questions:

1. Which scales are on the disc vs the background?
2. Is there one pointer or multiple (e.g. male/female/unisex)?
3. Do the disc and background scales have the same log spacing, or different?
4. Does the scale run clockwise or counterclockwise as values increase?
5. Where is the start/end of each scale, and do they share a physical mark?

Getting these wrong at the start leads to all subsequent calibration being off.

---

## 2. Log Scale Formula

All log scales on circular slide rules follow:

```
angle = A + B * ln(value)
```

Equivalently:

```
value = exp((angle - A) / B)
```

The two parameters `A` (offset) and `B` (degrees per ln-unit) fully define the scale.
You only need **2 calibration points** to solve for both. Use **3+ points** to verify
and compute a residual — if RMS > ~0.5 degrees, something is wrong (wrap, wrong direction, etc.).

For a full-circle scale (value_min to value_max spans exactly 360 degrees):

```
B = 360 / ln(value_max / value_min)
```

This is a useful sanity check: fit B from your data and compare to this theoretical value.

---

## 3. Calibration Procedure

### Step 1 — Collect raw data

Use the debug overlay to record disc angle when each known mark is at the reference pointer.
Pick marks spread across the full range (not clustered).

Minimum: 2 points per scale. Recommended: 5+ points.

### Step 2 — Make angles continuous

The debug overlay reports cumulative rotation, which can wrap past ±360 degrees.
If you record data across a wrap boundary, some readings jump by ~360 degrees.

To detect wraps: sort points by value and check for angle jumps larger than expected.
Apply ±360 corrections until the sequence is monotonic.

```python
# Example: angles jump from -269.7 to +11.9 — apply -360 to all wrapped values
for h, a in raw:
    if a > wrap_threshold:
        a -= 360
```

### Step 3 — Fit the log model

```python
import numpy as np
lnV = np.log(values)
B, A = np.polyfit(lnV, angles, 1)
```

Check residuals for each point. Residuals > 0.5 degrees indicate a bad calibration point,
a wrap error, or the wrong model.

### Step 4 — Verify span

For a full-circle scale:

```python
span = B * (np.log(value_max) - np.log(value_min))
print(span)  # should be close to ±360
```

The sign tells you the direction: negative B means angle decreases as value increases
(clockwise on a standard CSS coordinate system).

---

## 4. Direction: The Most Common Mistake

CSS `transform: rotate(Xdeg)` rotates **clockwise** for positive X.

In `Math.atan2`, angles increase **counterclockwise**.

Many physical slide rules have scales that increase clockwise — meaning angle
**decreases** as value increases (negative B).

The symptom of getting the direction wrong: `rotationToValue` returns values that
decrease as you drag in the increasing direction.

The fix changes the modular arithmetic in the boundary formula:

```js
// Scale increases with angle (B > 0, counterclockwise):
fraction = ((angle - BOUNDARY) % 360 + 360) % 360 / 360

// Scale decreases with angle (B < 0, clockwise):
fraction = ((BOUNDARY - angle) % 360 + 360) % 360 / 360
```

And the inverse:

```js
// Increasing:
angle = BOUNDARY + fraction * 360

// Decreasing:
angle = BOUNDARY - fraction * 360
```

---

## 5. The Reference Pointer vs the Alignment Position

This is the subtlest and most important concept for multi-scale circular slide rules.

### The wrong mental model

> "When the disc is at angle R, read the value at R."

### The correct mental model

The disc carries marks at **fixed positions on the image**. The background carries marks
at **fixed positions on the background**. The reference pointer is a fixed mark on the background.

When you calibrate `rotationToValue(R)`, you are finding: **what value mark is currently
at the reference pointer's world angle**.

When you physically **align two marks** (e.g. height 165 with weight 50), neither mark
is necessarily at the reference pointer. The disc has rotated so that the height mark is
at the weight mark's position — a completely different angle.

### The consequence

If your code does:

```js
// WRONG for alignment-based reading
rotationToValues: (angleDeg) => ({ height: rotationToHeight(angleDeg) })
```

...it reads the height at the **pointer** when the disc is at `angleDeg`. But after the
user physically aligns height with weight, the height mark is at the **weight position**,
not the pointer. So the wrong height is returned.

### The correct formula

When disc is at rotation `R` and the weight mark for `W` is at background angle `phi_W`:

```
height_aligned_with_W = rotationToHeight(R - phi_W)
```

Derivation:
- Height mark H is at world angle: `alpha_H + R`  (alpha_H is fixed on the disc)
- At calibration: `alpha_H + heightToRotation(H) = theta_ref` (the pointer angle)
- So: `alpha_H = theta_ref - heightToRotation(H)`
- For alignment: `alpha_H + R = phi_W`
- Substituting: `theta_ref - heightToRotation(H) + R = phi_W`
- Therefore: `heightToRotation(H) = R - phi_W + theta_ref`
- If theta_ref = 0: `H = rotationToHeight(R - phi_W)`

The inverse (disc position to align H with W):

```
R = heightToRotation(H) + weightToAngle(W)
```

In code:

```js
rotationToValues: (angleDeg, cur) => {
  const phi = weightToAngle(cur?.weight ?? defaultWeight)
  return { height: rotationToHeight(angleDeg - phi) }
},
valuesToRotation: (values) => (
  heightToRotation(values.height) + weightToAngle(values.weight)
),
```

---

## 6. Scale Consistency Check

On a well-designed slide rule, the output scale and the input scales have the **same
degrees-per-ln-unit**. This is what makes the alignment produce a correct output reading.

For the BMI2 disc:

| Scale          | B (deg/ln-unit) |
|----------------|-----------------|
| Height disc    | -468.11         |
| Weight background | +187.24      |
| BMI2 output    | +187.18         |

The weight and BMI2 output scales are essentially identical in spacing (187.2 vs 187.2).
This is not a coincidence — it is required for the rule to work. At a fixed height, BMI2
is proportional to weight, so they must use the same log spacing.

If your output scale B does not match your input scale B, the disc is either:
- Mis-calibrated
- A different scale type than assumed
- Covering a different value range than assumed

---

## 7. Multiple Pointers (k-factor / gender)

Some discs have multiple reference pointers for different multipliers (e.g. k=1.24 male,
k=1.28 unisex, k=1.32 female on the BMI2 disc).

These pointers are at slightly different angular positions on the background. The angular
offset between pointers corresponds exactly to the log ratio of their k-factors:

```
delta_angle = B * ln(k1 / k2)
```

For BMI2: `187.24 * ln(1.32/1.24) = 187.24 * 0.0625 = 11.7 degrees` (spread over 3 pointers = ~5.9 deg each).

Measured: unisex−male = 5.9 deg, female−unisex = 6.2 deg. Matches.

This is a good consistency check: if your measured pointer offsets don't match
`B * ln(k_ratio)`, something is wrong with your B or your pointer measurements.

---

## 8. Debugging Checklist

| Symptom | Likely cause |
|---------|-------------|
| Values read backwards (increase when should decrease) | Wrong direction — flip BOUNDARY sign |
| Off by a fixed multiple of 360 | Wrap not corrected in calibration data |
| Good at one end, wrong at other | Wrong scale range (value_min or value_max) |
| Systematically off by a constant angle | BOUNDARY_ROTATION wrong |
| Works when typed, wrong when dragged | rotationToValues not accounting for weight mark offset (Section 5) |
| Works for one weight, wrong for others | Same as above — phi_W is weight-dependent |
| Pointer reads wrong k-factor | Pointer offset not matching B * ln(k_ratio) |
| RMS residual > 1 degree | Bad calibration point, wrong model, or wrap error |

---

## 9. Calibration Data Requirements

| Goal | Min points | Notes |
|------|-----------|-------|
| Determine A and B | 2 | Use widely separated values |
| Verify fit quality | 3 | RMS should be < 0.3 deg for a clean disc |
| Detect wrap errors | 4+ | Check monotonicity after sorting by value |
| Full calibration | 8-15 | One point per major labelled mark |

For the BMI2 project: 12 height points (RMS 0.18 deg), 15 weight points (RMS 0.14 deg),
13 BMI2 output points (RMS 0.09 deg). All confirmed log scales with consistent B values.

---

## 10. Python Script Template

```python
import math, numpy as np

raw = [
    (value1, angle1),
    (value2, angle2),
    # ...
]

# 1. Make continuous (fix wraps)
data = [(v, a - 360 if a > wrap_threshold else a) for v, a in raw]
data.sort()

# 2. Fit
values = np.array([v for v, _ in data])
angles = np.array([a for _, a in data])
B, A = np.polyfit(np.log(values), angles, 1)

# 3. Check span
span = B * (math.log(max(values)) - math.log(min(values)))
print(f"B={B:.4f}, A={A:.4f}, span={span:.2f} deg (expect ±360 for full-circle)")

# 4. Residuals
pred   = A + B * np.log(values)
resids = angles - pred
print(f"RMS = {math.sqrt(np.mean(resids**2)):.4f} deg")

# 5. Functions
def valueToAngle(v): return A + B * math.log(v)
def angleToValue(a): return math.exp((a - A) / B)

BOUNDARY = valueToAngle(value_min)  # angle where value=min is at pointer

def rotationToValue(angle):
    fraction = ((BOUNDARY - angle) % 360 + 360) % 360 / 360  # clockwise scale
    return value_min * (value_max / value_min) ** fraction

def valueToRotation(v):
    fraction = math.log(v / value_min) / math.log(value_max / value_min)
    return BOUNDARY - fraction * 360  # clockwise scale
```
