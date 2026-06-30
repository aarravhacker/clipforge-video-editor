const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PROXY_DIR = path.join(__dirname, 'proxies');
const EXPORT_DIR = path.join(__dirname, 'exports');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, require('uuid').v4() + path.extname(file.originalname))
});
const upload = multer({ storage });

const projects = {};

function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const vs = metadata.streams.find(s => s.codec_type === 'video');
      resolve({ duration: metadata.format.duration || 0, width: vs ? vs.width : 0, height: vs ? vs.height : 0 });
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
    case 'grayscale': return 'hue=s=0';
    case 'sepia': return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';
    case 'vintage': return 'curves=vintage';
    case 'invert': return 'negate';
    case 'glitch': return 'rgbashift=rh=-8:bh=6:gs=-4,hue=H=2*PI*t';
    case 'vignette': return 'vignette=PI/4';
    case 'sharpen': return 'unsharp=5:5:' + (e.value || 1.5);
    case 'emboss': return "convolution='0 1 0:1 -4 1:0 1 0:0 1 0:1 -4 1:0 1 0'";
    case 'rgbsplit': return 'rgbashift=rh=-' + (e.value || 12);
    case 'pixelate': return 'scale=iw/8:ih/8,scale=iw*8:ih*8:flags=neighbor';
    case 'mirror': return 'hflip';
    case 'flip': return 'vflip';
    case 'warm': return 'colorbalance=rs=0.1:gs=0.05:bs=-0.1';
    case 'cool': return 'colorbalance=rs=-0.1:gs=0:bs=0.1';
    case 'grain': return 'noise=c0s=' + (e.value || 20) + ':c0f=t';
    case 'neon': return 'edgedetect=low=0.1:high=0.4,negate';
    case 'chromakey': return 'chromakey=color=' + (e.color || '0x00FF00') + ':similarity=' + (e.similarity || 0.3);
    case 'reverse': return 'reverse';
    case 'lut_cinematic': return 'curves=r=\'0/0 0.5/0.45 1/1\'';
    case 'lut_warm': return 'colortemperature=temperature=7500';
    case 'lut_cold': return 'colortemperature=temperature=4000';
    case 'lut_bw_high': return 'hue=s=0,eq=contrast=1.5';
    default: return null;
  }
}

const tools = {
  upload_video: {
    description: 'Upload a video file to the editor',
    parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
    handler: async (params) => {
      if (!fs.existsSync(params.filePath)) return { error: 'File not found' };
      const id = require('uuid').v4();
      const destPath = path.join(UPLOAD_DIR, id + path.extname(params.filePath));
      const proxyPath = path.join(PROXY_DIR, id + '_proxy.mp4');
      fs.copyFileSync(params.filePath, destPath);
      await generateProxy(destPath, proxyPath);
      const info = await getVideoInfo(destPath);
      projects[id] = {
        id, originalName: path.basename(params.filePath), originalPath: destPath, proxyPath,
        duration: info.duration, width: info.width, height: info.height,
        timeline: {
          clips: [{ id: require('uuid').v4(), start: 0, end: info.duration, effects: [], transitions: [], textOverlays: [], stickers: [], keyframes: [], speed: 1, reversed: false, track: 0 }],
          effects: [], textOverlays: [], stickers: [],
          audio: { volume: 1 }, watermark: null, zoom: null, speedRamp: null
        }
      };
      return { projectId: id, name: path.basename(params.filePath), duration: info.duration };
    }
  },
  list_projects: {
    description: 'List all uploaded video projects',
    parameters: { type: 'object', properties: {} },
    handler: async () => Object.values(projects).map(p => ({ id: p.id, name: p.originalName, duration: p.duration }))
  },
  get_timeline: {
    description: 'Get timeline state',
    parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] },
    handler: async (params) => {
      const p = projects[params.projectId];
      if (!p) return { error: 'Not found' };
      return { timeline: p.timeline, duration: p.duration };
    }
  },
  trim: {
    description: 'Trim a clip',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, clipIndex: { type: 'number' }, start: { type: 'number' }, end: { type: 'number' } }, required: ['projectId', 'start', 'end'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const clip = p.timeline.clips[params.clipIndex || 0];
      if (clip) { clip.start = params.start; clip.end = params.end; }
      return { success: true };
    }
  },
  split_clip: {
    description: 'Split a clip at a specific time',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, clipIndex: { type: 'number' }, time: { type: 'number' } }, required: ['projectId', 'time'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const clip = p.timeline.clips[params.clipIndex || 0];
      if (clip && params.time > clip.start && params.time < clip.end) {
        const newClip = JSON.parse(JSON.stringify(clip));
        newClip.id = require('uuid').v4();
        newClip.start = params.time;
        clip.end = params.time;
        p.timeline.clips.splice(p.timeline.clips.indexOf(clip) + 1, 0, newClip);
      }
      return { success: true, clips: p.timeline.clips.length };
    }
  },
  apply_effect: {
    description: 'Apply a visual effect (brightness, contrast, saturation, blur, gblur, grayscale, sepia, vintage, invert, glitch, vignette, sharpen, emboss, rgbsplit, pixelate, mirror, flip, warm, cool, grain, neon, chromakey, reverse, lut_cinematic, lut_warm, lut_cold, lut_bw_high)',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, type: { type: 'string' }, value: { type: 'number' }, color: { type: 'string' }, clipIndex: { type: 'number' } }, required: ['projectId', 'type'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const effect = { id: require('uuid').v4(), type: params.type, value: params.value || 1, color: params.color };
      if (params.clipIndex !== undefined) p.timeline.clips[params.clipIndex].effects.push(effect);
      else p.timeline.effects.push(effect);
      return { success: true, effect };
    }
  },
  add_transition: {
    description: 'Add transition (fade, slide, wipe, dissolve, circle, zoom, spin, glitch_trans, blur_trans, whip, pan)',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, type: { type: 'string' }, duration: { type: 'number' }, clipIndex: { type: 'number' } }, required: ['projectId', 'type'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const t = { id: require('uuid').v4(), type: params.type, duration: params.duration || 1 };
      p.timeline.clips[params.clipIndex || 0].transitions.push(t);
      return { success: true, transition: t };
    }
  },
  add_text: {
    description: 'Add text overlay',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, text: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, fontsize: { type: 'number' }, color: { type: 'string' }, startTime: { type: 'number' }, endTime: { type: 'number' } }, required: ['projectId', 'text'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const o = { id: require('uuid').v4(), text: params.text, x: params.x || 10, y: params.y || 10, fontsize: params.fontsize || 24, color: params.color || 'white', startTime: params.startTime || 0, endTime: params.endTime || p.duration };
      p.timeline.textOverlays.push(o);
      return { success: true, overlay: o };
    }
  },
  add_sticker: {
    description: 'Add an emoji sticker overlay',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, emoji: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, size: { type: 'number' }, startTime: { type: 'number' }, endTime: { type: 'number' } }, required: ['projectId', 'emoji'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const s = { id: require('uuid').v4(), emoji: params.emoji, x: params.x || 100, y: params.y || 100, size: params.size || 64, startTime: params.startTime || 0, endTime: params.endTime || p.duration };
      p.timeline.stickers.push(s);
      return { success: true, sticker: s };
    }
  },
  set_speed: {
    description: 'Set clip speed (0.5=half, 2=double)',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, speed: { type: 'number' }, clipIndex: { type: 'number' } }, required: ['projectId', 'speed'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      p.timeline.clips[params.clipIndex || 0].speed = params.speed;
      return { success: true };
    }
  },
  set_speed_ramp: {
    description: 'Set variable speed ramp with segments [{start, end, speed}]',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, segments: { type: 'array' } }, required: ['projectId', 'segments'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      p.timeline.speedRamp = params.segments;
      return { success: true };
    }
  },
  reverse_clip: {
    description: 'Toggle reverse on a clip',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, clipIndex: { type: 'number' } }, required: ['projectId'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const c = p.timeline.clips[params.clipIndex || 0];
      c.reversed = !c.reversed;
      return { success: true, reversed: c.reversed };
    }
  },
  set_volume: {
    description: 'Set audio volume (0=mute, 1=normal, 2=double)',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, volume: { type: 'number' } }, required: ['projectId', 'volume'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      p.timeline.audio = { volume: params.volume };
      return { success: true };
    }
  },
  set_zoom: {
    description: 'Toggle Ken Burns zoom effect',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['projectId', 'enabled'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      p.timeline.zoom = params.enabled ? { duration: p.duration } : null;
      return { success: true };
    }
  },
  set_keyframe: {
    description: 'Set a keyframe animation (property: x, y, scaleX, scaleY, rotation, opacity)',
    parameters: { type: 'object', properties: { projectId: { type: 'string' }, clipIndex: { type: 'number' }, property: { type: 'string' }, time: { type: 'number' }, value: { type: 'number' } }, required: ['projectId', 'property', 'time', 'value'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const clip = p.timeline.clips[params.clipIndex || 0];
      if (!clip.keyframes) clip.keyframes = [];
      clip.keyframes.push({ property: params.property, time: params.time, value: params.value });
      clip.keyframes.sort((a, b) => a.time - b.time);
      return { success: true, keyframes: clip.keyframes };
    }
  },
  export_video: {
    description: 'Export the final video with all effects',
    parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] },
    handler: async (params) => {
      const p = projects[params.projectId]; if (!p) return { error: 'Not found' };
      const outputPath = path.join(EXPORT_DIR, p.id + '_export.mp4');
      const allEffects = [...p.timeline.effects, ...p.timeline.clips.flatMap(c => c.effects)];
      const allText = [...p.timeline.textOverlays, ...p.timeline.clips.flatMap(c => c.textOverlays)];
      let filterParts = [];

      if (p.timeline.speedRamp) {
        var ptsExpr = 'PTS';
        p.timeline.speedRamp.forEach(seg => { ptsExpr = 'if(between(t,' + seg.start + ',' + seg.end + '),' + (1 / seg.speed) + '*PTS,' + ptsExpr + ')'; });
        filterParts.push('setpts=' + ptsExpr);
      } else {
        const sc = p.timeline.clips.find(c => c.speed && c.speed !== 1);
        if (sc) filterParts.push('setpts=' + (1 / sc.speed) + '*PTS');
      }

      const rc = p.timeline.clips.find(c => c.reversed);
      if (rc) filterParts.push('reverse');

      allEffects.forEach(e => { const f = buildEffectFilter(e); if (f) filterParts.push(f); });
      allText.forEach(t => {
        const esc = t.text.replace(/'/g, "\\'").replace(/:/g, "\\:");
        filterParts.push("drawtext=text='" + esc + "':fontsize=" + t.fontsize + ":x=" + t.x + ":y=" + t.y + ":fontcolor=" + t.color + ":enable='between(t," + t.startTime + "," + t.endTime + ")'");
      });

      p.timeline.clips.forEach(c => c.transitions.forEach(t => {
        switch (t.type) {
          case 'fade': filterParts.push('fade=t=in:st=0:d=' + t.duration); break;
          case 'zoom': filterParts.push("zoompan=z='if(lte(on,1),1,max(1.01,zoom-0.002))':d=" + Math.round(t.duration * 30)); break;
          case 'spin': filterParts.push('rotate=angle=2*PI*t/' + t.duration); break;
          case 'glitch_trans': filterParts.push('rgbashift=rh=-10:bh=8:gs=-6'); break;
          default: filterParts.push('fade=t=in:st=0:d=' + t.duration);
        }
      }));

      var vol = p.timeline.audio && p.timeline.audio.volume;
      if (vol !== undefined && vol !== 1) filterParts.push('volume=' + vol);

      return new Promise((resolve) => {
        let cmd = ffmpeg(p.originalPath);
        if (filterParts.length > 0) cmd = cmd.videoFilters(filterParts.join(','));
        const clip = p.timeline.clips[0];
        if (clip) { cmd = cmd.setStartTime(clip.start); cmd = cmd.setDuration(clip.end - clip.start); }
        var audioOpts = rc ? ['-af', 'areverse'] : [];
        cmd.videoCodec('libx264').audioCodec('aac')
          .outputOptions(['-preset', 'fast', '-crf', '23'].concat(audioOpts))
          .on('end', () => resolve({ success: true, exportPath: outputPath }))
          .on('error', (err) => resolve({ error: err.message }))
          .save(outputPath);
      });
    }
  }
};

app.post('/', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: Object.entries(tools).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.parameters })) } });
  }
  if (method === 'tools/call') {
    const tool = tools[params.name];
    if (!tool) return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Not found' } });
    try {
      const result = await tool.handler(params.arguments || {});
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } });
    } catch (err) { return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } }); }
  }
  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

const MCP_PORT = 3001;
app.listen(MCP_PORT, () => console.log('MCP Server running at http://localhost:' + MCP_PORT));
