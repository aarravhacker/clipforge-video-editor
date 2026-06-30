const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const inputPath = __dirname + '\\test_video.mp4';
const outPath = __dirname + '\\frame_preview.jpg';
const frameNum = process.argv[2] || '60';
execFileSync(fp, ['-i', inputPath, '-vf', 'select=eq(n\\,' + frameNum + ')', '-vframes', '1', outPath, '-y'], {stdio: 'pipe'});
console.log('Done!');
