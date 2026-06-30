const fp = require('ffmpeg-static');
const { execFileSync } = require('child_process');
const path = require('path');

const imgDir = path.join(__dirname, 'custom upload');
const outputPath = path.join(__dirname, 'exports', 'sukuna_simple.mp4');

const images = [
  'sukuna-wallpaper.jpg',
  'sukuna-wallpaper1.jpg',
  'sukuna-wallpaper2.jpg',
  'sukuna-wallpaper3.jpg',
  'sukuna-wallpaper4.jpg',
  'sukuna-wallpaper5.jpg',
  'sukuna-wallpaper6.jpg',
];

const DUR = 3;

const args = [];
images.forEach((img) => {
  args.push('-loop', '1', '-t', String(DUR), '-i', path.join(imgDir, img));
});

const parts = [];
for (let i = 0; i < images.length; i++) {
  parts.push(`[${i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fade=t=in:st=0:d=0.4,fade=t=out:st=2.6:d=0.4[v${i}]`);
}

const concatInputs = images.map((_, i) => `[v${i}]`).join('');
parts.push(`${concatInputs}concat=n=${images.length}:v=1:a=0[out]`);

const fc = parts.join(';');

console.log('Test: simple concat...');
console.log('Filter:', fc);

try {
  execFileSync(fp, [
    ...args,
    '-filter_complex', fc,
    '-map', '[out]',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-an',
    outputPath,
    '-y'
  ], { stdio: 'pipe', maxBuffer: 100 * 1024 * 1024 });

  const stats = require('fs').statSync(outputPath);
  console.log('Done! Size:', (stats.size / 1048576).toFixed(1) + ' MB');
} catch (e) {
  const err = e.stderr ? e.stderr.toString().slice(-1500) : e.message;
  console.error('ERROR:', err);
}
