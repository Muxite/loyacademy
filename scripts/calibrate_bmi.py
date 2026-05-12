# -*- coding: utf-8 -*-
# BMI disc height-scale calibration fitter.
import math, sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# Raw calibration points: (height_cm, disc_angle_deg from debug overlay)
# 205/95 share the same physical mark (-201.5 deg) -- full-circle log scale.
# Heights 130-195 were recorded after the disc wrapped past 0, so their
# angles appear near 0 or slightly negative but are really ~-360 further.
raw = [
    ( 95, -201.5),   # start of scale (same mark as 205)
    (100, -225.3),
    (110, -269.7),
    (130,   11.9),   # wrapped: real = 11.9 - 360 = -348.1
    (135,   -5.8),   # wrapped: real = -5.8 - 360 = -365.8
    (145,  -38.8),   # wrapped
    (155,  -70.6),   # wrapped
    (165,  -99.5),   # wrapped
    (175, -127.2),   # wrapped
    (185, -153.4),   # wrapped
    (195, -177.8),   # wrapped
    (205, -201.5),   # end of scale: real = -201.5 - 360 = -561.5
]

WRAP_FROM_HEIGHT = 130   # heights >= this need -360 applied

def make_continuous(pts):
    result = []
    for h, a in pts:
        if h == 205:
            result.append((h, -201.5 - 360.0))
        elif h >= WRAP_FROM_HEIGHT:
            result.append((h, a - 360.0))
        else:
            result.append((h, a))
    return sorted(result)

data = make_continuous(raw)

print("Continuous calibration points:")
print(f"  {'height':>8}  {'angle':>10}  {'ln(h)':>10}")
for h, a in data:
    print(f"  {h:8.1f}  {a:10.2f}  {math.log(h):10.5f}")

# Log-scale fit: angle = A + B * ln(height)
heights = np.array([h for h, _ in data])
angles  = np.array([a for _, a in data])
lnH     = np.log(heights)

B, A = np.polyfit(lnH, angles, 1)

print(f"\nLog-scale fit:  angle = {A:.4f} + {B:.4f} * ln(height)")
print(f"  degrees per ln-unit (B) : {B:.4f}")
span = B * (math.log(205) - math.log(95))
print(f"  total span 95->205      : {span:.2f} deg  (expect -360)")

# Residuals
predicted = A + B * lnH
residuals = angles - predicted
print(f"\nResiduals (measured - predicted):")
for (h, a), p, r in zip(data, predicted, residuals):
    print(f"  h={h:5.1f}  meas={a:8.2f}  pred={p:8.2f}  resid={r:+.3f} deg")

rms = math.sqrt(np.mean(residuals**2))
print(f"\nRMS residual: {rms:.4f} deg")

# Derived constants
LOG_RANGE = math.log(205) - math.log(95)
BOUNDARY  = A + B * math.log(95)   # angle when height=95 (fraction=0)

print(f"\n=== Derived constants for bmi.js ===")
print(f"  BOUNDARY_ROTATION = {BOUNDARY:.4f}")
print(f"  Span 95->205      = {B * LOG_RANGE:.4f} deg")
print(f"  Scale direction   : angle DECREASES as height increases")
print(f"\n  rotationToHeight(angle):")
print(f"    fraction = ((BOUNDARY - angle) % 360 + 360) % 360 / 360")
print(f"    height   = 95 * (205/95)^fraction")
print(f"\n  heightToRotation(height):")
print(f"    fraction = ln(height/95) / ln(205/95)")
print(f"    angle    = BOUNDARY - fraction * 360")

# Round-trip check
LOG_MIN = math.log(95)
BR = BOUNDARY

def rotationToHeight(angle):
    fraction = ((BR - angle) % 360 + 360) % 360 / 360
    return math.exp(LOG_MIN + fraction * LOG_RANGE)

def heightToRotation(height):
    h = max(95.0, min(205.0, float(height)))
    fraction = (math.log(h) - LOG_MIN) / LOG_RANGE
    return BR - fraction * 360

print(f"\n=== Round-trip verification ===")
for h, a in data:
    comp_angle = heightToRotation(h)
    rec_h      = rotationToHeight(a)
    print(f"  h={h:5.1f}  heightToRot={comp_angle:8.2f}  (measured {a:7.2f}  err={comp_angle-a:+.2f})  "
          f"rotToH({a:.1f})={rec_h:.2f}")

# Pointer offsets
pointers = {"male": -265.4, "unisex": -271.3, "female": -277.5}
print(f"\n=== Pointer offset analysis ===")
for name, pa in pointers.items():
    h = rotationToHeight(pa)
    print(f"  {name:7s} pointer at {pa:7.1f} deg  -> height {h:.1f} cm")
print(f"  unisex - male   = {pointers['unisex']-pointers['male']:+.1f} deg")
print(f"  unisex - female = {pointers['unisex']-pointers['female']:+.1f} deg")
