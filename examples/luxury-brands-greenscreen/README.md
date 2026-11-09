# Luxury Brands — greenscreen title (4 s)

"Luxury Brands" in Google Sans Bold, 1920×1080, 60 fps, 4.0 s.

| Time | What happens |
|---|---|
| 0.0–1.3 s | Letters rise one by one out of a blur in polished gold; gold dust gathers to the word; a light band sweeps across |
| 1.3–1.95 s | The word glows and breathes, sparkles twinkle, a second shimmer passes |
| 2.0 s | A glint: anamorphic streak, star flare and a white flash on the word, the frame jolts |
| 2.0–2.5 s | Cracks run out from the hit, the gold drains to dull grime-grey, the glow dies, the dust falls as ash |
| 2.5–4.0 s | Cracked and dull; two chips break off and fall; the word sinks slightly |

## Files
- `out/luxury_brands_green.mp4` — H.264 on pure green `#00FF00` for chroma key.
- `out/luxury_brands_alpha.webm` — VP9 with a real alpha channel (no keying).
- `out/luxury_brands_alpha.mov` — ProRes 4444 with alpha; not committed (≈300 MB), made by `render.mjs`.

## Re-render
```bash
node render.mjs                 # all three files, ~2.5 min
node render.mjs --fps 25        # another frame rate
node render.mjs --at 1.7,2.3    # stills on green into out/stills/
```
Timing lives at the top of `index.html` (`T_HIT` is the moment of the glint). Font: Google Sans (SIL OFL, Google Fonts).
