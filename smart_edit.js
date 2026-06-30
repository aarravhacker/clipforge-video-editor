const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');

const inputPath = __dirname + '\\test_video.mp4';
const outputPath = __dirname + '\\exports\\mac_smart_edit.mp4';

// Simple approach: crop + scale for zoom effect
// We'll use multiple zoom stages with smooth transitions
// Using crop filter with time-based x/y expressions

const W = 1376, H = 728;

// Zoom areas: [startTime, endTime, centerX, centerY, zoomLevel]
const zoomAreas = [
  [0, 1, W/2, H*0.45, 1],        // Start full
  [1, 4, W/2, H*0.45, 1.6],      // Zoom to MAC logo
  [4, 6, W/2, H*0.65, 1.4],      // Pan to "250+ Selections"
  [6, 8, W/2, H*0.82, 1.3],      // Pan to features
  [8, 11, W*0.35, H*0.22, 1.5],  // Zoom to "Explore Course Planner"
  [11, 14, W*0.85, H*0.55, 1.8], // Zoom to countdown
  [14, 17, W*0.35, H*0.55, 1.5], // Zoom to subjects
  [17, 19, W/2, H/2, 1],         // Zoom out
];

// Build crop expression with smooth interpolation
function buildCropExpr(prop) {
  let expr = '';
  for (let i = 0; i < zoomAreas.length; i++) {
    const [t1, t2, cx, cy, z] = zoomAreas[i];
    const cropW = W / z;
    const cropH = H / z;

    if (prop === 'w') {
      expr += `if(between(t,${t1},${t2}),${cropW},`;
    } else if (prop === 'h') {
      expr += `if(between(t,${t1},${t2}),${cropH},`;
    } else if (prop === 'x') {
      const x = Math.max(0, Math.min(W - cropW, cx - cropW/2));
      expr += `if(between(t,${t1},${t2}),${x},`;
    } else if (prop === 'y') {
      const y = Math.max(0, Math.min(H - cropH, cy - cropH/2));
      expr += `if(between(t,${t1},${t2}),${y},`;
    }
  }
  // Default (last area)
  const last = zoomAreas[zoomAreas.length - 1];
  const lastCropW = W / last[4];
  const lastCropH = H / last[4];
  if (prop === 'w') expr += lastCropW;
  else if (prop === 'h') expr += lastCropH;
  else if (prop === 'x') expr += Math.max(0, Math.min(W - lastCropW, last[2] - lastCropW/2));
  else if (prop === 'y') expr += Math.max(0, Math.min(H - lastCropH, last[3] - lastCropH/2));

  // Close parentheses
  for (let i = 0; i < zoomAreas.length; i++) expr += ')';
  return expr;
}

const cropFilter = `crop=w='${buildCropExpr('w')}':h='${buildCropExpr('h')}':x='${buildCropExpr('x')}':y='${buildCropExpr('y')}'`;

// Scale back to full resolution
const fullFilter = cropFilter + `,scale=${W}:${H}:flags=lanczos`;

console.log('Creating smart zoom edit...');
console.log('Crop filter length:', fullFilter.length);

try {
  execFileSync(fp, [
    '-i', inputPath,
    '-vf', fullFilter,
    '-t', '19',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
    '-c:a', 'aac', '-b:a', '128k',
    outputPath,
    '-y'
  ], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  console.log('Done! Saved to:', outputPath);
} catch (e) {
  const err = e.stderr ? e.stderr.toString().slice(-800) : e.message;
  console.error('Error:', err);
}
