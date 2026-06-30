const ffmpegPath = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');

const videoPath = process.argv[2] || 'exports/1827ca04-20db-459b-b5af-2416cca5501f_export.mp4';
const frameNum = process.argv[3] || 30;
const outPath = 'frame_preview.jpg';

const cmd = `"${ffmpegPath}" -i "${videoPath}" -vf "select=eq(n\\,${frameNum})" -vframes 1 "${outPath}" -y`;
console.log('Running:', cmd);
execSync(cmd, { stdio: 'inherit' });
console.log('Frame saved to', outPath);
