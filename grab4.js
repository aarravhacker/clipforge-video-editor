const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const inputPath = __dirname + '\\exports\\mac_smart_edit.mp4';
const outPath = __dirname + '\\frame_smart.jpg';
const time = process.argv[2] || '3';
execFileSync(fp, ['-ss', time, '-i', inputPath, '-vframes', '1', outPath, '-y'], {stdio: 'pipe'});
console.log('Done!');
