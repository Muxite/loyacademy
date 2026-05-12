# -*- coding: utf-8 -*-
# BMI disc weight-scale calibration fitter (static background ring).
import math, sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Raw data: (weight_kg, background_angle_deg)
# Note: "88.9 at 65" looks reversed vs the monotonic pattern -> 65 at 88.9
# Note: 110 at -172.7 is wrapped -> +360 = 187.3
raw = [
    ( 40,  -2.2),
    ( 45,  20.0),
    ( 50,  39.5),
    ( 55,  57.4),
    ( 60,  73.8),
    ( 65,  88.9),   # corrected from "88.9 at 65"
    ( 70, 102.4),
    ( 75, 115.7),
    ( 80, 127.3),
    ( 85, 138.8),
    ( 90, 149.6),
    ( 95, 160.0),
    (100, 169.4),
    (105, 178.5),
    (110, -172.7),  # wrapped: +360 = 187.3
]

def make_continuous(pts):
    result = []
    for w, a in pts:
        result.append((w, a + 360 if a < -90 else a))
    return sorted(result)

data = make_continuous(raw)

print("Continuous calibration points:")
print(f"  {'weight':>8}  {'angle':>10}  {'ln(w)':>10}")
for w, a in data:
    print(f"  {w:8.1f}  {a:10.2f}  {math.log(w):10.5f}")

# Log-scale fit: angle = A + B * ln(weight)
weights = np.array([w for w, _ in data])
angles  = np.array([a for _, a in data])
lnW     = np.log(weights)

B, A = np.polyfit(lnW, angles, 1)
print(f"\nLog-scale fit:  angle = {A:.4f} + {B:.4f} * ln(weight)")

predicted = A + B * lnW
residuals = angles - predicted
rms = math.sqrt(np.mean(residuals**2))

print(f"\nResiduals:")
for (w, a), p, r in zip(data, predicted, residuals):
    print(f"  w={w:5.1f}  meas={a:8.2f}  pred={p:8.2f}  resid={r:+.3f}")
print(f"\nRMS residual: {rms:.4f} deg")

# Derived span analysis
print(f"\n=== Scale analysis ===")
# degrees per ln-unit
deg_per_ln = B
print(f"  degrees per ln-unit: {deg_per_ln:.4f}")
print(f"  degrees per decade (ln->log10): {deg_per_ln * math.log(10):.4f}")

# Full-circle span (360 deg) corresponds to what weight ratio?
weight_ratio_per_360 = math.exp(360.0 / B)  # B is negative? Let's check
print(f"  weight ratio for 360 deg: {abs(weight_ratio_per_360):.4f}")

# Implied scale bounds (weight where angle = 0 and angle = 360)
w_at_zero  = math.exp(-A / B)
w_at_360   = math.exp((360 - A) / B)
print(f"  weight at angle=0:   {w_at_zero:.2f} kg")
print(f"  weight at angle=360: {w_at_360:.2f} kg")

# Compare with height scale degrees-per-ln-unit
height_B = -468.11  # from previous fit (negative = decreasing)
print(f"\n  Height scale B = {height_B:.2f} deg/ln-unit")
print(f"  Weight scale B = {B:.4f} deg/ln-unit")
print(f"  Ratio weight/height: {B/height_B:.4f}  (expect ~1 if same spacing)")

# Connection to turning-angle formula: 360/(ln(115)-ln(16.8))
implied_span_w = 360.0 / B
bmi_formula_span = math.log(115) - math.log(16.8)
bmi_degrees_per_ln = 360.0 / bmi_formula_span
print(f"\n  User's turning-angle formula: 360/ln(115/16.8) = {bmi_degrees_per_ln:.2f} deg/ln-unit")
print(f"  Weight scale fit:             {B:.4f} deg/ln-unit")
print(f"  Match: {abs(B - bmi_degrees_per_ln) < 1.0}")

# Zero-angle reference weight (weight at angle=0)
print(f"\n=== Derived constants for bmi.js ===")
WEIGHT_ZERO_ANGLE = A   # angle offset
WEIGHT_DEG_PER_LN = B   # degrees per ln-unit
print(f"  WEIGHT_ZERO_ANGLE = {WEIGHT_ZERO_ANGLE:.4f}  (A in: angle = A + B*ln(weight))")
print(f"  WEIGHT_DEG_PER_LN = {WEIGHT_DEG_PER_LN:.4f}  (B)")
print(f"\n  weightToAngle(w)  = {A:.2f} + {B:.4f} * ln(weight)")
print(f"  angleToWeight(a)  = exp((angle - {A:.2f}) / {B:.4f})")

# Verify
def weightToAngle(w): return A + B * math.log(w)
def angleToWeight(a): return math.exp((a - A) / B)

print(f"\n=== Round-trip verification ===")
for w, a in data:
    ca = weightToAngle(w)
    cw = angleToWeight(a)
    print(f"  w={w:5.1f}  wToA={ca:7.2f}  (meas {a:7.2f}  err={ca-a:+.2f})  aToW({a:.1f})={cw:.2f}")

# Turning angle: how does the weight scale relate to the turning-angle formula?
print(f"\n=== Turning angle formula check ===")
print(f"  User formula: 360*(ln25 - lnBMI2) / (ln115 - ln16.8)")
print(f"  = (360/ln(115/16.8)) * ln(25/BMI2)")
print(f"  = {bmi_degrees_per_ln:.2f} * ln(25/BMI2)")
print(f"  This is the angular distance on the weight/BMI2 scale from BMI2=25 to current BMI2.")
for bmi2, label in [(22.1,"22.1 (65kg/170cm/k=1.28)"), (20.47,"20.47 (65kg/173cm/k=1.24)")]:
    ta = 360*(math.log(25)-math.log(bmi2))/(math.log(115)-math.log(16.8))
    print(f"  BMI2={label}: turning_angle = {ta:.2f} deg")
