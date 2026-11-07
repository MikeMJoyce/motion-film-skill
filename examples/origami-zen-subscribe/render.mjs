// Render plate.html frame by frame (transparent PNGs), then encode:
//   out/origami-zen-subscribe_green.mp4   — 1920x1080 60 fps on #00FF00 (chroma key)
//   out/origami-zen-subscribe_alpha.mov   — ProRes 4444 with a real alpha channel + PCM audio
//   out/origami-zen-subscribe_alpha.webm  — VP9 with alpha + Opus audio (small)
// Sound comes from sfx.py (out/sfx.wav).
// Usage: node render.mjs [--fps 60] [--at 2.2,3.4]   (--at: stills only, into out/stills)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const fps = +arg('--fps', 60), at = arg('--at');
const out = path.join(dir, 'out'), frames = path.join(out, 'frames');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(dir, 'plate.html')).href);
await page.evaluate(() => document.fonts.ready);
const shot = async (t, file) => { await page.evaluate(t => window.seek(t), t); await page.screenshot({ path: file, omitBackground: true }); };

if (at) {
  mkdirSync(path.join(out, 'stills'), { recursive: true });
  for (const t of at.split(',').map(Number)) await shot(t, path.join(out, 'stills', `t${t.toFixed(2)}.png`));
} else {
  rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
  const dur = await page.evaluate(() => window.DUR), n = Math.round(dur * fps);
  for (let i = 0; i < n; i++) await shot(i / fps, path.join(frames, `f${String(i).padStart(4, '0')}.png`));
  execFileSync('python3', [path.join(dir, 'sfx.py')], { stdio: 'inherit' });
  const src = ['-y', '-framerate', String(fps), '-i', path.join(frames, 'f%04d.png')];
  const sfx = ['-i', path.join(out, 'sfx.wav')];
  const ff = a => execFileSync('ffmpeg', ['-v', 'error', ...a]);
  // green screen, H.264 + AAC
  ff(['-f', 'lavfi', '-i', `color=c=0x00FF00:s=1920x1080:r=${fps}`, ...src, ...sfx,
    '-filter_complex', '[0][1]overlay=shortest=1,format=yuv420p[v]', '-map', '[v]', '-map', '2:a',
    '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-c:a', 'aac', '-b:a', '256k', '-shortest',
    '-movflags', '+faststart', path.join(out, 'origami-zen-subscribe_green.mp4')]);
  // real alpha for editors (DaVinci, Premiere, Final Cut, After Effects): ProRes 4444 + PCM
  ff([...src, ...sfx, '-map', '0:v', '-map', '1:a', '-c:v', 'prores_ks', '-profile:v', '4444',
    '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', '-c:a', 'pcm_s16le', '-shortest',
    path.join(out, 'origami-zen-subscribe_alpha.mov')]);
  // light real alpha: WebM VP9 + Opus (browsers, OBS, CapCut, Premiere)
  ff([...src, ...sfx, '-map', '0:v', '-map', '1:a', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0',
    '-crf', '22', '-row-mt', '1', '-auto-alt-ref', '0', '-c:a', 'libopus', '-b:a', '192k', '-shortest',
    path.join(out, 'origami-zen-subscribe_alpha.webm')]);
  console.log(`${n} frames -> out/`);
}
await browser.close();
