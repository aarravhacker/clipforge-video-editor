const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');
const frameNum = process.argv[2] || '60';
const inputPath = 'C:\\Users\\aarav\\Downloads\\padh le or\\video-editor\\custom upload\\Mittal Academy of Commerce - Scroll Story - Google Chrome 2026-06-18 20-04-37.mp4';
const outPath = 'frame_preview.jpg';
execFileSync(fp, ['-i', inputPath, '-vf', 'select=eq(n\\,' + frameNum + ')', '-vframes', '1', outPath, '-y']);
console.log('Done! Saved to', outPath);
