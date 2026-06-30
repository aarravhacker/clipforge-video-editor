const fp = require('ffmpeg-static');
const {execSync} = require('child_process');
const path = require('path');

const inputPath = process.argv[2];
const frameNum = process.argv[3] || 30;
const outPath = 'frame_preview.jpg';

const cmd = `"${fp}" -i "${inputPath}" -vf "select=eq(n\\,${frameNum})" -vframes 1 "${outPath}" -y`;
console.log('Running ffmpeg...');
try {
  execSync(cmd, { stdio: 'pipe', cwd: path.dirname(require.resolve('./package.json')) });
  console.log('Frame saved to', outPath);
} catch(e) {
  console.log('Error:', e.stderr ? e.stderr.toString().slice(-200) : e.message);
}
