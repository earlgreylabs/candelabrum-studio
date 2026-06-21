import os

size = 32
with open("assets/luts/cinematic.cube", "w") as f:
    f.write(f"TITLE \"Cinematic Teal Orange\"\n")
    f.write(f"LUT_3D_SIZE {size}\n")
    
    # Simple Teal/Orange logic
    for b in range(size):
        for g in range(size):
            for r in range(size):
                rn = r / (size - 1)
                gn = g / (size - 1)
                bn = b / (size - 1)
                
                # S-curve for contrast
                def scurve(x):
                    return x * x * (3.0 - 2.0 * x)
                
                rn = scurve(rn)
                gn = scurve(gn)
                bn = scurve(bn)
                
                # Push reds towards orange, push shadows/blues towards teal
                # Highlight warmth
                luma = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn
                
                # Orange push in mid-highs
                orange_r = rn + 0.1 * luma
                orange_g = gn + 0.05 * luma
                orange_b = bn - 0.05 * luma
                
                # Teal push in shadows
                teal_r = rn - 0.05 * (1-luma)
                teal_g = gn + 0.05 * (1-luma)
                teal_b = bn + 0.1 * (1-luma)
                
                # Blend based on luma
                out_r = (orange_r * luma) + (teal_r * (1-luma))
                out_g = (orange_g * luma) + (teal_g * (1-luma))
                out_b = (orange_b * luma) + (teal_b * (1-luma))
                
                # Clamp
                out_r = max(0.0, min(1.0, out_r))
                out_g = max(0.0, min(1.0, out_g))
                out_b = max(0.0, min(1.0, out_b))
                
                f.write(f"{out_r:.6f} {out_g:.6f} {out_b:.6f}\n")

print("Generated cinematic.cube")
