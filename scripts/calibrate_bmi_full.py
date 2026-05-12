# -*- coding: utf-8 -*-
# Full BMI disc calibration: height scale, weight scale, BMI2 output scale.
# Also diagnoses the "165 aligns with 50 but reads 151.56" bug.
import math, sys
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

# === Known calibrated constants ===
LOG_MIN    = math.log(95)
LOG_RANGE  = math.log(205) - math.log(95)
BOUNDARY   = -201.26   # height scale: disc angle when height=95 is at pointer
WEIGHT_A   = -692.89
WEIGHT_B   =  187.24

def rotationToHeight(angle):
    f = ((BOUNDARY - angle) % 360 + 360) % 360 / 360
    return math.exp(LOG_MIN + f * LOG_RANGE)

def heightToRotation(h):
    h = max(95.0, min(205.0, float(h)))
    f = (math.log(h) - LOG_MIN) / LOG_RANGE
    return BOUNDARY - f * 360

def weightToAngle(w):
    return WEIGHT_A + WEIGHT_B * math.log(w)

# === Diagnose the bug: align 165 with 50 ===
print("=== Bug diagnosis: align 165cm with 50kg ===")
W, H = 50.0, 165.0
phi_W = weightToAngle(W)
print(f"  50kg is at background angle: {phi_W:.2f} deg")
print(f"  heightToRotation(165) = {heightToRotation(H):.2f} deg  (old: puts 165 at POINTER)")
print(f"  rotationToHeight at that angle = {rotationToHeight(heightToRotation(H)):.4f}  (should be 165)")

# When user physically aligns 165 with 50, the disc is at R_align where:
#   165_mark_worldangle = phi_W
#   165_mark_worldangle = alpha_165 + R_align
#   alpha_165 = theta_ref - heightToRotation(165)   [theta_ref = 0 from calibration]
theta_ref = 0.0
alpha_165 = theta_ref - heightToRotation(H)
R_align   = phi_W - alpha_165
print(f"\n  R_align (disc rotation when 165 aligns with 50): {R_align:.4f} deg")
print(f"  OLD rotationToHeight(R_align) = {rotationToHeight(R_align):.5f}  (expected 151.56, was WRONG)")

# Fix: when disc is at R, height aligned with weight W is:
# height = rotationToHeight(R - phi_W + theta_ref) = rotationToHeight(R - phi_W)
print(f"\n  NEW formula: rotationToHeight(R_align - phi_W) = rotationToHeight({R_align:.2f} - {phi_W:.2f})")
print(f"    = rotationToHeight({R_align - phi_W:.4f})")
print(f"    = {rotationToHeight(R_align - phi_W):.4f}  (should be 165.0)")

print(f"\n  NEW valuesToRotation(h=165, w=50):")
R_new = heightToRotation(H) + phi_W
print(f"    = heightToRotation(165) + weightToAngle(50)")
print(f"    = {heightToRotation(H):.4f} + {phi_W:.4f} = {R_new:.4f} deg")
print(f"  Verify: rotationToHeight({R_new:.2f} - {phi_W:.2f}) = {rotationToHeight(R_new - phi_W):.4f}")

# === Verify for several weight/height combinations ===
print("\n=== Round-trip verification (h, w) -> R -> h_recovered ===")
test_cases = [(165,50),(170,65),(155,60),(180,80),(125,45)]
for H, W in test_cases:
    phi_w = weightToAngle(W)
    R = heightToRotation(H) + phi_w
    h_rec = rotationToHeight(R - phi_w)
    bmi2  = 1.28 * W / (H/100)**2.5
    print(f"  h={H}, w={W}:  R={R:.2f}  h_recovered={h_rec:.3f}  BMI2={bmi2:.2f}")

# === BMI2 output scale fit ===
print("\n=== BMI2 output scale fit ===")
bmi2_raw = [
    (17, -73.4), (18, -62.9), (20, -43.2), (22, -25.4), (24, -9.1),
    (26, 6.0),   (28, 19.8),  (30, 32.9),  (32, 44.7),  (34, 56.1),
    (36, 66.9),  (38, 77.1),  (40, 86.6),
]
bmi2s  = np.array([b for b,_ in bmi2_raw])
angles = np.array([a for _,a in bmi2_raw])
lnB    = np.log(bmi2s)
B_b2, A_b2 = np.polyfit(lnB, angles, 1)
pred   = A_b2 + B_b2 * lnB
resid  = angles - pred
rms    = math.sqrt(np.mean(resid**2))
print(f"  Fit: angle = {A_b2:.4f} + {B_b2:.4f} * ln(BMI2)")
print(f"  degrees/ln-unit: {B_b2:.4f}  (weight scale: {WEIGHT_B:.4f})")
print(f"  RMS residual: {rms:.4f} deg")
print(f"\n  Residuals:")
for (b,a), p, r in zip(bmi2_raw, pred, resid):
    print(f"    bmi2={b:4.0f}  meas={a:7.1f}  pred={p:7.2f}  resid={r:+.3f}")

# === What disc rotation aligns h=165 with w=50, and what BMI2 is shown? ===
H, W, k = 165.0, 50.0, 1.28
phi_w = weightToAngle(W)
R = heightToRotation(H) + phi_w
bmi2_expected = k * W / (H/100)**2.5
R_bmi2 = A_b2 + B_b2 * math.log(bmi2_expected)
R_mod  = R % 360  # visual equivalent
R_bmi2_mod = R_bmi2 % 360

print(f"\n=== Alignment check: h={H}, w={W}, k={k} ===")
print(f"  Expected BMI2: {bmi2_expected:.4f}")
print(f"  Disc rotation for alignment: {R:.4f} deg  (mod360: {R_mod:.2f})")
print(f"  Disc rotation when BMI2={bmi2_expected:.2f} is at pointer: {R_bmi2:.4f} (mod360: {R_bmi2_mod:.2f})")
print(f"  Match (both mod 360): {abs(R_mod - R_bmi2_mod) < 1.0 or abs(abs(R_mod-R_bmi2_mod)-360) < 1.0}")

# === Derive pointer world angle from BMI2 scale ===
# When disc at R_bmi2, BMI2=bmi2_expected mark is at pointer.
# theta_unisex = alpha_bmi2 + R_bmi2
# alpha_bmi2 = theta_unisex - R_bmi2  (fixed on disc)
# If we assume pointer is same for BMI2 and height reference: theta_unisex = theta_ref = 0
# Then: alpha_bmi2_X = -R_bmi2_X  (position of bmi2_X mark on disc = -disc_rotation_for_that_bmi2)
print(f"\n=== Consistency check: BMI2 pointer angle ===")
# The pointer for BMI2 reading should be at the same world angle as the alignment
# theta_unisex (background) = alpha_bmi2_X + R_bmi2_X = constant
# From calibration: theta_unisex = angle_data - A_b2 - B_b2*ln(bmi2) + A_b2 + B_b2*ln(bmi2)...
# Actually theta_unisex = R_bmi2 + alpha_bmi2, but alpha_bmi2 = -R_bmi2 if pointer at 0.
# So theta_unisex = 0 (if pointer at 0).
# Let's verify: at disc R, both h aligns with w AND bmi2 is shown at pointer.
# This works if R_bmi2(bmi2) = R_align(h,w) mod 360  ← our earlier check
for H, W, k in [(165,50,1.28),(170,65,1.28),(155,60,1.24),(180,80,1.32)]:
    phi_w = weightToAngle(W)
    R_align  = heightToRotation(H) + phi_w
    bmi2_exp = k * W / (H/100)**2.5
    R_bmi2   = A_b2 + B_b2 * math.log(bmi2_exp)
    diff_mod = (R_align - R_bmi2) % 360
    if diff_mod > 180: diff_mod -= 360
    print(f"  h={H:3d} w={W:3d} k={k}  BMI2={bmi2_exp:.2f}  R_align={R_align:.2f}  R_bmi2={R_bmi2:.2f}  diff_mod={diff_mod:.2f} deg")
