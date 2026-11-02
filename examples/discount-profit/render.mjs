// Render index.html to MP4, frame by frame (window.seek(t) paints frame t).
// usage: node render.mjs [--fps 60] [--at 1.2,4.9] [--out discount-profit.mp4]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)('playwright');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const fps = Number(arg('--fps', 60));
const at = arg('--at');
const out = join(here, arg('--out', 'discount-profit.mp4'));

// Google Sans (OFL) from Google Fonts, fetched once
const fonts = {
  'GoogleSans-Regular.ttf': 'https://fonts.gstatic.com/s/googlesans/v76/4Ua_rENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iqcsih3SAyH6cAwhX9RFD48TE63OOYKtrwEIKli.ttf',
  'GoogleSans-Bold.ttf': 'https://fonts.gstatic.com/s/googlesans/v76/4Ua_rENHsxJlGDuGo1OIlJfC6l_24rlCK1Yo_Iqcsih3SAyH6cAwhX9RFD48TE63OOYKtrzjJ6li.ttf',
};
mkdirSync(join(here, 'fonts'), { recursive: true });
for (const [name, url] of Object.entries(fonts)) {
  const p = join(here, 'fonts', name);
  if (!existsSync(p)) writeFileSync(p, Buffer.from(await (await fetch(url)).arrayBuffer()));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(join(here, 'index.html')).href);
await page.waitForFunction(() => window.READY === true);

if (at) {
  mkdirSync(join(here, 'stills'), { recursive: true });
  for (const t of at.split(',').map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await page.screenshot({ path: join(here, 'stills', `t${t.toFixed(2)}.png`) });
  }
} else {
  const total = Math.round(15 * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.seek(t), i / fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % fps === 0) process.stdout.write(`\r${(i / fps).toFixed(0)}s / 15s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(`\nwrote ${out}`);
}
await browser.close();
