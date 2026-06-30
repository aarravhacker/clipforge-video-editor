const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const inputPath = __dirname + '\\test_video.mp4';

// Extract frames every 2 seconds to analyze
for (let i = 0; i < 10; i++) {
  const time = i * 2;
  const outPath = __dirname + '\\frames\\frame_' + (i * 2) + 's.jpg';
  try {
    execFileSync(fp, ['-i', inputPath, '-ss', String(time), '-vframes', '1', outPath, '-y'], {stdio: 'pipe'});
  } catch(e) {}
}
console.log('Frames extracted!');
