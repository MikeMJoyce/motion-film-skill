// node render.mjs [--fps 60] [--at 0.5,2.0,3.5]
// Renders transparent PNG frames from index.html (window.seek(t)), then encodes:
//   out/luxury_brands_green.mp4   H.264 on #00FF00 (chroma key)
//   out/luxury_brands_alpha.mov   ProRes 4444 with alpha (no keying needed)
//   out/luxury_brands_alpha.webm  VP9 with alpha (small)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('--fps', 60), DUR = 4, at = arg('--at');
const out = path.join(dir, 'out'), frames = path.join(out, 'frames');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + (at ? '?bg=green' : ''));
await page.waitForFunction(() => window.ready === true);
const shot = async (t, file) => {
  await page.evaluate(t => window.seek(t), t);
  await page.screenshot({ path: file, omitBackground: true });
};

if (at) {
  mkdirSync(path.join(out, 'stills'), { recursive: true });
  for (const t of at.split(',').map(Number)) await shot(t, path.join(out, 'stills', `t${t.toFixed(2)}.png`));
  await browser.close(); process.exit(0);
}

rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const N = DUR * FPS;
for (let i = 0; i < N; i++) {
  await shot(i / FPS, path.join(frames, `f${String(i).padStart(4, '0')}.png`));
  if (i % 30 === 0) process.stdout.write(`frame ${i}/${N}\r`);
}
await browser.close();

const inp = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png')];
const ff = (...a) => execFileSync('ffmpeg', a, { stdio: 'inherit' });
ff('-f', 'lavfi', '-i', `color=c=0x00ff00:s=1920x1080:r=${FPS}:d=${DUR}`, ...inp.slice(3),
  '-filter_complex', '[0][1]overlay=format=auto,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow',
  '-movflags', '+faststart', '-t', String(DUR), '-y', path.join(out, 'luxury_brands_green.mp4'));
ff(...inp, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', path.join(out, 'luxury_brands_alpha.mov'));
ff(...inp, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '24', '-row-mt', '1', path.join(out, 'luxury_brands_alpha.webm'));
console.log('\ndone →', out);
