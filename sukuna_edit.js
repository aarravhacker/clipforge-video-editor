const fp = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, 'custom upload');
const EXPORT_DIR = path.join(__dirname, 'exports');
const TEMP_DIR = path.join(EXPORT_DIR, 'sukuna_temp');

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function ff(args) {
  var cmd = '"' + fp + '" ' + args.join(' ');
  console.log('  > ' + args.slice(0, 4).join(' ') + ' ...');
  execSync(cmd, { stdio: 'ignore', timeout: 120000, windowsHide: true });
}

// Collect sukuna images
const images = fs.readdirSync(UPLOAD_DIR)
  .filter(f => f.toLowerCase().includes('sukuna') && /\.(jpg|jpeg|png)$/i.test(f))
  .sort()
  .map(f => path.join(UPLOAD_DIR, f));

console.log('\n=== SUKUNA EPIC EDIT GENERATOR ===');
console.log('Found ' + images.length + ' images\n');

const W = 1920, H = 1080, FPS = 30;
const CLIP_DUR = 2.5;
const TRANS_DUR = 0.5;

// Per-image effect configs: [name, ffmpeg_filter]
const effectConfigs = [
  ['zoom_in',    "scale=8000:-1,zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=" + Math.round(CLIP_DUR*FPS) + ":s=" + W + "x" + H + ":fps=" + FPS],
  ['zoom_out',   "scale=8000:-1,zoompan=z='if(lte(on,1),1.5,max(1.001,zoom-0.002))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=" + Math.round(CLIP_DUR*FPS) + ":s=" + W + "x" + H + ":fps=" + FPS],
  ['pan_left',   "scale=8000:-1,zoompan=z='1.4':x='iw/2-(iw/zoom/2)+on*2':y='ih/2-(ih/zoom/2)':d=" + Math.round(CLIP_DUR*FPS) + ":s=" + W + "x" + H + ":fps=" + FPS],
  ['cinematic',  "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,curves=r='0/0 0.5/0.45 1/1',eq=contrast=1.15:saturation=0.9,vignette=PI/4"],
  ['glitch',     "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,eq=saturation=1.8:contrast=1.3,rgbashift=rh=-6:bh=4"],
  ['vhs',        "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,curves=vintage,noise=c0s=25:c0f=t,eq=contrast=1.2:saturation=0.8"],
  ['dramatic',   "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,eq=contrast=1.6:brightness=-0.05:saturation=1.4,vignette=PI/3"],
  ['neon',       "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,eq=saturation=2.5:contrast=1.8:brightness=0.1,edgedetect=low=0.1:high=0.3,negate"],
  ['warm_bloom', "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,gblur=sigma=2,eq=brightness=0.1:saturation=1.4,unsharp=5:5:1.5"],
  ['bw',         "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,hue=s=0,eq=contrast=1.8:brightness=-0.03"],
  ['film_noir',  "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,hue=s=0,eq=contrast=1.6:brightness=-0.05,curves=vintage"],
  ['pop_art',    "scale=" + W + ":" + H + ":force_original_aspect_ratio=decrease,pad=" + W + ":" + H + ":(ow-iw)/2:(oh-ih)/2,eq=saturation=3:contrast=1.5"],
];

const transitions = [
  'fade', 'fadeblack', 'fadewhite',
  'wipeleft', 'wiperight', 'wipeup',
  'slideleft', 'slideright',
  'smoothleft', 'smoothright',
  'circleopen', 'circleclose',
  'zoomin', 'radial',
  'diagtl', 'diagbr',
  'dissolve', 'pixelize',
  'filmleft', 'filmright',
  'distance',
];

console.log('Phase 1: Creating individual clips with effects...\n');

const clipPaths = [];

images.forEach((img, i) => {
  const [name, vf] = effectConfigs[i % effectConfigs.length];
  const clipOut = path.join(TEMP_DIR, 'clip_' + String(i).padStart(2, '0') + '.mp4');

  try {
    ff([
      '-loop', '1', '-i', '"' + img + '"',
      '-vf', '"' + vf + '"',
      '-t', String(CLIP_DUR),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', String(FPS),
      '-preset', 'fast', '-crf', '18',
      '-an',
      '"' + clipOut + '"', '-y'
    ]);
    clipPaths.push(clipOut);
    console.log('  [' + (i+1) + '/' + images.length + '] ' + name + ' ✓');
  } catch (e) {
    console.log('  [' + (i+1) + '] FAILED: ' + name);
  }
});

console.log('\nPhase 2: Chaining xfade transitions (' + clipPaths.length + ' clips)...\n');

if (clipPaths.length < 2) {
  console.log('Not enough clips created. Aborting.');
  process.exit(1);
}

let currentClip = clipPaths[0];

for (let i = 1; i < clipPaths.length; i++) {
  const nextClip = clipPaths[i];
  const transType = transitions[(i - 1) % transitions.length];
  const offset = Math.max(0, CLIP_DUR - TRANS_DUR);
  const mergedOut = path.join(TEMP_DIR, 'merged_' + String(i).padStart(2, '0') + '.mp4');

  try {
    ff([
      '-i', '"' + currentClip + '"',
      '-i', '"' + nextClip + '"',
      '-filter_complex', '"' + '[0:v][1:v]xfade=transition=' + transType + ':duration=' + TRANS_DUR + ':offset=' + offset + '[v]' + '"',
      '-map', '"[v]"',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-preset', 'fast', '-crf', '18',
      '-an',
      '"' + mergedOut + '"', '-y'
    ]);
    console.log('  [' + i + '] ' + transType + ' ✓');
    currentClip = mergedOut;
  } catch (e) {
    console.log('  [' + i + '] ' + transType + ' failed, concat fallback...');
    const listFile = path.join(TEMP_DIR, 'list.txt');
    fs.writeFileSync(listFile, "file '" + currentClip + "'\nfile '" + nextClip + "'");
    try {
      ff([
        '-f', 'concat', '-safe', '0', '-i', '"' + listFile + '"',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        '-r', String(FPS), '-preset', 'fast', '-crf', '18',
        '-an',
        '"' + mergedOut + '"', '-y'
      ]);
      currentClip = mergedOut;
      console.log('  [' + i + '] concat fallback ✓');
    } catch (e2) {
      console.log('  [' + i + '] skipped');
    }
  }
}

console.log('\nPhase 3: Final polish (fade in/out, vignette, grain)...\n');

const totalDur = clipPaths.length * CLIP_DUR - (clipPaths.length - 1) * TRANS_DUR;
const polishedClip = path.join(TEMP_DIR, 'polished.mp4');

try {
  ff([
    '-i', '"' + currentClip + '"',
    '-vf', '"fade=t=in:st=0:d=0.8,fade=t=out:st=' + (totalDur - 1.2) + ':d=1.2,vignette=PI/5,noise=c0s=6:c0f=t"',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-preset', 'fast', '-crf', '18',
    '-an',
    '"' + polishedClip + '"', '-y'
  ]);
  currentClip = polishedClip;
  console.log('  Final polish applied ✓');
} catch (e) {
  console.log('  Polish skipped');
}

console.log('\nPhase 4: Generating beat-sync audio (' + Math.round(140) + ' BPM)...\n');

const audioPath = path.join(TEMP_DIR, 'beat.wav');

try {
  ff([
    '-f', 'lavfi', '-i', '"sine=frequency=55:duration=' + totalDur + '"',
    '-af', '"volume=0.35,apulsator=mode=sine:hz=2.33,highpass=f=30,lowpass=f=200,afade=t=in:st=0:d=0.5,afade=t=out:st=' + (totalDur - 1) + ':d=1"',
    '"' + audioPath + '"', '-y'
  ]);
  console.log('  Beat audio generated ✓');
} catch (e) {
  console.log('  Audio gen skipped: ' + e.message.slice(0, 60));
}

console.log('\nPhase 5: Final export...\n');

const finalOutput = path.join(EXPORT_DIR, 'SUKUNA_EPIC_EDIT.mp4');

try {
  if (fs.existsSync(audioPath)) {
    ff([
      '-i', '"' + currentClip + '"',
      '-i', '"' + audioPath + '"',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k',
      '-shortest',
      '"' + finalOutput + '"', '-y'
    ]);
  } else {
    ff([
      '-i', '"' + currentClip + '"',
      '-c:v', 'copy', '-an',
      '"' + finalOutput + '"', '-y'
    ]);
  }
  console.log('  Export complete ✓');
} catch (e) {
  console.log('  Export error, trying raw copy...');
  try {
    ff(['-i', '"' + currentClip + '"', '-c:v', 'copy', '-an', '"' + finalOutput + '"', '-y']);
  } catch (e2) {
    console.log('  FATAL: ' + e2.message.slice(0, 100));
    process.exit(1);
  }
}

// Cleanup
console.log('\nCleaning up temp files...');
try {
  fs.readdirSync(TEMP_DIR).forEach(f => {
    try { fs.unlinkSync(path.join(TEMP_DIR, f)); } catch(e) {}
  });
  fs.rmdirSync(TEMP_DIR);
} catch(e) {}

const stats = fs.statSync(finalOutput);
console.log('\n' + '='.repeat(50));
console.log('  SUKUNA EPIC EDIT COMPLETE!');
console.log('='.repeat(50));
console.log('  File:     ' + finalOutput);
console.log('  Size:     ' + (stats.size / 1048576).toFixed(1) + ' MB');
console.log('  Images:   ' + images.length);
console.log('  Effects:  zoom_in, zoom_out, pan_left, cinematic, glitch,');
console.log('            vhs, dramatic, neon, warm_bloom, bw, film_noir, pop_art');
console.log('  Trans:    ' + transitions.slice(0, 8).join(', ') + '...');
console.log('  Duration: ~' + totalDur.toFixed(1) + 's');
console.log('  Res:      ' + W + 'x' + H + ' @ ' + FPS + 'fps');
console.log('='.repeat(50) + '\n');
