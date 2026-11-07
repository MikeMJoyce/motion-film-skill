# Origami Zen: плашка «Подписаться»

6 с, 1920×1080, 60 fps. Плашка складывается из бумаги, курсор нажимает Subscribe (кнопка становится «✓ Subscribed»), затем колокольчик: он качается, окрашивается, вылетают лепестки сакуры. В конце плашка складывается обратно.

- `out/origami-zen-subscribe_green.mp4`: на хромакее #00FF00
- `out/origami-zen-subscribe_alpha.mov`: ProRes 4444 с альфа-каналом, кеинг не нужен (в git не попадает, создаётся при рендере)

Пересобрать (нужны Playwright и ffmpeg):

```bash
NODE_PATH=$(npm root -g) node render.mjs
```

Тайминги и цвета задаются в `plate.html` (объект `T` и `:root`). Аватар взят из обложки канала (`assets/avatar.jpg`).
