var API = '';
var currentProject = null;

var video = document.getElementById('videoPlayer');
var dropZone = document.getElementById('dropZone');
var fileInput = document.getElementById('fileInput');
var mediaList = document.getElementById('mediaList');
var exportBtn = document.getElementById('exportBtn');
var playBtn = document.getElementById('playBtn');
var pauseBtn = document.getElementById('pauseBtn');
var playIcon = document.getElementById('playIcon');
var pauseIcon = document.getElementById('pauseIcon');
var currentTimeEl = document.getElementById('currentTime');
var totalTimeEl = document.getElementById('totalTime');
var timelineTrack = document.getElementById('timelineTrack');
var playhead = document.getElementById('playhead');
var trackClip = document.getElementById('trackClip');
var previewOverlay = document.getElementById('previewOverlay');
var activeEffects = document.getElementById('activeEffects');
var previewPlaceholder = document.getElementById('previewPlaceholder');
var projectStatus = document.getElementById('projectStatus');
var waveformWrapper = document.getElementById('waveformWrapper');
var waveformImg = document.getElementById('waveformImg');

function showToast(msg, type) {
  var toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + (type || '') + ' show';
  setTimeout(function () { toast.className = 'toast'; }, 2500);
}

function showLoading(text) {
  document.getElementById('loadingText').textContent = text || 'Processing...';
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() { document.getElementById('loadingOverlay').classList.add('hidden'); }

function formatTimecode(s) {
  if (!s || isNaN(s)) return '00:00.000';
  var m = Math.floor(s / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 1000);
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec + '.' + (ms < 100 ? '0' : '') + (ms < 10 ? '0' : '') + ms;
}

function formatTimeShort(s) {
  if (!s || isNaN(s)) return '0:00';
  return Math.floor(s / 60) + ':' + (Math.floor(s % 60) < 10 ? '0' : '') + Math.floor(s % 60);
}

function formatSize(b) { return b ? (b / 1048576).toFixed(1) + ' MB' : ''; }

function apiPost(path, data, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API + path);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function () { try { cb(JSON.parse(xhr.responseText)); } catch (e) { cb({ error: 'Parse error' }); } };
  xhr.onerror = function () { cb({ error: 'Network error' }); };
  xhr.send(JSON.stringify(data));
}

function apiGet(path, cb) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', API + path);
  xhr.onload = function () { try { cb(JSON.parse(xhr.responseText)); } catch (e) { cb({ error: 'Parse error' }); } };
  xhr.send();
}

function uploadVideo(file) {
  showLoading('Uploading ' + file.name + '...');
  var fd = new FormData();
  fd.append('video', file);
  var xhr = new XMLHttpRequest();
  xhr.open('POST', API + '/api/upload');
  xhr.onload = function () {
    hideLoading();
    try {
      var d = JSON.parse(xhr.responseText);
      if (d.success) { currentProject = d.project; loadProject(d.project); showToast('Uploaded!', 'success'); loadProjects(); }
      else showToast('Failed: ' + (d.error || ''), 'error');
    } catch (e) { showToast('Upload failed', 'error'); }
  };
  xhr.onerror = function () { hideLoading(); showToast('Network error', 'error'); };
  xhr.send(fd);
}

function loadProjects() {
  apiGet('/api/projects', function (list) {
    mediaList.innerHTML = '';
    list.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'media-item' + (currentProject && currentProject.id === p.id ? ' active' : '');
      div.innerHTML = '<div class="media-info"><div class="media-name">' + p.name + '</div><div class="media-meta">' + formatTimeShort(p.duration) + (p.size ? ' · ' + formatSize(p.size) : '') + '</div></div>';
      div.onclick = function () { selectProject(p.id); };
      mediaList.appendChild(div);
    });
  });
}

function selectProject(id) {
  showLoading('Loading...');
  apiGet('/api/project/' + id, function (p) {
    hideLoading();
    if (p.error) return showToast('Failed', 'error');
    currentProject = p;
    loadProject(p);
// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('undoBtn').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('redoBtn').click(); }
  if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
});

// AI Tools - Video Editor
document.getElementById('aiSceneDetect').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  showLoading('Detecting scenes...');
  apiPost('/api/project/' + currentProject.id + '/ai/scene-detect', {}, function (d) {
    hideLoading();
    if (d.success) {
      showToast('Found ' + d.scenes.length + ' scene changes', 'success');
      if (d.scenes.length > 0) {
        var sceneList = d.scenes.map(function (t) { return formatTimeShort(t); }).join(', ');
        showToast('Scenes at: ' + sceneList, 'success');
      }
    } else showToast('Scene detection failed', 'error');
  });
});

document.getElementById('aiUpscale').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  showLoading('Upscaling video 2x...');
  apiPost('/api/project/' + currentProject.id + '/ai/upscale', { scale: 2 }, function (d) {
    hideLoading();
    if (d.success) {
      showToast('Upscale complete!', 'success');
      var a = document.createElement('a');
      a.href = API + '/api/export/' + currentProject.id;
      a.download = currentProject.originalName + '_upscaled.mp4';
      a.click();
    } else showToast('Upscale failed: ' + (d.error || ''), 'error');
  });
});

// Track management
document.getElementById('addTrackBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  apiPost('/api/project/' + currentProject.id + '/track', { action: 'add', type: 'video' }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; updateTrackDisplay(currentProject); showToast('Track added', 'success'); }
  });
});
document.getElementById('addOverlayTrackBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  apiPost('/api/project/' + currentProject.id + '/track', { action: 'add', type: 'overlay' }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; updateTrackDisplay(currentProject); showToast('Overlay track added', 'success'); }
  });
});

function updateTrackDisplay(project) {
  var container = document.getElementById('trackContainer');
  container.innerHTML = '';
  var tracks = project.timeline.tracks || [{ id: 'V1', type: 'video', name: 'V1', clips: project.timeline.clips, muted: false, locked: false }];
  tracks.forEach(function (track) {
    var wrapper = document.createElement('div');
    wrapper.className = 'timeline-track-wrapper';
    var label = document.createElement('div');
    label.className = 'track-label' + (track.muted ? ' muted' : '') + (track.locked ? ' locked' : '');
    label.textContent = track.name;
    label.title = 'Click: toggle mute | Right-click: lock/unlock';
    label.onclick = function () {
      if (!currentProject) return;
      apiPost('/api/project/' + currentProject.id + '/track', { action: 'mute', trackId: track.id }, function (d) {
        if (d.success) { currentProject.timeline = d.timeline; updateTrackDisplay(currentProject); }
      });
    };
    label.oncontextmenu = function (e) {
      e.preventDefault();
      if (!currentProject) return;
      apiPost('/api/project/' + currentProject.id + '/track', { action: 'lock', trackId: track.id }, function (d) {
        if (d.success) { currentProject.timeline = d.timeline; updateTrackDisplay(currentProject); }
      });
    };
    var trackEl = document.createElement('div');
    trackEl.className = 'timeline-track';
    var clipEl = document.createElement('div');
    clipEl.className = 'track-clip';
    if (track.clips && track.clips.length > 0) {
      clipEl.classList.add('has-content');
      var totalDur = track.clips.reduce(function (sum, c) { return sum + ((c.end || project.duration) - (c.start || 0)); }, 0);
      clipEl.style.width = Math.min((totalDur / project.duration) * 100, 100) + '%';
    }
    trackEl.appendChild(clipEl);
    if (track.id === 'V1') {
      var playheadEl = document.createElement('div');
      playheadEl.className = 'timeline-playhead';
      playheadEl.id = 'playhead';
      playheadEl.innerHTML = '<div class="playhead-head"></div><div class="playhead-line"></div>';
      trackEl.appendChild(playheadEl);
    }
    wrapper.appendChild(label);
    wrapper.appendChild(trackEl);
    container.appendChild(wrapper);
  });
}

loadProjects();
  });
}

function loadProject(project) {
  video.src = API + '/api/project/' + project.id + '/video';
  video.style.display = 'block';
  previewPlaceholder.style.display = 'none';
  video.load();
  exportBtn.disabled = false;
  playBtn.disabled = false;
  pauseBtn.disabled = false;
  document.getElementById('skipBackBtn').disabled = false;
  document.getElementById('skipForwardBtn').disabled = false;
  document.getElementById('splitBtn').disabled = false;
  document.getElementById('undoBtn').disabled = false;
  document.getElementById('redoBtn').disabled = false;
  projectStatus.textContent = project.originalName;
  projectStatus.classList.remove('hidden');
  updateTimeline(project);
  updateTrackDisplay(project);
  updateActiveEffects(project);
  applyEffectsToPreview();
  loadWaveform(project.id);
}

function loadWaveform(pid) {
  waveformWrapper.style.display = 'block';
  waveformImg.src = API + '/api/project/' + pid + '/waveform?t=' + Date.now();
}

function updateTimeline(project) {
  var clip = project.timeline.clips[0];
  if (!clip) return;
  trackClip.classList.add('has-content');
  trackClip.style.width = Math.min(((clip.end - clip.start) / project.duration) * 100, 100) + '%';
}

function updateActiveEffects(project) {
  activeEffects.innerHTML = '';
  var all = project.timeline.effects.slice();
  project.timeline.clips.forEach(function (c) { all = all.concat(c.effects); });
  all.forEach(function (e) {
    var tag = document.createElement('span');
    tag.className = 'effect-tag';
    tag.textContent = e.type;
    activeEffects.appendChild(tag);
  });
  project.timeline.clips.forEach(function (c) {
    c.transitions.forEach(function (t) {
      var tag = document.createElement('span');
      tag.className = 'effect-tag transition-tag';
      tag.textContent = t.type;
      activeEffects.appendChild(tag);
    });
  });
  if (project.timeline.stickers) {
    project.timeline.stickers.forEach(function (s) {
      var tag = document.createElement('span');
      tag.className = 'effect-tag sticker-tag';
      tag.textContent = s.emoji;
      activeEffects.appendChild(tag);
    });
  }
}

function applyEffectsToPreview() {
  if (!currentProject) return;
  var all = currentProject.timeline.effects.slice();
  currentProject.timeline.clips.forEach(function (c) { all = all.concat(c.effects); });
  var css = '';
  all.forEach(function (e) {
    switch (e.type) {
      case 'brightness': css += 'brightness(' + (1 + e.value) + ') '; break;
      case 'contrast': css += 'contrast(' + e.value + ') '; break;
      case 'saturation': css += 'saturate(' + e.value + ') '; break;
      case 'blur': css += 'blur(' + e.value + 'px) '; break;
      case 'gblur': css += 'blur(' + (e.value || 10) / 2 + 'px) '; break;
      case 'grayscale': css += 'grayscale(1) '; break;
      case 'sepia': css += 'sepia(1) '; break;
      case 'vintage': css += 'sepia(0.5) contrast(1.2) brightness(0.9) '; break;
      case 'invert': css += 'invert(1) '; break;
      case 'glitch': css += 'hue-rotate(90deg) saturate(2) '; break;
      case 'vignette': css += 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.7) 100%) '; break;
      case 'sharpen': css += 'contrast(' + (1 + (e.value || 0) * 0.3) + ') '; break;
      case 'emboss': css += 'contrast(1.5) brightness(0.9) grayscale(0.3) '; break;
      case 'rgbsplit': css += 'hue-rotate(' + (e.value || 10) + 'deg) '; break;
      case 'pixelate': css += 'blur(2px) contrast(2) '; break;
      case 'mirror': css += 'scaleX(-1) '; break;
      case 'flip': css += 'scaleY(-1) '; break;
      case 'warm': css += 'sepia(0.3) saturate(1.4) '; break;
      case 'cool': css += 'hue-rotate(20deg) saturate(0.8) '; break;
      case 'neon': css += 'brightness(1.3) contrast(2) saturate(3) '; break;
      case 'lut_cinematic': css += 'contrast(1.1) saturate(0.9) brightness(0.95) '; break;
      case 'lut_warm': css += 'sepia(0.2) saturate(1.3) brightness(1.1) '; break;
      case 'lut_cold': css += 'hue-rotate(10deg) saturate(0.7) brightness(1.05) '; break;
      case 'lut_bw_high': css += 'grayscale(1) contrast(1.5) '; break;
      case 'chromakey': css += 'contrast(1.5) '; break;
      case 'sketch': css += 'grayscale(1) contrast(2) brightness(1.2) '; break;
      case 'pencil': css += 'grayscale(1) contrast(2) '; break;
      case 'charcoal': css += 'grayscale(1) contrast(2.5) invert(1) '; break;
      case 'cartoon': css += 'contrast(2) saturate(1.5) '; break;
      case 'oil_painting': css += 'blur(1px) contrast(1.5) saturate(1.3) '; break;
      case 'watercolor': css += 'blur(1px) saturate(1.5) brightness(1.1) '; break;
      case 'popart': css += 'saturate(3) contrast(1.5) '; break;
      case 'psychedelic': css += 'hue-rotate(180deg) saturate(3) '; break;
      case 'cinemascope': css += 'contrast(1.1) brightness(0.95) '; break;
      case 'noir': css += 'grayscale(1) contrast(1.6) brightness(0.95) '; break;
      case 'dream': css += 'blur(2px) brightness(1.1) saturate(1.3) '; break;
      case 'faded': css += 'contrast(0.85) brightness(1.08) saturate(0.6) '; break;
      case 'vhs': css += 'sepia(0.5) contrast(1.2) saturate(0.8) '; break;
      case 'film_8mm': css += 'sepia(0.6) contrast(1.3) brightness(0.9) '; break;
      case 'dv_cam': css += 'contrast(1.2) saturate(0.8) brightness(1.05) '; break;
      case 'film_grain_heavy': css += 'contrast(1.1) saturate(0.9) brightness(0.95) '; break;
      case 'fisheye': css += 'contrast(1.2) brightness(1.05) '; break;
      case 'barrel': css += 'contrast(1.1) '; break;
      case 'solarize': css += 'contrast(1.5) brightness(1.1) saturate(2) '; break;
      case 'posterize': css += 'contrast(2) saturate(1.5) brightness(1.05) '; break;
      case 'edge_detect': css += 'contrast(3) brightness(1.5) grayscale(1) '; break;
      case 'canny': css += 'contrast(5) grayscale(1) brightness(1.5) '; break;
      case 'sharpen_high': css += 'contrast(1.6) brightness(1.05) '; break;
      case 'denoise': css += 'blur(0.5px) contrast(1.1) '; break;
    }
  });
  video.style.filter = css.trim() || 'none';
  var sc = currentProject.timeline.clips.find(function (c) { return c.speed && c.speed !== 1; });
  if (sc) video.playbackRate = sc.speed;
  previewOverlay.innerHTML = '';
  var allText = currentProject.timeline.textOverlays.slice();
  currentProject.timeline.clips.forEach(function (c) { allText = allText.concat(c.textOverlays); });
  allText.forEach(function (t) {
    var span = document.createElement('span');
    span.className = 'preview-text';
    span.textContent = t.text;
    span.style.left = t.x + 'px';
    span.style.top = t.y + 'px';
    span.style.fontSize = t.fontsize + 'px';
    span.style.color = t.color;
    previewOverlay.appendChild(span);
  });
  if (currentProject.timeline.stickers) {
    currentProject.timeline.stickers.forEach(function (s) {
      var span = document.createElement('span');
      span.className = 'preview-sticker';
      span.textContent = s.emoji;
      span.style.left = s.x + 'px';
      span.style.top = s.y + 'px';
      span.style.fontSize = s.size + 'px';
      previewOverlay.appendChild(span);
    });
  }
}

// Drop zone
dropZone.addEventListener('click', function () { fileInput.click(); });
dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files[0]) uploadVideo(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', function (e) { if (e.target.files[0]) uploadVideo(e.target.files[0]); });

// Transport
playBtn.addEventListener('click', function () { video.play(); });
pauseBtn.addEventListener('click', function () { video.pause(); });
document.getElementById('skipBackBtn').addEventListener('click', function () { video.currentTime = Math.max(0, video.currentTime - 5); });
document.getElementById('skipForwardBtn').addEventListener('click', function () { video.currentTime = Math.min(video.duration, video.currentTime + 5); });

// Undo/Redo
document.getElementById('undoBtn').addEventListener('click', function () {
  if (!currentProject) return;
  apiPost('/api/project/' + currentProject.id + '/undo', {}, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; updateTimeline(currentProject); updateActiveEffects(currentProject); applyEffectsToPreview(); showToast('Undone', 'success'); }
    else showToast(d.message || 'Nothing to undo', 'error');
  });
});
document.getElementById('redoBtn').addEventListener('click', function () {
  if (!currentProject) return;
  apiPost('/api/project/' + currentProject.id + '/redo', {}, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; updateTimeline(currentProject); updateActiveEffects(currentProject); applyEffectsToPreview(); showToast('Redone', 'success'); }
    else showToast(d.message || 'Nothing to redo', 'error');
  });
});

document.getElementById('splitBtn').addEventListener('click', function () {
  if (!currentProject) return;
  apiPost('/api/project/' + currentProject.id + '/split', { clipId: currentProject.timeline.clips[0].id, time: video.currentTime }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; updateTimeline(currentProject); showToast('Clip split!', 'success'); }
  });
});

video.addEventListener('timeupdate', function () {
  var pct = (video.currentTime / video.duration) * 100 || 0;
  playhead.style.left = pct + '%';
  currentTimeEl.textContent = formatTimecode(video.currentTime);
  totalTimeEl.textContent = formatTimecode(video.duration);
  if (currentProject) {
    var allText = currentProject.timeline.textOverlays.slice();
    currentProject.timeline.clips.forEach(function (c) { allText = allText.concat(c.textOverlays); });
    var els = previewOverlay.querySelectorAll('.preview-text');
    els.forEach(function (el, i) {
      var t = allText[i];
      if (t) el.style.display = (video.currentTime >= t.startTime && video.currentTime <= t.endTime) ? 'block' : 'none';
    });
  }
});

video.addEventListener('play', function () { playBtn.style.display = 'none'; pauseBtn.style.display = 'flex'; });
video.addEventListener('pause', function () { playBtn.style.display = 'flex'; pauseBtn.style.display = 'none'; });
video.addEventListener('ended', function () { playBtn.style.display = 'flex'; pauseBtn.style.display = 'none'; });

timelineTrack.addEventListener('click', function (e) {
  if (!video.duration) return;
  video.currentTime = ((e.clientX - timelineTrack.getBoundingClientRect().left) / timelineTrack.offsetWidth) * video.duration;
});

// Effects (toggle buttons)
document.querySelectorAll('.effect-btn, .preset-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (!currentProject) return showToast('Upload a video first', 'error');
    var type = btn.dataset.effect;
    apiPost('/api/project/' + currentProject.id + '/effect', { type: type, value: 1 }, function (d) {
      if (d.success) { currentProject.timeline = d.timeline; btn.classList.toggle('active'); applyEffectsToPreview(); updateActiveEffects(currentProject); showToast(type + ' applied', 'success'); }
    });
  });
});

// Sliders
['brightness', 'contrast', 'saturation', 'blur', 'gblur', 'sharpen', 'rgbsplit', 'grain'].forEach(function (id) {
  var slider = document.getElementById(id);
  if (!slider) return;
  var valEl = document.getElementById(id + 'Val');
  slider.addEventListener('input', function () { valEl.textContent = slider.value; });
  slider.addEventListener('change', function () {
    if (!currentProject) return;
    var value = parseFloat(slider.value);
    if (id === 'blur' && value === 0 || id === 'brightness' && value === 0 || id === 'contrast' && value === 1 ||
        id === 'saturation' && value === 1 || id === 'gblur' && value === 0 || id === 'sharpen' && value === 0 ||
        id === 'rgbsplit' && value === 0 || id === 'grain' && value === 0) return;
    apiPost('/api/project/' + currentProject.id + '/effect', { type: id, value: value }, function (d) {
      if (d.success) { applyEffectsToPreview(); updateActiveEffects(currentProject); }
    });
  });
});

document.getElementById('volume').addEventListener('change', function (e) {
  if (!currentProject) return;
  document.getElementById('volumeVal').textContent = parseFloat(e.target.value).toFixed(1);
  apiPost('/api/project/' + currentProject.id + '/audio', { volume: parseFloat(e.target.value) }, function () { showToast('Volume updated', 'success'); });
});

document.getElementById('speed').addEventListener('change', function (e) {
  if (!currentProject) return;
  document.getElementById('speedVal').textContent = e.target.value + 'x';
  apiPost('/api/project/' + currentProject.id + '/speed', { speed: parseFloat(e.target.value), clipId: currentProject.timeline.clips[0].id }, function () { applyEffectsToPreview(); });
});

// Chroma Key
document.getElementById('applyChromaBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  var color = document.getElementById('chromaColor').value;
  var sim = parseFloat(document.getElementById('chromaSim').value);
  apiPost('/api/project/' + currentProject.id + '/effect', { type: 'chromakey', color: color, similarity: sim }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; applyEffectsToPreview(); updateActiveEffects(currentProject); showToast('Chroma key applied', 'success'); }
  });
});

document.getElementById('chromaSim').addEventListener('input', function () {
  document.getElementById('chromaSimVal').textContent = this.value;
});

// Transitions
document.querySelectorAll('.btn-transition').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (!currentProject) return showToast('Upload a video first', 'error');
    var type = btn.dataset.trans;
    apiPost('/api/project/' + currentProject.id + '/transition', { type: type, duration: 1, clipId: currentProject.timeline.clips[0].id }, function (d) {
      if (d.success) { currentProject.timeline = d.timeline; updateActiveEffects(currentProject); showToast(type + ' transition added', 'success'); }
    });
  });
});

// Text
document.getElementById('addTextBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  var text = document.getElementById('textInput').value;
  if (!text) return showToast('Enter text', 'error');
  apiPost('/api/project/' + currentProject.id + '/text', {
    text: text, x: parseInt(document.getElementById('textX').value) || 10,
    y: parseInt(document.getElementById('textY').value) || 10,
    fontsize: parseInt(document.getElementById('textSize').value) || 36,
    color: document.getElementById('textColor').value,
    startTime: 0, endTime: currentProject.duration
  }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; applyEffectsToPreview(); updateActiveEffects(currentProject); showToast('Text added', 'success'); document.getElementById('textInput').value = ''; }
  });
});

// Stickers
apiGet('/api/stickers', function (emojis) {
  var grid = document.getElementById('stickerGrid');
  emojis.forEach(function (emoji) {
    var btn = document.createElement('button');
    btn.className = 'sticker-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', function () {
      if (!currentProject) return showToast('Upload a video first', 'error');
      apiPost('/api/project/' + currentProject.id + '/sticker', { emoji: emoji, x: 100, y: 100, size: 64, startTime: 0, endTime: currentProject.duration }, function (d) {
        if (d.success) { currentProject.timeline = d.timeline; applyEffectsToPreview(); updateActiveEffects(currentProject); showToast(emoji + ' added', 'success'); }
      });
    });
    grid.appendChild(btn);
  });
});

// Speed Ramp
document.getElementById('applySpeedRampBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  var dur = currentProject.duration;
  var segments = [
    { start: 0, end: dur * 0.3, speed: 2 },
    { start: dur * 0.3, end: dur * 0.7, speed: 0.5 },
    { start: dur * 0.7, end: dur, speed: 2 }
  ];
  apiPost('/api/project/' + currentProject.id + '/speedramp', { segments: segments }, function (d) {
    if (d.success) showToast('Speed ramp applied!', 'success');
  });
});

// Reverse
document.getElementById('reverseBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  apiPost('/api/project/' + currentProject.id + '/reverse', { clipId: currentProject.timeline.clips[0].id }, function (d) {
    if (d.success) { currentProject.timeline = d.timeline; showToast('Reversed!', 'success'); }
  });
});

// Freeze Frame
document.getElementById('freezeFrameBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  showLoading('Creating freeze frame...');
  apiPost('/api/project/' + currentProject.id + '/freezeframe', { time: video.currentTime, duration: 3 }, function (d) {
    hideLoading();
    if (d.success) { currentProject.timeline = d.timeline; updateTimeline(currentProject); showToast('Freeze frame added!', 'success'); }
    else showToast('Failed: ' + (d.error || ''), 'error');
  });
});

// Zoom
var zoomEnabled = false;
document.getElementById('toggleZoomBtn').addEventListener('click', function () {
  if (!currentProject) return showToast('Upload a video first', 'error');
  zoomEnabled = !zoomEnabled;
  this.textContent = zoomEnabled ? 'Disable Zoom' : 'Enable Ken Burns';
  this.classList.toggle('active', zoomEnabled);
  apiPost('/api/project/' + currentProject.id + '/zoom', { enabled: zoomEnabled }, function () {
    showToast(zoomEnabled ? 'Zoom enabled' : 'Zoom disabled', 'success');
  });
});

// Export
exportBtn.addEventListener('click', function () {
  if (!currentProject) return;
  exportBtn.disabled = true;
  exportBtn.textContent = 'Exporting...';
  showLoading('Rendering video with all effects...');
  var format = document.getElementById('exportFormat').value;
  var quality = document.getElementById('exportQuality').value;
  apiPost('/api/project/' + currentProject.id + '/export', { format: format, quality: quality }, function (d) {
    hideLoading();
    exportBtn.disabled = false;
    exportBtn.textContent = 'Export';
    if (d.success) {
      showToast('Export complete!', 'success');
      var ext = format === 'webm' ? '.webm' : format === 'gif' ? '.gif' : '.mp4';
      var a = document.createElement('a');
      a.href = API + '/api/export/' + currentProject.id;
      a.download = currentProject.originalName + '_edited' + ext;
      a.click();
    } else showToast('Export failed: ' + (d.error || ''), 'error');
  });
});

loadProjects();
