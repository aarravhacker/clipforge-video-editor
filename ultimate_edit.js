const fp = require('ffmpeg-static');
const {execFileSync} = require('child_process');

const inputPath = __dirname + '\\test_video.mp4';
const outputPath = __dirname + '\\exports\\mac_ultimate_edit.mp4';
const W = 1376, H = 728;

// Smooth zoom keyframes with easing
// [startTime, endTime, cropCenterX, cropCenterY, zoomLevel, easingType]
const zoomAreas = [
  [0, 0.5, W/2, H/2, 1, 'linear'],
  [0.5, 3.5, W/2, H*0.45, 2.2, 'ease-in'],
  [3.5, 5.5, W/2, H*0.65, 1.8, 'ease-in-out'],
  [5.5, 7.5, W/2, H*0.85, 1.6, 'ease-in-out'],
  [7.5, 10, W*0.3, H*0.25, 2.5, 'ease-in'],
  [10, 13, W*0.3, H*0.55, 2.8, 'ease-in-out'],
  [13, 15.5, W*0.8, H*0.5, 3.0, 'ease-in'],
  [15.5, 17.5, W*0.3, H*0.5, 2.2, 'ease-in-out'],
  [17.5, 19, W/2, H/2, 1, 'ease-out'],
];

// Text animations with fade in/out
const textOverlays = [
  // Hero section
  { text: 'MAC', x: 'w/2-80', y: 'h/2-100', size: 80, color: 'gold', start: 0.8, end: 3.5, anim: 'fade' },
  { text: 'Mittal Academy of Commerce', x: 'w/2-200', y: 'h/2+10', size: 28, color: 'white', start: 1.0, end: 3.5, anim: 'slide_up' },
  { text: 'CA  |  CS  |  CMA  |  COMMERCE', x: 'w/2-180', y: 'h/2-40', size: 18, color: '#D4AF37', start: 1.2, end: 3.5, anim: 'fade' },
  
  // 250+ Selections
  { text: '250+ Selections This Year', x: 'w/2-150', y: 'h/2+20', size: 32, color: 'gold', start: 3.8, end: 5.5, anim: 'scale_in' },
  { text: 'Excellence in Commerce Education', x: 'w/2-180', y: 'h/2+60', size: 20, color: 'white', start: 4.0, end: 5.5, anim: 'fade' },
  
  // Features
  { text: 'ICAI Recognized', x: 'w*0.15', y: 'h*0.82', size: 18, color: '#D4AF37', start: 5.8, end: 7.5, anim: 'slide_up' },
  { text: '12+ Years Excellence', x: 'w*0.42', y: 'h*0.82', size: 18, color: '#D4AF37', start: 6.0, end: 7.5, anim: 'slide_up' },
  { text: '10,000+ Students Guided', x: 'w*0.68', y: 'h*0.82', size: 18, color: '#D4AF37', start: 6.2, end: 7.5, anim: 'slide_up' },
  
  // Course Planner
  { text: 'Explore Course Planner', x: 'w/2-150', y: 'h/2-30', size: 30, color: 'gold', start: 7.8, end: 10, anim: 'scale_in' },
  { text: 'Your Path to Success', x: 'w/2-120', y: 'h/2+10', size: 20, color: 'white', start: 8.0, end: 10, anim: 'fade' },
  
  // Online Live Classes
  { text: 'Online Live Classes', x: 'w/2-140', y: 'h*0.3', size: 28, color: 'gold', start: 10.3, end: 13, anim: 'slide_up' },
  { text: 'Coming Soon', x: 'w/2-80', y: 'h*0.45', size: 24, color: '#4ade80', start: 10.5, end: 13, anim: 'pulse' },
  
  // Countdown
  { text: 'Next CS Batch Starts In', x: 'w/2-130', y: 'h*0.35', size: 22, color: 'gold', start: 13.3, end: 15.5, anim: 'fade' },
  { text: 'Secure Your Seat Now', x: 'w/2-110', y: 'h*0.65', size: 18, color: 'white', start: 13.5, end: 15.5, anim: 'slide_up' },
  
  // Class 6th
  { text: 'Class 6th - All Subjects', x: 'w/2-150', y: 'h*0.3', size: 26, color: 'gold', start: 15.8, end: 17.5, anim: 'scale_in' },
  { text: 'Building Strong Foundations', x: 'w/2-140', y: 'h*0.45', size: 18, color: 'white', start: 16.0, end: 17.5, anim: 'fade' },
  
  // Outro
  { text: 'Mittal Academy of Commerce', x: 'w/2-180', y: 'h/2-20', size: 30, color: 'gold', start: 17.8, end: 19, anim: 'fade' },
  { text: 'Where Excellence Begins', x: 'w/2-130', y: 'h/2+20', size: 20, color: 'white', start: 18.0, end: 19, anim: 'slide_up' },
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

// Build text overlays with animations
function buildTextFilter(t) {
  const escaped = t.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
  let alpha = '';
  
  // Fade in/out animation
  if (t.anim === 'fade') {
    alpha = `:alpha='if(between(t,${t.start},${t.start+0.5}),min(1,(t-${t.start})*2),if(between(t,${t.end-0.5},${t.end}),max(0,(${t.end}-t)*2),1))'`;
  } else if (t.anim === 'slide_up') {
    alpha = `:alpha='if(between(t,${t.start},${t.start+0.5}),min(1,(t-${t.start})*2),if(between(t,${t.end-0.5},${t.end}),max(0,(${t.end}-t)*2),1))'`;
  } else if (t.anim === 'scale_in') {
    alpha = `:alpha='if(between(t,${t.start},${t.start+0.3}),min(1,(t-${t.start})*3.3),if(between(t,${t.end-0.3},${t.end}),max(0,(${t.end}-t)*3.3),1))'`;
  } else if (t.anim === 'pulse') {
    alpha = `:alpha='0.5+0.5*sin((t-${t.start})*6)'`;
  }
  
  return `drawtext=text='${escaped}':fontsize=${t.size}:fontcolor=${t.color}:x=${t.x}:y=${t.y}${alpha}:enable='between(t,${t.start},${t.end})':shadowcolor=black@0.8:shadowx=2:shadowy=2`;
}

// Combine all filters
const textFilters = textOverlays.map(buildTextFilter);
const allFilters = [scaledFilter].concat(textFilters);
const fullFilter = allFilters.join(',');

console.log('Creating ultimate edit with smooth zoom + text animations...');
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
