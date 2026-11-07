# Origami Zen: плашка «Подписаться»

6 с, 1920×1080, 60 fps. Плашка складывается из бумаги, курсор нажимает Subscribe (кнопка становится «✓ Subscribed»), затем колокольчик: он качается, окрашивается, вылетают лепестки сакуры. В конце плашка складывается обратно.

Звук синтезируется в `sfx.py`: шорох бумаги при раскрытии, щелчки мыши, мягкий щипок струны на «Subscribed», колокольчик с перезвоном лепестков и шорох при складывании. Звуки кнопки и колокольчика сдвинуты в правый канал, туда же, где они на экране.

- `out/origami-zen-subscribe_alpha.webm`: прозрачный фон, VP9 с альфой и Opus, 1,3 МБ (браузер, OBS, CapCut, Premiere)
- `out/origami-zen-subscribe_alpha.mov`: прозрачный фон, ProRes 4444 и PCM, ~85 МБ (DaVinci, Premiere, Final Cut, After Effects). В git не попадает, создаётся при рендере
- `out/origami-zen-subscribe_green.mp4`: на хромакее #00FF00, H.264 и AAC

Пересобрать (нужны Playwright, ffmpeg и numpy):

```bash
NODE_PATH=$(npm root -g) node render.mjs
```

Тайминги и цвета задаются в `plate.html` (объект `T` и `:root`). Аватар взят из обложки канала (`assets/avatar.jpg`).
