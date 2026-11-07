// Render a plate page (plate.html by default) frame by frame (transparent PNGs), then encode:
//   out/origami-zen-subscribe_green.mp4   — 1920x1080 60 fps on #00FF00 (chroma key)
//   out/origami-zen-subscribe_alpha.mov   — ProRes 4444 with a real alpha channel + PCM audio
//   out/origami-zen-subscribe_alpha.webm  — VP9 with alpha + Opus audio (small)
// Sound comes from sfx.py (out/sfx.wav).
// Usage: node render.mjs [page.html] [--name origami-zen-subscribe] [--formats green,mov,webm] [--mute]
//                        [--fps 60] [--at 2.2,3.4]   (--at: stills only, into out/stills)
//   Like plate, transparent WebM without sound:
//   node render.mjs like.html --name origami-zen-like --formats webm --mute
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('--fps', 60), at = arg('--at');
const pageFile = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'plate.html';
const name = arg('--name', 'origami-zen-subscribe'), formats = arg('--formats', 'green,mov,webm').split(',');
const mute = process.argv.includes('--mute');
const out = path.join(dir, 'out'), frames = path.join(out, 'frames');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(dir, pageFile)).href);
await page.evaluate(() => document.fonts.ready);
const shot = async (t, file) => { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: file, omitBackground: true }); };

if (at) {
  mkdirSync(path.join(out, 'stills'), { recursive: true });
  for (const t of at.split(',').map(Number)) await shot(t, path.join(out, 'stills', `t${t.toFixed(2)}.png`));
} else {
  rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
  const dur = await page.evaluate(() => window.DUR), n = Math.round(dur * fps);
  for (let i = 0; i < n; i++) await shot(i / fps, path.join(frames, `f${String(i).padStart(4, '0')}.png`));
  if (!mute) execFileSync('python3', [path.join(dir, 'sfx.py')], { stdio: 'inherit' });
  const src = ['-y', '-framerate', String(fps), '-i', path.join(frames, 'f%04d.png')];
  const sfx = mute ? [] : ['-i', path.join(out, 'sfx.wav')];
  // audio stream index `i` encoded with `codec`, or nothing when --mute
  const audio = (i, ...codec) => mute ? [] : ['-map', `${i}:a`, '-c:a', ...codec, '-shortest'];
  const ff = a => execFileSync('ffmpeg', ['-v', 'error', ...a]);
  // green screen, H.264 + AAC
  if (formats.includes('green')) ff(['-f', 'lavfi', '-i', `color=c=0x00FF00:s=1920x1080:r=${fps}`, ...src, ...sfx,
    '-filter_complex', '[0][1]overlay=shortest=1,format=yuv420p[v]', '-map', '[v]', ...audio(2, 'aac', '-b:a', '256k'),
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-movflags', '+faststart', path.join(out, `${name}_green.mp4`)]);
  // real alpha for editors (DaVinci, Premiere, Final Cut, After Effects): ProRes 4444 + PCM
  if (formats.includes('mov')) ff([...src, ...sfx, '-map', '0:v', ...audio(1, 'pcm_s16le'), '-c:v', 'prores_ks',
    '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', path.join(out, `${name}_alpha.mov`)]);
  // light real alpha: WebM VP9 + Opus (browsers, OBS, CapCut, Premiere)
  if (formats.includes('webm')) ff([...src, ...sfx, '-map', '0:v', ...audio(1, 'libopus', '-b:a', '192k'), '-c:v', 'libvpx-vp9',
    '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '22', '-row-mt', '1', '-auto-alt-ref', '0', path.join(out, `${name}_alpha.webm`)]);
  console.log(`${n} frames -> out/`);
}
await browser.close();
