const fp = require('ffmpeg-static');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = __dirname;
const FRAMES_DIR = path.join(BASE, 'frames');
const PROCESSED_DIR = path.join(BASE, 'processed');
const SOURCE_DIR = path.join(path.dirname(BASE), 'custom upload');

[FRAMES_DIR, PROCESSED_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

function ff(args) {
  execFileSync(fp, args, { stdio: 'ignore', timeout: 60000 });
}

console.log('\n=== AI FRAME VIEWER ===\n');

// Step 1: Extract frames from each Sukuna image (create 30-frame clips with effects)
const images = fs.readdirSync(SOURCE_DIR)
  .filter(f => f.toLowerCase().includes('sukuna') && /\.(jpg|jpeg|png)$/i.test(f))
  .sort()
  .map(f => ({ name: f, path: path.join(SOURCE_DIR, f) }));

console.log('Found ' + images.length + ' Sukuna images\n');

// Process each image into frames with different effects
const effects = [
  { name: 'original', vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2' },
  { name: 'zoom_in',  vf: 'scale=3840:-1,zoompan=z=\'min(zoom+0.003,1.6)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=30:s=1920x1080:fps=30' },
  { name: 'glitch',   vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=saturation=2:contrast=1.4,rgbashift=rh=-8:bh=6' },
  { name: 'cinematic', vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=contrast=1.2:saturation=0.9,vignette=PI/4' },
  { name: 'bw',        vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,hue=s=0,eq=contrast=1.6' },
  { name: 'warm',      vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=brightness=0.08:saturation=1.5' },
  { name: 'noir',      vf: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,hue=s=0,eq=contrast=1.8:brightness=-0.05,curves=vintage' },
];

images.forEach((img, i) => {
  const effect = effects[i % effects.length];
  const outDir = path.join(FRAMES_DIR, 'image_' + String(i+1).padStart(2,'0') + '_' + effect.name);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log('[' + (i+1) + '/' + images.length + '] ' + img.name + ' -> ' + effect.name);

  // Extract 15 frames from the image clip
  try {
    ff([
      '-loop', '1', '-i', img.path,
      '-vf', effect.vf,
      '-t', '0.5',
      '-r', '30',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-preset', 'ultrafast', '-crf', '28',
      '-an',
      path.join(outDir, 'clip.mp4'), '-y'
    ]);

    // Extract individual frames
    ff([
      '-i', path.join(outDir, 'clip.mp4'),
      '-vf', 'fps=10',
      path.join(outDir, 'frame_%03d.jpg'), '-y'
    ]);

    const frames = fs.readdirSync(outDir).filter(f => f.endsWith('.jpg'));
    console.log('  -> ' + frames.length + ' frames extracted');
  } catch(e) {
    console.log('  -> FAILED: ' + e.message.slice(0, 60));
  }
});

// Also copy original images to processed folder for reference
console.log('\nCopying originals to processed/...');
images.forEach((img, i) => {
  const dest = path.join(PROCESSED_DIR, String(i+1).padStart(2,'0') + '_' + img.name);
  fs.copyFileSync(img.path, dest);
  console.log('  ' + img.name);
});

console.log('\n=== FRAME VIEWER COMPLETE ===');
console.log('Frames: ' + FRAMES_DIR);
console.log('Processed: ' + PROCESSED_DIR);
