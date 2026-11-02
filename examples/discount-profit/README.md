# Discount vs profit: motion infographic

A 15-second motion infographic, 1920×1080, 60 fps: 0–5 s the build-in and the data animation, 5–10 s the hold, 10–15 s the build-out.

- `index.html`: the scene. `window.seek(t)` paints frame t. Opened in a browser, it loops as a live preview.
- `render.mjs`: renders `discount-profit.mp4` frame by frame with headless Chromium and ffmpeg. It fetches Google Sans (OFL) into `fonts/` on the first run.

```bash
node render.mjs                 # discount-profit.mp4
node render.mjs --at 3,7,12     # stills/t*.png
```

Fonts: Google Sans Regular and Bold. Colours: `#FEE84E` `#FFFEEA` `#CEF1F9` `#235360` `#0AB8DE`.
