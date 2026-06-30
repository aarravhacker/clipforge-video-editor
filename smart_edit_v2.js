const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');

const inputPath = __dirname + '\\test_video.mp4';
const outputPath = __dirname + '\\exports\\mac_final_edit.mp4';
const W = 1376, H = 728;

// Zoom keyframes with STRONGER zoom + cursor follow
// [startTime, endTime, cropCenterX, cropCenterY, zoomLevel]
const zoomAreas = [
  [0, 0.5, W/2, H/2, 1],           // Start full
  [0.5, 3.5, W/2, H*0.45, 2.0],    // STRONG zoom to MAC logo
  [3.5, 5.5, W/2, H*0.65, 1.8],    // Pan down to "250+ Selections"
  [5.5, 7.5, W/2, H*0.85, 1.6],    // Pan to features row
  [7.5, 10, W*0.3, H*0.25, 2.2],   // STRONG zoom to "Explore Course Planner"
  [10, 13, W*0.3, H*0.55, 2.5],    // Zoom to "Online Live Classes"
  [13, 15.5, W*0.8, H*0.5, 2.8],   // STRONG zoom to countdown timer
  [15.5, 17.5, W*0.3, H*0.5, 2.0], // Zoom to subjects
  [17.5, 19, W/2, H/2, 1],         // Zoom out to full
];

function buildCropExpr(prop) {
  let expr = '';
  for (let i = 0; i < zoomAreas.length; i++) {
    const [t1, t2, cx, cy, z] = zoomAreas[i];
    const cropW = W / z;
    const cropH = H / z;
    let val;
    if (prop === 'w') val = cropW;
    else if (prop === 'h') val = cropH;
    else if (prop === 'x') val = Math.max(0, Math.min(W - cropW, cx - cropW/2));
    else if (prop === 'y') val = Math.max(0, Math.min(H - cropH, cy - cropH/2));
    expr += `if(between(t,${t1},${t2}),${val},`;
  }
  const last = zoomAreas[zoomAreas.length - 1];
  const lw = W / last[4], lh = H / last[4];
  if (prop === 'w') expr += lw;
  else if (prop === 'h') expr += lh;
  else if (prop === 'x') expr += Math.max(0, Math.min(W - lw, last[2] - lw/2));
  else if (prop === 'y') expr += Math.max(0, Math.min(H - lh, last[3] - lh/2));
  for (let i = 0; i < zoomAreas.length; i++) expr += ')';
  return expr;
}

const cropFilter = `crop=w='${buildCropExpr('w')}':h='${buildCropExpr('h')}':x='${buildCropExpr('x')}':y='${buildCropExpr('y')}'`;
const scaledFilter = cropFilter + `,scale=${W}:${H}:flags=lanczos`;

// Text overlays with timing
const textFilters = [
  "drawtext=text='MAC':fontsize=72:fontcolor=gold:x=(w-tw)/2:y=h/2-80:enable='between(t,0.8,3.5)':shadowcolor=black:shadowx=3:shadowy=3",
  "drawtext=text='Mittal Academy of Commerce':fontsize=28:fontcolor=white:x=(w-tw)/2:y=h/2+10:enable='between(t,1,3.5)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='250+ Selections This Year':fontsize=32:fontcolor=gold:x=(w-tw)/2:y=h/2+60:enable='between(t,3.8,5.5)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='ICAI Recognized | 12+ Years | 10K+ Students':fontsize=20:fontcolor=white:x=(w-tw)/2:y=h*0.85:enable='between(t,5.8,7.5)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='Explore Course Planner':fontsize=28:fontcolor=gold:x=(w-tw)/2:y=h/2-20:enable='between(t,7.8,10)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='Online Live Classes - Coming Soon':fontsize=26:fontcolor=white:x=(w-tw)/2:y=h/2-30:enable='between(t,10.3,13)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='Next CS Batch Starts In':fontsize=24:fontcolor=gold:x=(w-tw)/2:y=h*0.35:enable='between(t,13.3,15.5)':shadowcolor=black:shadowx=2:shadowy=2",
  "drawtext=text='Class 6th - All Subjects':fontsize=28:fontcolor=gold:x=(w-tw)/2:y=h*0.3:enable='between(t,15.8,17.5)':shadowcolor=black:shadowx=2:shadowy=2",
];

// Sticker emojis as text overlays
const stickerFilters = [
  "drawtext=text='🎓':fontsize=48:x=w*0.45:y=h*0.2:enable='between(t,0.8,3.5)'",
  "drawtext=text='🔥':fontsize=36:x=w*0.3:y=h*0.7:enable='between(t,3.8,5.5)'",
  "drawtext=text='⭐':fontsize=36:x=w*0.65:y=h*0.7:enable='between(t,5.8,7.5)'",
  "drawtext=text='🚀':fontsize=36:x=w*0.5:y=h*0.15:enable='between(t,7.8,10)'",
  "drawtext=text='💻':fontsize=36:x=w*0.4:y=h*0.2:enable='between(t,10.3,13)'",
  "drawtext=text='⏰':fontsize=36:x=w*0.35:y=h*0.25:enable='between(t,13.3,15.5)'",
  "drawtext=text='📚':fontsize=36:x=w*0.55:y=h*0.2:enable='between(t,15.8,17.5)'",
];

// Combine all filters
const allFilters = [scaledFilter].concat(textFilters).concat(stickerFilters);
const fullFilter = allFilters.join(',');

console.log('Creating final edit with zoom + text + stickers...');
console.log('Filter length:', fullFilter.length);

try {
  execFileSync(fp, [
    '-i', inputPath,
    '-vf', fullFilter,
    '-t', '19',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
    '-c:a', 'aac', '-b:a', '128k',
    outputPath,
    '-y'
  ], { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 });
  console.log('Done! Saved to:', outputPath);
} catch (e) {
  const err = e.stderr ? e.stderr.toString().slice(-1000) : e.message;
  console.error('Error:', err);
}
