const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PROXY_DIR = path.join(__dirname, 'proxies');
const EXPORT_DIR = path.join(__dirname, 'exports');
const STICKERS_DIR = path.join(__dirname, 'stickers');
const PRESETS_DIR = path.join(__dirname, 'presets');
const DATA_DIR = path.join(__dirname, 'data');

[UPLOAD_DIR, PROXY_DIR, EXPORT_DIR, DATA_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR); },
  filename: function (req, file, cb) { cb(null, uuidv4() + path.extname(file.originalname)); }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const projects = {};
const historyStack = {};

function saveProjects() {
  try {
    var out = {};
    Object.keys(projects).forEach(function (k) {
      var p = projects[k];
      out[k] = {
        id: p.id, originalName: p.originalName, originalPath: p.originalPath, proxyPath: p.proxyPath,
        duration: p.duration, width: p.width, height: p.height, fps: p.fps,
        hasAudio: p.hasAudio, size: p.size, timeline: p.timeline
      };
    });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(out, null, 2));
  } catch (e) { console.error('saveProjects error:', e.message); }
}

function loadProjects() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return;
    var data = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    Object.keys(data).forEach(function (k) {
      if (fs.existsSync(data[k].originalPath)) {
        projects[k] = data[k];
      }
    });
  } catch (e) { console.error('loadProjects error:', e.message); }
}

function pushHistory(projectId) {
  if (!historyStack[projectId]) historyStack[projectId] = [];
  var p = projects[projectId];
  if (p) {
    historyStack[projectId].push(JSON.parse(JSON.stringify(p.timeline)));
    if (historyStack[projectId].length > 100) historyStack[projectId].shift();
  }
}

loadProjects();

function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const vs = metadata.streams.find(s => s.codec_type === 'video');
      const aus = metadata.streams.find(s => s.codec_type === 'audio');
      resolve({
        duration: metadata.format.duration || 0,
        width: vs ? vs.width : 0,
        height: vs ? vs.height : 0,
        fps: vs ? eval(vs.r_frame_rate) : 30,
        hasAudio: !!aus,
        size: metadata.format.size || 0
      });
    });
  });
}

function generateProxy(inputPath, proxyPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath).videoCodec('libx264').audioCodec('aac').size('480x?')
      .outputOptions(['-preset', 'ultrafast', '-crf', '28'])
      .on('end', resolve).on('error', reject).save(proxyPath);
  });
}

function buildEffectFilter(e) {
  switch (e.type) {
    case 'brightness': return 'eq=brightness=' + e.value;
    case 'contrast': return 'eq=contrast=' + e.value;
    case 'saturation': return 'eq=saturation=' + e.value;
    case 'blur': return 'boxblur=' + e.value + ':' + e.value;
    case 'gblur': return 'gblur=sigma=' + (e.value || 10);
    case 'motionblur': return "convolution='0 1 0:1 1 1:0 1 0':mode=opencl";
    case 'lensblur': return 'lenscorrection=cx=0.5:cy=0.5:k1=' + (e.value || 0.5);
    case 'grayscale': return 'hue=s=0';
    case 'sepia': return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
    case 'vintage': return 'curves=vintage';
    case 'invert': return 'negate';
    case 'glitch': return 'rgbashift=rh=-8:bh=6:gs=-4,hue=H=2*PI*t';
    case 'vignette': return 'vignette=PI/4';
    case 'sharpen': return 'unsharp=5:5:' + (e.value || 1.5);
    case 'emboss': return "convolution='0 1 0:1 -4 1:0 1 0:0 1 0:1 -4 1:0 1 0'";
    case 'rgbsplit': return 'rgbashift=rh=-' + (e.value || 12) + ':gh=' + Math.round((e.value || 12) / 2) + ':bh=-' + Math.round((e.value || 12) / 3);
    case 'pixelate': return 'scale=iw/8:ih/8,scale=iw*8:ih*8:flags=neighbor';
    case 'mirror': return 'hflip';
    case 'flip': return 'vflip';
    case 'kaleidoscope': return 'hflip,vflip,hstack,vstack';
    case 'warm': return 'colorbalance=rs=0.1:gs=0.05:bs=-0.1';
    case 'cool': return 'colorbalance=rs=-0.1:gs=0:bs=0.1';
    case 'grain': return 'noise=c0s=' + (e.value || 20) + ':c0f=t';
    case 'neon': return 'edgedetect=low=0.1:high=0.4,negate';
    case 'chromakey': return 'chromakey=color=' + (e.color || '0x00FF00') + ':similarity=' + (e.similarity || 0.3) + ':blend=' + (e.blend || 0.1);
    case 'colorkey': return 'colorkey=color=' + (e.color || '0x00FF00') + ':similarity=' + (e.similarity || 0.3) + ':blend=' + (e.blend || 0.1);
    case 'lut_cinematic': return 'curves=r=\'0/0 0.5/0.45 1/1\':g=\'0/0 0.5/0.48 1/1\'';
    case 'lut_warm': return 'colortemperature=temperature=7500';
    case 'lut_cold': return 'colortemperature=temperature=4000';
    case 'lut_bw_high': return 'hue=s=0,eq=contrast=1.5:brightness=0.1';
    case 'lut_bleach': return 'eq=contrast=1.4:saturation=0.6:brightness=0.05';
    case 'lut_cross': return 'curves=vintage,eq=saturation=1.5';
    case 'reverse': return 'reverse';
    case 'solarize': return 'eq=solarize=128';
    case 'posterize': return 'posterize=3';
    case 'cartoon': return 'edgedetect=mode=thin,format=gbrp';
    case 'sketch': return 'edgedetect=mode=sketch,format=gray,eq=contrast=1.5';
    case 'charcoal': return 'edgedetect=mode=canny,format=gray,negate';
    case 'oil_painting': return 'noise=alls=20:allf=t+u,boxblur=3:3,unsharp=3:3:1';
    case 'watercolor': return 'gblur=sigma=2,noise=alls=10:allf=t,unsharp=5:5:1';
    case 'cinemascope': return 'crop=in_w:in_w*9/16';
    case 'fisheye': return 'lenscorrection=cx=0.5:cy=0.5:k1=-0.3';
    case 'barrel': return 'lenscorrection=cx=0.5:cy=0.5:k1=0.5';
    case 'vhs': return 'curves=vintage,noise=c0s=30:c0f=t';
    case 'film_8mm': return 'curves=vintage,noise=c0s=20:c0f=t,eq=contrast=1.3:saturation=0.7,vignette=PI/3';
    case 'dv_cam': return 'noise=c0s=15:c0f=t,eq=contrast=1.2:saturation=0.8';
    case 'film_grain_heavy': return 'noise=c0s=40:c0f=t,eq=contrast=1.1';
    case 'edge_detect': return 'edgedetect=low=0.1:high=0.4';
    case 'canny': return 'edgedetect=mode=canny';
    case 'pencil': return 'edgedetect=mode=sketch';
    case 'popart': return 'eq=saturation=3:contrast=1.5';
    case 'psychedelic': return 'hue=H=2*PI*t,saturation=3';
    case 'dream': return 'gblur=sigma=3,eq=brightness=0.08:saturation=1.3';
    case 'noir': return 'hue=s=0,eq=contrast=1.6:brightness=-0.05';
    case 'faded': return 'eq=contrast=0.85:brightness=0.08:saturation=0.6';
    case 'sharpen_high': return 'unsharp=7:7:2';
    case 'denoise': return 'hqdn3d=4:3:6:4.5';
    default: return null;
  }
}

function buildTransitionFilter(t, duration) {
  var validTypes = ['fade','fadeblack','fadewhite','fadegrays',
    'wipeleft','wiperight','wipeup','wipedown','wipedn',
    'slideleft','slideright','slideup','slidedown',
    'smoothleft','smoothright','smoothup','smoothdown',
    'circleopen','circleclose','circlecrop',
    'zoomin','squeezeh','squeezev','radial',
    'diagtl','diagtr','diagbl','diagbr',
    'hrslice','hlslice','vuslice','vdslice',
    'dissolve','pixelize','hblur','fftsmooth','halftone',
    'filmleft','filmright',
    'rectcrop','horzclose','horzopen','vertclose','vertopen','distance'];
  if (validTypes.indexOf(t.type) >= 0) return 'xfade=transition=' + t.type + ':duration=' + (t.duration || 1);
  return 'xfade=transition=fade:duration=' + (t.duration || 1);
}

// Upload
app.post('/api/upload', function (req, res) {
  upload.single('video')(req, res, async function (err) {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const file = req.file;
      const id = path.parse(file.filename).name;
      const proxyPath = path.join(PROXY_DIR, id + '_proxy.mp4');
      await generateProxy(file.path, proxyPath);
      const info = await getVideoInfo(file.path);
      projects[id] = {
        id, originalName: file.originalname, originalPath: file.path, proxyPath,
        duration: info.duration, width: info.width, height: info.height, fps: info.fps,
        hasAudio: info.hasAudio, size: info.size,
        timeline: {
          clips: [{ id: uuidv4(), start: 0, end: info.duration, effects: [], transitions: [], textOverlays: [], stickers: [], keyframes: [], speed: 1, reversed: false, track: 0 }],
          effects: [], textOverlays: [], stickers: [],
          audio: { volume: 1 }, watermark: null, zoom: null, speedRamp: null
        }
      };
      saveProjects();
      res.json({ success: true, project: projects[id] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

app.get('/api/projects', function (req, res) {
  res.json(Object.values(projects).map(p => ({ id: p.id, name: p.originalName, duration: p.duration, width: p.width, height: p.height, size: p.size })));
});

app.get('/api/project/:id', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.get('/api/project/:id/video', function (req, res) {
  var p = projects[req.params.id];
  if (!p || !fs.existsSync(p.proxyPath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(p.proxyPath);
});

app.get('/api/project/:id/original', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.sendFile(p.originalPath);
});

// Trim
app.post('/api/project/:id/trim', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
  if (clip) { clip.start = req.body.start; clip.end = req.body.end; }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Split at playhead
app.post('/api/project/:id/split', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var time = req.body.time;
  var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
  if (clip && time > clip.start && time < clip.end) {
    var newClip = JSON.parse(JSON.stringify(clip));
    newClip.id = uuidv4();
    newClip.start = time;
    clip.end = time;
    newClip.keyframes = [];
    newClip.stickers = [];
    var idx = p.timeline.clips.indexOf(clip);
    p.timeline.clips.splice(idx + 1, 0, newClip);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Reorder clips
app.post('/api/project/:id/reorder', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.clips) p.timeline.clips = req.body.clips;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Effects
app.post('/api/project/:id/effect', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var effect = { id: uuidv4(), type: req.body.type, value: req.body.value, color: req.body.color, similarity: req.body.similarity, blend: req.body.blend };
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.effects.push(effect);
  } else {
    p.timeline.effects.push(effect);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

app.post('/api/project/:id/remove-effect', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.effects = clip.effects.filter(e => e.id !== req.body.effectId);
  } else {
    p.timeline.effects = p.timeline.effects.filter(e => e.id !== req.body.effectId);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Transitions
app.post('/api/project/:id/transition', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var transition = { id: uuidv4(), type: req.body.type, duration: req.body.duration || 1 };
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.transitions.push(transition);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Text
app.post('/api/project/:id/text', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var overlay = { id: uuidv4(), text: req.body.text || 'Text', x: req.body.x || 10, y: req.body.y || 10, fontsize: req.body.fontsize || 24, color: req.body.color || 'white', startTime: req.body.startTime || 0, endTime: req.body.endTime || p.duration };
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.textOverlays.push(overlay);
  } else {
    p.timeline.textOverlays.push(overlay);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

app.post('/api/project/:id/remove-text', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.textOverlays = clip.textOverlays.filter(t => t.id !== req.body.overlayId);
  } else {
    p.timeline.textOverlays = p.timeline.textOverlays.filter(t => t.id !== req.body.overlayId);
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Stickers
app.post('/api/project/:id/sticker', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var sticker = { id: uuidv4(), emoji: req.body.emoji, x: req.body.x || 100, y: req.body.y || 100, size: req.body.size || 64, startTime: req.body.startTime || 0, endTime: req.body.endTime || p.duration };
  p.timeline.stickers.push(sticker);
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

app.post('/api/project/:id/remove-sticker', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.stickers = p.timeline.stickers.filter(s => s.id !== req.body.stickerId);
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Speed
app.post('/api/project/:id/speed', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.speed = req.body.speed || 1;
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Speed ramp (variable speed)
app.post('/api/project/:id/speedramp', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.speedRamp = req.body.segments || null;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Reverse
app.post('/api/project/:id/reverse', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (req.body.clipId) {
    var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
    if (clip) clip.reversed = !clip.reversed;
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Audio
app.post('/api/project/:id/audio', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.audio = { volume: req.body.volume || 1 };
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Watermark
app.post('/api/project/:id/watermark', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.watermark = req.body.imagePath || null;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Zoom
app.post('/api/project/:id/zoom', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.zoom = req.body.enabled ? { duration: req.body.duration || p.duration } : null;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Keyframes
app.post('/api/project/:id/keyframes', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var clip = p.timeline.clips.find(c => c.id === req.body.clipId);
  if (clip) {
    clip.keyframes = req.body.keyframes || [];
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Freeze frame
app.post('/api/project/:id/freezeframe', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var time = req.body.time || 0;
  var dur = req.body.duration || 3;
  var outputPath = path.join(EXPORT_DIR, p.id + '_freeze_' + uuidv4().substring(0, 8) + '.mp4');
  ffmpeg(p.originalPath)
    .seekInput(time).frames(1)
    .outputOptions(['-loop', '1', '-t', String(dur), '-pix_fmt', 'yuv420p'])
    .videoCodec('libx264').audioCodec('aac')
    .on('end', function () {
      var freezeClip = {
        id: uuidv4(), start: 0, end: dur, effects: [], transitions: [], textOverlays: [], stickers: [], keyframes: [],
        speed: 1, reversed: false, track: 0, isFreezeFrame: true, freezePath: outputPath
      };
      var idx = p.timeline.clips.findIndex(c => time >= c.start && time <= c.end);
      if (idx >= 0) p.timeline.clips.splice(idx + 1, 0, freezeClip);
      else p.timeline.clips.push(freezeClip);
      pushHistory(req.params.id); saveProjects();
      res.json({ success: true, timeline: p.timeline });
    })
    .on('error', function (err) { res.status(500).json({ error: err.message }); })
    .save(outputPath);
});

// Waveform generation
app.get('/api/project/:id/waveform', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var wavePath = path.join(PROXY_DIR, p.id + '_waveform.png');
  if (fs.existsSync(wavePath)) return res.sendFile(wavePath);
  ffmpeg(p.originalPath)
    .outputOptions(['-filter_complex', 'showwavespic=s=800x200:colors=e94560', '-frames:v', '1'])
    .on('end', function () { res.sendFile(wavePath); })
    .on('error', function () { res.status(500).json({ error: 'Waveform failed' }); })
    .save(wavePath);
});

// Stickers list
app.get('/api/stickers', function (req, res) {
  var emojis = ['😀','😎','🔥','⭐','💀','👑','❤️','🎮','🎵','💻','🚀','💎','🌟','🎯','⚡','🎨','🎬','🎤','🏆','💪','👍','👀','🎮','👾','🤖','🎃','🦄','🌈','🍕','🍔'];
  res.json(emojis);
});

// Background music upload
app.post('/api/project/:id/music', upload.single('music'), function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  p.timeline.backgroundMusic = {
    path: req.file.path,
    volume: req.body.volume || 0.3,
    startTime: req.body.startTime || 0
  };
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Picture-in-Picture
app.post('/api/project/:id/pip', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.pip = req.body.enabled ? {
    x: req.body.x || 0.7,
    y: req.body.y || 0.7,
    scale: req.body.scale || 0.3,
    startTime: req.body.startTime || 0,
    endTime: req.body.endTime || p.duration
  } : null;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Mouse cursor highlight
app.post('/api/project/:id/cursor', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  p.timeline.cursorHighlight = req.body.enabled ? {
    color: req.body.color || 'red',
    size: req.body.size || 30,
    opacity: req.body.opacity || 0.5
  } : null;
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Track management
app.post('/api/project/:id/track', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  if (!p.timeline.tracks) p.timeline.tracks = [{ id: 'V1', type: 'video', name: 'V1', clips: p.timeline.clips, muted: false, locked: false }];
  if (req.body.action === 'add') {
    var trackNum = p.timeline.tracks.length + 1;
    var prefix = req.body.type === 'audio' ? 'A' : req.body.type === 'overlay' ? 'O' : 'V';
    p.timeline.tracks.push({ id: prefix + trackNum, type: req.body.type || 'video', name: prefix + trackNum, clips: [], muted: false, locked: false });
  } else if (req.body.action === 'remove' && req.body.trackId) {
    p.timeline.tracks = p.timeline.tracks.filter(function (t) { return t.id !== req.body.trackId; });
  } else if (req.body.action === 'mute' && req.body.trackId) {
    var track = p.timeline.tracks.find(function (t) { return t.id === req.body.trackId; });
    if (track) track.muted = !track.muted;
  } else if (req.body.action === 'lock' && req.body.trackId) {
    var track = p.timeline.tracks.find(function (t) { return t.id === req.body.trackId; });
    if (track) track.locked = !track.locked;
  } else if (req.body.action === 'rename' && req.body.trackId && req.body.name) {
    var track = p.timeline.tracks.find(function (t) { return t.id === req.body.trackId; });
    if (track) track.name = req.body.name;
  }
  pushHistory(req.params.id); saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// AI: Scene detection
app.post('/api/project/:id/ai/scene-detect', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  ffmpeg.ffprobe('-v', 'quiet', '-show_entries', 'frame=pts_time,pict_type', '-select_streams', 'v:0', '-of', 'json', p.originalPath, function (err, data) {
    if (err) return res.status(500).json({ error: err.message });
    try {
      var info = JSON.parse(data);
      var scenes = [];
      var frames = info.frames || [];
      var prevType = '';
      frames.forEach(function (f) {
        if (f.pict_type === 'I' && f.pts_time && scenes.indexOf(Math.round(f.pts_time * 10) / 10) < 0) {
          scenes.push(Math.round(f.pts_time * 10) / 10);
        }
      });
      res.json({ success: true, scenes: scenes.slice(0, 50) });
    } catch (e) {
      res.json({ success: true, scenes: [] });
    }
  });
});

// AI: Upscale using sharp
app.post('/api/project/:id/ai/upscale', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var scale = req.body.scale || 2;
  var outputPath = path.join(EXPORT_DIR, p.id + '_upscaled.mp4');
  ffmpeg(p.originalPath)
    .videoFilters('scale=iw*' + scale + ':ih*' + scale + ':flags=lanczos')
    .videoCodec('libx264').audioCodec('aac')
    .outputOptions(['-preset', 'fast', '-crf', '18'])
    .on('end', function () { res.json({ success: true, exportPath: outputPath }); })
    .on('error', function (err) { res.status(500).json({ error: err.message }); })
    .save(outputPath);
});

// Export presets (YouTube, Instagram, TikTok)
app.get('/api/presets', function (req, res) {
  res.json([
    { name: 'YouTube 1080p', width: 1920, height: 1080, fps: 30 },
    { name: 'YouTube 4K', width: 3840, height: 2160, fps: 30 },
    { name: 'Instagram Reel', width: 1080, height: 1920, fps: 30 },
    { name: 'TikTok', width: 1080, height: 1920, fps: 30 },
    { name: 'Twitter', width: 1280, height: 720, fps: 30 },
    { name: 'Square', width: 1080, height: 1080, fps: 30 }
  ]);
});

// Undo
app.post('/api/project/:id/undo', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var stack = historyStack[req.params.id];
  if (!stack || stack.length === 0) return res.json({ success: false, message: 'Nothing to undo' });
  var prev = stack.pop();
  if (!historyStack[req.params.id + '_redo']) historyStack[req.params.id + '_redo'] = [];
  historyStack[req.params.id + '_redo'].push(JSON.parse(JSON.stringify(p.timeline)));
  p.timeline = prev;
  saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Redo
app.post('/api/project/:id/redo', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });
  var redoStack = historyStack[req.params.id + '_redo'];
  if (!redoStack || redoStack.length === 0) return res.json({ success: false, message: 'Nothing to redo' });
  var next = redoStack.pop();
  pushHistory(req.params.id);
  p.timeline = next;
  saveProjects();
  res.json({ success: true, timeline: p.timeline });
});

// Export
app.post('/api/project/:id/export', function (req, res) {
  var p = projects[req.params.id];
  if (!p) return res.status(404).json({ error: 'Not found' });

  var outputPath = path.join(EXPORT_DIR, p.id + '_export.mp4');
  var cmd = ffmpeg(p.originalPath);

  // Multi-clip export: build per-clip filter chains
  var clips = p.timeline.clips;
  if (clips.length > 1) {
    var filterComplex = [];
    var audioParts = [];

    clips.forEach(function (c, i) {
      var inputIdx = i;
      var trimStart = c.start || 0;
      var dur = (c.end || p.duration) - trimStart;
      filterComplex.push('[' + inputIdx + ':v]trim=start=' + trimStart + ':duration=' + dur + ',setpts=PTS-STARTPTS[v' + i + ']');
      if (p.hasAudio !== false) {
        filterComplex.push('[' + inputIdx + ':a]atrim=start=' + trimStart + ':duration=' + dur + ',asetpts=PTS-STARTPTS[a' + i + ']');
      }
    });

    // Apply per-clip effects
    clips.forEach(function (c, i) {
      var label = 'v' + i;
      c.effects.forEach(function (e) {
        var f = buildEffectFilter(e);
        if (f) { filterComplex.push('[' + label + ']' + f + '[v' + i + 'e]'); label = 'v' + i + 'e'; }
      });
      if (label !== 'v' + i) {
        filterComplex.push('[' + label + ']null[' + 'v' + i + 'out]');
      }
    });

    // Chain xfade transitions between clips
    var prevLabel = 'v0out';
    if (clips[0].effects.length === 0) prevLabel = 'v0';
    clips.forEach(function (c, i) {
      if (i === 0) return;
      var curLabel = 'v' + i + (clips[i].effects.length > 0 ? 'out' : '');
      var transType = 'fade';
      var transDur = 1;
      if (c.transitions && c.transitions.length > 0) {
        transType = c.transitions[0].type || 'fade';
        transDur = c.transitions[0].duration || 1;
      }
      var offset = 0;
      for (var j = 0; j < i; j++) {
        offset += (clips[j].end || p.duration) - (clips[j].start || 0);
        if (j > 0 && clips[j].transitions && clips[j].transitions.length > 0) {
          offset -= clips[j].transitions[0].duration || 1;
        }
      }
      var nextLabel = 'xf' + i;
      filterComplex.push('[' + prevLabel + '][' + curLabel + ']xfade=transition=' + transType + ':duration=' + transDur + ':offset=' + Math.max(0, offset - transDur) + '[' + nextLabel + ']');
      prevLabel = nextLabel;
    });

    // Audio chain with acrossfade
    if (p.hasAudio !== false) {
      var prevAudio = 'a0';
      clips.forEach(function (c, i) {
        if (i === 0) return;
        var nextLabel = 'axf' + i;
        var transDur = 1;
        if (c.transitions && c.transitions.length > 0) transDur = c.transitions[0].duration || 1;
        filterComplex.push('[' + prevAudio + '][a' + i + ']acrossfade=d=' + transDur + ':c1=tri:c2=tri[' + nextLabel + ']');
        prevAudio = nextLabel;
      });
    }

    // Text overlays on final output
    var allText = p.timeline.textOverlays.slice();
    clips.forEach(function (c) { allText = allText.concat(c.textOverlays); });
    var lastLabel = clips.length > 1 ? 'xf' + (clips.length - 1) : 'v0out';
    if (clips.length === 1 && clips[0].effects.length === 0) lastLabel = 'v0';
    allText.forEach(function (t, i) {
      var escaped = t.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
      var inLabel = 'txt' + i;
      filterComplex.push('[' + lastLabel + "]drawtext=text='" + escaped + "':fontsize=" + t.fontsize + ":x=" + t.x + ":y=" + t.y + ":fontcolor=" + t.color + ":enable='between(t," + t.startTime + "," + t.endTime + ")'" + '[' + inLabel + ']');
      lastLabel = inLabel;
    });

    // Sticker overlays
    if (p.timeline.stickers && p.timeline.stickers.length > 0) {
      p.timeline.stickers.forEach(function (s, i) {
        var escaped = s.emoji;
        var inLabel = 'stk' + i;
        filterComplex.push('[' + lastLabel + "]drawtext=text='" + escaped + "':fontsize=" + (s.size || 48) + ":x=" + s.x + ":y=" + s.y + ":enable='between(t," + (s.startTime || 0) + "," + (s.endTime || p.duration) + ")'" + '[' + inLabel + ']');
        lastLabel = inLabel;
      });
    }

    var audioLabel = clips.length > 1 ? 'axf' + (clips.length - 1) : 'a0';
    var lastVideo = lastLabel;
    var finalAudio = p.hasAudio !== false ? audioLabel : null;

    // Audio volume
    var vol = p.timeline.audio && p.timeline.audio.volume;
    if (vol !== undefined && vol !== 1 && finalAudio) {
      filterComplex.push('[' + finalAudio + ']volume=' + vol + ':precision=auto[aout]');
      finalAudio = 'aout';
    }

    var mapArgs = ['-map', '[' + lastVideo + ']'];
    if (finalAudio) mapArgs.push('-map', '[' + finalAudio + ']');
    else mapArgs.push('-map', '0:v?');

    cmd = cmd.outputOptions(['-filter_complex', filterComplex.join(';')].concat(mapArgs));
  } else {
    // Single clip export (original logic, improved)
    var clip = clips[0];
    var filterParts = [];

    if (p.timeline.speedRamp && p.timeline.speedRamp.length > 0) {
      var segments = p.timeline.speedRamp;
      var ptsExpr = 'PTS';
      segments.forEach(function (seg) {
        ptsExpr = 'if(between(t,' + seg.start + ',' + seg.end + '),' + (1 / seg.speed) + '*PTS,' + ptsExpr + ')';
      });
      filterParts.push('setpts=' + ptsExpr);
    } else if (clip.speed && clip.speed !== 1) {
      filterParts.push('setpts=' + (1 / clip.speed) + '*PTS');
    }

    if (clip.reversed) filterParts.push('reverse');

    var allEffects = p.timeline.effects.slice().concat(clip.effects);
    allEffects.forEach(function (e) {
      var f = buildEffectFilter(e);
      if (f) filterParts.push(f);
    });

    var allText = p.timeline.textOverlays.slice().concat(clip.textOverlays || []);
    allText.forEach(function (t) {
      var escaped = t.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
      filterParts.push("drawtext=text='" + escaped + "':fontsize=" + t.fontsize + ":x=" + t.x + ":y=" + t.y + ":fontcolor=" + t.color + ":enable='between(t," + t.startTime + "," + t.endTime + ")'");
    });

    if (clip.transitions) {
      clip.transitions.forEach(function (t) {
        filterParts.push(buildTransitionFilter(t, t.duration));
      });
    }

    var vol = p.timeline.audio && p.timeline.audio.volume;
    if (vol !== undefined && vol !== 1) filterParts.push('volume=' + vol + ':precision=auto');

    if (p.timeline.cursorHighlight) {
      var ch = p.timeline.cursorHighlight;
      filterParts.push("drawbox=x='mod(t*200\\,w)':y='h/2':w=" + ch.size + ":h=" + ch.size + ":color=" + ch.color + "@" + ch.opacity + ":t=fill");
    }

    if (p.timeline.zoom) {
      var z = p.timeline.zoom;
      var dur = z.duration || p.duration;
      var fps = p.fps || 30;
      filterParts.push("zoompan=z='min(zoom+0.002\\,1.8)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=" + Math.round(dur * fps) + ':s=' + p.width + 'x' + p.height + ':fps=' + fps);
    }

    if (clip.keyframes && clip.keyframes.length > 0) {
      clip.keyframes.forEach(function (kf) {
        if (kf.property === 'opacity') {
          filterParts.push("format=rgba,colorchannelmixer=aa=" + kf.value);
        }
      });
    }

    if (filterParts.length > 0) cmd = cmd.videoFilters(filterParts.join(','));

    cmd = cmd.setStartTime(clip.start);
    cmd = cmd.setDuration(clip.end - clip.start);
  }

  // Background music
  if (p.timeline.backgroundMusic && p.timeline.backgroundMusic.path) {
    cmd = cmd.input(p.timeline.backgroundMusic.path);
    var musicVol = p.timeline.backgroundMusic.volume || 0.3;
    var musicDur = p.duration - 2;
    if (musicDur < 0) musicDur = 0;
    cmd = cmd.outputOptions([
      '-filter_complex', '[1:a]volume=' + musicVol + ',afade=t=in:st=0:d=2,afade=t=out:st=' + musicDur + ':d=2[bg];[0:a][bg]amix=inputs=2:duration=first[aout]',
      '-map', '0:v', '-map', '[aout]'
    ]);
  }

  var audioOpts = [];
  var revClip = p.timeline.clips.find(c => c.reversed);
  if (revClip && clips.length === 1) audioOpts.push('-af', 'areverse');

  var format = req.body.format || 'mp4';
  var quality = req.body.quality || 'medium';
  var qualityMap = {
    web: { crf: 28, preset: 'ultrafast' },
    medium: { crf: 23, preset: 'fast' },
    high: { crf: 18, preset: 'medium' },
    ultra: { crf: 12, preset: 'slow' }
  };
  var q = qualityMap[quality] || qualityMap.medium;

  var ext = format === 'webm' ? '.webm' : format === 'gif' ? '.gif' : '.mp4';
  outputPath = path.join(EXPORT_DIR, p.id + '_export' + ext);

  if (format === 'gif') {
    cmd = ffmpeg(p.originalPath)
      .outputOptions([
        '-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        '-loop', '0'
      ]);
  } else {
    var vcodec = format === 'webm' ? 'libvpx-vp9' : 'libx264';
    cmd = cmd.videoCodec(vcodec).audioCodec('aac')
      .outputOptions(['-preset', q.preset, '-crf', String(q.crf)].concat(audioOpts));
  }

  cmd.on('end', function () { res.json({ success: true, exportPath: outputPath }); })
    .on('error', function (err) { res.status(500).json({ error: err.message }); })
    .save(outputPath);
});

app.get('/api/export/:id', function (req, res) {
  var ep = path.join(EXPORT_DIR, req.params.id + '_export.mp4');
  if (!fs.existsSync(ep)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(ep);
});

var PORT = 3040;
var server = app.listen(PORT, function () {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     CLIPFORGE VIDEO EDITOR v2.0          ║');
  console.log('  ║     http://localhost:' + PORT + '                  ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.log('Port ' + PORT + ' busy, trying ' + (PORT + 1));
    PORT = PORT + 1;
    server = app.listen(PORT);
  }
});
