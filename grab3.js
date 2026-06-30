const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const inputPath = __dirname + '\\exports\\mac_smart_edit.mp4';
const outPath = __dirname + '\\frame_smart.jpg';
const frameNum = process.argv[2] || '30';
execFileSync(fp, ['-i', inputPath, '-vf', 'select=eq(n\\,' + frameNum + ')', '-vframes', '1', outPath, '-y'], {stdio: 'pipe'});
console.log('Done!');
