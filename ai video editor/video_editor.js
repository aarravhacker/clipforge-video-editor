const fp = require('ffmpeg-static');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE = __dirname;
const CLIPS_DIR = path.join(BASE, 'clips');
const EXPORTS_DIR = path.join(BASE, 'exports');
const SOURCE_DIR = path.join(path.dirname(BASE), 'custom upload');

[CLIPS_DIR, EXPORTS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

function ff(args) {
  execFileSync(fp, args, { stdio: 'ignore', timeout: 120000 });
}

function getDur(file) {
  try {
    const r = execFileSync(fp, ['-i', file], { stdio: 'pipe', timeout: 10000 }).toString();
    const m = r.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) return parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
  } catch(e) {
    const r = (e.stderr || e.stdout || '').toString();
    const m = r.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (m) return parseInt(m[1])*3600 + parseInt(m[2])*60 + parseFloat(m[3]);
  }
  return 2.5;
}

console.log('\n=== AI VIDEO EDITOR ===');
console.log('SUkUNA EPIC EDIT\n');

// Collect images
const images = fs.readdirSync(SOURCE_DIR)
  .filter(f => f.toLowerCase().includes('sukuna') && /\.(jpg|jpeg|png)$/i.test(f))
  .sort()
  .map(f => path.join(SOURCE_DIR, f));

console.log('Found ' + images.length + ' images\n');

const W = 1920, H = 1080, FPS = 30, CLIP_DUR = 2;

// ====== PHASE 1: Create clips ======
console.log('Phase 1: Creating clips with effects...\n');

const clipConfigs = [
  // [zoompan filter] or [scale+effect filter]
  { name: 'zoom_in',   vf: "scale=3840:-1,zoompan=z='min(zoom+0.003,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=60:s=1920x1080:fps=30" },
  { name: 'zoom_out',  vf: "scale=3840:-1,zoompan=z='if(lte(on,1),1.5,max(1.001,zoom-0.003))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=60:s=1920x1080:fps=30" },
  { name: 'pan_right', vf: "scale=3840:-1,zoompan=z='1.3':x='iw/4+on*3':y='ih/2-(ih/zoom/2)':d=60:s=1920x1080:fps=30" },
  { name: 'cinematic', vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=contrast=1.2:saturation=0.9,vignette=PI/4" },
  { name: 'glitch',    vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=saturation=2:contrast=1.3,rgbashift=rh=-8:bh=6" },
  { name: 'dramatic',  vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=contrast=1.5:saturation=1.3:brightness=-0.03,vignette=PI/3" },
  { name: 'neon',      vf: "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,eq=saturation=2.5:contrast=1.8,brightness=0.1,edgedetect=low=0.1:high=0.3,negate" },
];

const clipPaths = [];

images.forEach((img, i) => {
  const cfg = clipConfigs[i % clipConfigs.length];
  const out = path.join(CLIPS_DIR, 'clip_' + String(i).padStart(2,'0') + '.mp4');

  try {
    ff([
      '-loop', '1', '-i', img,
      '-vf', cfg.vf,
      '-t', String(CLIP_DUR),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-preset', 'ultrafast', '-crf', '20',
      '-an', out, '-y'
    ]);
    clipPaths.push(out);
    console.log('  [' + (i+1) + '/' + images.length + '] ' + cfg.name + ' OK');
  } catch(e) {
    // Fallback: simple scale + no effect
    try {
      ff([
        '-loop', '1', '-i', img,
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        '-t', String(CLIP_DUR),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), '-preset', 'ultrafast', '-crf', '20',
        '-an', out, '-y'
      ]);
      clipPaths.push(out);
      console.log('  [' + (i+1) + '/' + images.length + '] ' + cfg.name + ' (fallback) OK');
    } catch(e2) {
      console.log('  [' + (i+1) + '/' + images.length + '] FAILED');
    }
  }
});

if (clipPaths.length < 2) {
  console.log('Not enough clips. Exiting.');
  process.exit(1);
}

// ====== PHASE 2: Concat with xfade transitions ======
console.log('\nPhase 2: Adding transitions...\n');

const transitions = ['fade','fadeblack','wipeleft','wiperight','slideleft','smoothleft','circleopen','zoomin','dissolve','filmleft','radial'];

let current = clipPaths[0];

for (let i = 1; i < clipPaths.length; i++) {
  const next = clipPaths[i];
  const trans = transitions[(i-1) % transitions.length];
  const out = path.join(CLIPS_DIR, 'merged_' + String(i).padStart(2,'0') + '.mp4');
  const offset = Math.max(0, CLIP_DUR - 0.4);

  try {
    ff([
      '-i', current, '-i', next,
      '-filter_complex', '[0:v][1:v]xfade=transition=' + trans + ':duration=0.4:offset=' + offset + '[v]',
      '-map', '[v]',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-preset', 'ultrafast', '-crf', '20',
      '-an', out, '-y'
    ]);
    console.log('  [' + i + '] ' + trans + ' OK');
    current = out;
  } catch(e) {
    // Fallback: concat demuxer
    const list = path.join(CLIPS_DIR, 'list.txt');
    fs.writeFileSync(list, "file '" + current + "'\nfile '" + next + "'");
    try {
      ff([
        '-f', 'concat', '-safe', '0', '-i', list,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), '-preset', 'ultrafast', '-crf', '20',
        '-an', out, '-y'
      ]);
      current = out;
      console.log('  [' + i + '] concat OK');
    } catch(e2) {
      console.log('  [' + i + '] skipped');
    }
  }
}

// ====== PHASE 3: Final polish ======
console.log('\nPhase 3: Final polish...\n');

const totalDur = clipPaths.length * CLIP_DUR - (clipPaths.length - 1) * 0.4;
const polished = path.join(CLIPS_DIR, 'polished.mp4');

try {
  ff([
    '-i', current,
    '-vf', 'fade=t=in:st=0:d=0.5,fade=t=out:st=' + Math.max(0, totalDur - 1) + ':d=1,vignette=PI/5',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-preset', 'ultrafast', '-crf', '20',
    '-an', polished, '-y'
  ]);
  current = polished;
  console.log('  Fade + vignette applied');
} catch(e) {
  console.log('  Polish skipped');
}

// ====== PHASE 4: Audio ======
console.log('\nPhase 4: Generating beat audio...\n');

const audioPath = path.join(CLIPS_DIR, 'beat.wav');

try {
  ff([
    '-f', 'lavfi', '-i', 'sine=frequency=55:duration=' + totalDur,
    '-af', 'volume=0.3,apulsator=mode=sine:hz=2.33,highpass=f=30,lowpass=f=200,afade=t=in:st=0:d=0.3,afade=t=out:st=' + Math.max(0, totalDur - 0.8) + ':d=0.8',
    audioPath, '-y'
  ]);
  console.log('  Beat audio generated (140 BPM bass)');
} catch(e) {
  console.log('  Audio skipped');
}

// ====== PHASE 5: Final export ======
console.log('\nPhase 5: Final export...\n');

const finalOut = path.join(EXPORTS_DIR, 'SUKUNA_EPIC_EDIT.mp4');

try {
  if (fs.existsSync(audioPath)) {
    ff([
      '-i', current, '-i', audioPath,
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-shortest', finalOut, '-y'
    ]);
  } else {
    ff(['-i', current, '-c:v', 'copy', '-an', finalOut, '-y']);
  }
} catch(e) {
  ff(['-i', current, '-c:v', 'copy', '-an', finalOut, '-y']);
}

// Cleanup clips
console.log('\nCleaning up...');
fs.readdirSync(CLIPS_DIR).forEach(f => {
  try { fs.unlinkSync(path.join(CLIPS_DIR, f)); } catch(e) {}
});

const stats = fs.statSync(finalOut);
console.log('\n====================================');
console.log('  SUKUNA EDIT DONE!');
console.log('====================================');
console.log('  File: ' + finalOut);
console.log('  Size: ' + (stats.size / 1048576).toFixed(1) + ' MB');
console.log('  Duration: ~' + totalDur.toFixed(1) + 's');
console.log('  Images: ' + images.length);
console.log('  Resolution: 1920x1080 @ 30fps');
console.log('====================================\n');
