const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

let currentTool = 'select';
let originalImage = null;
let layers = [];
let activeLayerIndex = 0;
let isDrawing = false;
let lastX = 0, lastY = 0;
let history = [];
let historyIndex = -1;
let currentFilter = 'none';
let adjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, sharpen: 0 };
let cropStart = null;
let cropRect = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// Upload
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.borderColor = '#e94560'; });
uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = '#2a2a38'; });
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.style.borderColor = '#2a2a38'; if (e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      originalImage = img;
      layers = [{ name: 'Background', imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), visible: true, opacity: 1, blendMode: 'source-over' }];
      activeLayerIndex = 0;
      uploadZone.classList.add('hidden');
      saveHistory();
      updateLayers();
      showToast('Image loaded!');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Tools
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    document.getElementById('textProps').style.display = currentTool === 'text' ? 'block' : 'none';
    document.getElementById('shapeProps').style.display = currentTool === 'shape' ? 'block' : 'none';
    document.getElementById('toolProps').style.display = (currentTool === 'brush' || currentTool === 'eraser') ? 'block' : 'none';
    canvas.style.cursor = currentTool === 'select' ? 'default' : 'crosshair';
  });
});

// Drawing
canvas.addEventListener('mousedown', e => {
  if (!originalImage) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (currentTool === 'brush' || currentTool === 'eraser') {
    isDrawing = true;
    lastX = x;
    lastY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (currentTool === 'text') {
    const text = prompt('Enter text:');
    if (text) {
      const size = parseInt(document.getElementById('fontSize').value) || 36;
      const font = document.getElementById('fontFamily').value;
      const bold = document.getElementById('fontBold').checked ? 'bold ' : '';
      const italic = document.getElementById('fontItalic').checked ? 'italic ' : '';
      ctx.font = italic + bold + size + 'px ' + font;
      ctx.fillStyle = document.getElementById('brushColor').value;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      saveHistory();
    }
  } else if (currentTool === 'shape') {
    isDrawing = true;
    lastX = x;
    lastY = y;
  } else if (currentTool === 'line') {
    isDrawing = true;
    lastX = x;
    lastY = y;
  } else if (currentTool === 'rotate') {
    rotateCanvas(90);
  } else if (currentTool === 'flip') {
    flipCanvas();
  } else if (currentTool === 'crop') {
    isDrawing = true;
    cropStart = { x, y };
    cropRect = null;
  }
});

canvas.addEventListener('mousemove', e => {
  if (!isDrawing || !originalImage) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  if (currentTool === 'brush') {
    ctx.strokeStyle = document.getElementById('brushColor').value;
    ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = parseInt(document.getElementById('brushOpacity').value) / 100;
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } else if (currentTool === 'crop' && isDrawing && cropStart) {
    redrawCanvas();
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cropStart.x, cropStart.y, x - cropStart.x, y - cropStart.y);
    ctx.setLineDash([]);
    cropRect = { x: Math.min(cropStart.x, x), y: Math.min(cropStart.y, y), w: Math.abs(x - cropStart.x), h: Math.abs(y - cropStart.y) };
  }

  lastX = x;
  lastY = y;
});

canvas.addEventListener('mouseup', e => {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentTool === 'shape') {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const w = x - lastX;
    const h = y - lastY;
    const color = document.getElementById('brushColor').value;
    const fill = document.getElementById('shapeFill').checked;
    const type = document.getElementById('shapeType').value;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = parseInt(document.getElementById('brushSize').value);

    if (type === 'rect') {
      ctx.rect(lastX, lastY, w, h);
    } else if (type === 'ellipse') {
      ctx.ellipse(lastX + w/2, lastY + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI * 2);
    } else if (type === 'circle') {
      const r = Math.sqrt(w*w + h*h);
      ctx.arc(lastX, lastY, r, 0, Math.PI * 2);
    }
    fill ? ctx.fill() : ctx.stroke();
  } else if (currentTool === 'line') {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.strokeStyle = document.getElementById('brushColor').value;
    ctx.lineWidth = parseInt(document.getElementById('brushSize').value);
    ctx.lineCap = 'round';
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (currentTool === 'crop' && cropRect && cropRect.w > 5 && cropRect.h > 5) {
    applyCrop(cropRect);
    cropRect = null;
    cropStart = null;
  }

  ctx.globalAlpha = 1;
  saveHistory();
});

canvas.addEventListener('mouseleave', () => { if (isDrawing) { isDrawing = false; saveHistory(); } });

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyFilters();
  });
});

// Adjustments
['brightness', 'contrast', 'saturation', 'hue', 'blur', 'sharpen'].forEach(id => {
  const slider = document.getElementById(id);
  const valEl = document.getElementById(id + 'Val');
  slider.addEventListener('input', () => { valEl.textContent = slider.value; });
  slider.addEventListener('change', () => {
    adjustments[id] = parseInt(slider.value);
    applyFilters();
  });
});

function applyFilters() {
  if (!originalImage) return;
  compositeToCanvas();
}

function applyFiltersBaked() {
  if (!originalImage) return;
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;

  var b = 1 + (adjustments.brightness / 100);
  var c = 1 + (adjustments.contrast / 100);
  var s = 1 + (adjustments.saturation / 100);
  var hueRad = adjustments.hue * Math.PI / 180;

  for (var i = 0; i < data.length; i += 4) {
    var r = data[i], g = data[i + 1], bl = data[i + 2];

    // Brightness
    r *= b; g *= b; bl *= b;

    // Contrast
    r = ((r / 255 - 0.5) * c + 0.5) * 255;
    g = ((g / 255 - 0.5) * c + 0.5) * 255;
    bl = ((bl / 255 - 0.5) * c + 0.5) * 255;

    // Saturation
    var gray = 0.2989 * r + 0.587 * g + 0.114 * bl;
    r = gray + s * (r - gray);
    g = gray + s * (g - gray);
    bl = gray + s * (bl - gray);

    // Hue rotation
    if (adjustments.hue !== 0) {
      var cos = Math.cos(hueRad), sin = Math.sin(hueRad);
      var rr = r * (cos + (1 - cos) / 3) + g * ((1 - cos) / 3 - Math.sqrt(3) / 3 * sin) + bl * ((1 - cos) / 3 + Math.sqrt(3) / 3 * sin);
      var gg = r * ((1 - cos) / 3 + Math.sqrt(3) / 3 * sin) + g * (cos + (1 - cos) / 3) + bl * ((1 - cos) / 3 - Math.sqrt(3) / 3 * sin);
      var bb = r * ((1 - cos) / 3 - Math.sqrt(3) / 3 * sin) + g * ((1 - cos) / 3 + Math.sqrt(3) / 3 * sin) + bl * (cos + (1 - cos) / 3);
      r = rr; g = gg; bl = bb;
    }

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, bl));
  }

  ctx.putImageData(imageData, 0, 0);
  canvas.style.filter = 'none';

  // Apply preset filter
  if (currentFilter !== 'none') {
    var filterData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var fd = filterData.data;

    if (currentFilter === 'grayscale') {
      for (var i = 0; i < fd.length; i += 4) {
        var avg = fd[i] * 0.299 + fd[i+1] * 0.587 + fd[i+2] * 0.114;
        fd[i] = fd[i+1] = fd[i+2] = avg;
      }
    } else if (currentFilter === 'sepia') {
      for (var i = 0; i < fd.length; i += 4) {
        var r = fd[i], g = fd[i+1], b = fd[i+2];
        fd[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        fd[i+1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        fd[i+2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
    } else if (currentFilter === 'vintage') {
      for (var i = 0; i < fd.length; i += 4) {
        var r = fd[i], g = fd[i+1], b = fd[i+2];
        fd[i] = Math.min(255, (r * 0.393 + g * 0.769 + b * 0.189) * 1.1);
        fd[i+1] = Math.min(255, (r * 0.349 + g * 0.686 + b * 0.168) * 0.9);
        fd[i+2] = Math.min(255, (r * 0.272 + g * 0.534 + b * 0.131) * 0.8);
      }
    } else if (currentFilter === 'warm') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = Math.min(255, fd[i] + 15);
        fd[i+2] = Math.max(0, fd[i+2] - 10);
      }
    } else if (currentFilter === 'cool') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = Math.max(0, fd[i] - 10);
        fd[i+2] = Math.min(255, fd[i+2] + 15);
      }
    } else if (currentFilter === 'dramatic') {
      for (var i = 0; i < fd.length; i += 4) {
        var avg = fd[i] * 0.299 + fd[i+1] * 0.587 + fd[i+2] * 0.114;
        var factor = 1.5;
        fd[i] = Math.max(0, Math.min(255, ((fd[i] / 255 - 0.5) * factor + 0.5) * 255));
        fd[i+1] = Math.max(0, Math.min(255, ((fd[i+1] / 255 - 0.5) * factor + 0.5) * 255));
        fd[i+2] = Math.max(0, Math.min(255, ((fd[i+2] / 255 - 0.5) * factor + 0.5) * 255));
      }
    } else if (currentFilter === 'fade') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = Math.min(255, fd[i] * 0.85 + 40);
        fd[i+1] = Math.min(255, fd[i+1] * 0.85 + 40);
        fd[i+2] = Math.min(255, fd[i+2] * 0.85 + 40);
      }
    } else if (currentFilter === 'noir') {
      for (var i = 0; i < fd.length; i += 4) {
        var avg = fd[i] * 0.299 + fd[i+1] * 0.587 + fd[i+2] * 0.114;
        var c = 1.6;
        var v = ((avg / 255 - 0.5) * c + 0.5) * 255 - 12;
        fd[i] = fd[i+1] = fd[i+2] = Math.max(0, Math.min(255, v));
      }
    } else if (currentFilter === 'dream') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = Math.min(255, fd[i] * 1.1 + 20);
        fd[i+1] = Math.min(255, fd[i+1] * 1.05 + 10);
        fd[i+2] = Math.min(255, fd[i+2] * 1.2 + 30);
        var avg = fd[i] * 0.299 + fd[i+1] * 0.587 + fd[i+2] * 0.114;
        fd[i] = fd[i] + (fd[i] - avg) * 0.3;
        fd[i+1] = fd[i+1] + (fd[i+1] - avg) * 0.3;
        fd[i+2] = fd[i+2] + (fd[i+2] - avg) * 0.3;
      }
    } else if (currentFilter === 'popart') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = fd[i] > 128 ? 255 : 0;
        fd[i+1] = fd[i+1] > 128 ? 255 : 0;
        fd[i+2] = fd[i+2] > 128 ? 255 : 0;
      }
    } else if (currentFilter === 'solarize') {
      for (var i = 0; i < fd.length; i += 4) {
        fd[i] = fd[i] > 128 ? 255 - fd[i] : fd[i];
        fd[i+1] = fd[i+1] > 128 ? 255 - fd[i+1] : fd[i+1];
        fd[i+2] = fd[i+2] > 128 ? 255 - fd[i+2] : fd[i+2];
      }
    }

    ctx.putImageData(filterData, 0, 0);
  }
}

// Transform
function rotateCanvas(deg) {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (deg === 90 || deg === -90) {
    tempCanvas.width = canvas.height;
    tempCanvas.height = canvas.width;
  } else {
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
  }
  tempCtx.translate(tempCanvas.width/2, tempCanvas.height/2);
  tempCtx.rotate(deg * Math.PI / 180);
  tempCtx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
  canvas.width = tempCanvas.width;
  canvas.height = tempCanvas.height;
  ctx.drawImage(tempCanvas, 0, 0);
  saveHistory();
  showToast('Rotated ' + deg + '°');
}

function flipCanvas() {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.translate(canvas.width, 0);
  tempCtx.scale(-1, 1);
  tempCtx.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tempCanvas, 0, 0);
  saveHistory();
  showToast('Flipped!');
}

function applyCrop(rect) {
  if (rect.w < 1 || rect.h < 1) return;
  const cropped = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
  canvas.width = rect.w;
  canvas.height = rect.h;
  ctx.putImageData(cropped, 0, 0);
  layers = [{ name: 'Background', imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), visible: true, opacity: 1, blendMode: 'source-over' }];
  activeLayerIndex = 0;
  updateLayers();
  saveHistory();
  showToast('Cropped!');
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  layers.forEach(function (layer) {
    if (!layer.visible || !layer.imageData) return;
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode || 'source-over';
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.putImageData(layer.imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function compositeToCanvas() {
  redrawCanvas();
  applyFiltersBaked();
}

// History
function saveHistory() {
  history = history.slice(0, historyIndex + 1);
  history.push(canvas.toDataURL());
  historyIndex = history.length - 1;
  if (history.length > 50) { history.shift(); historyIndex--; }
}

document.getElementById('undoBtn').addEventListener('click', () => {
  if (historyIndex > 0) {
    historyIndex--;
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
    img.src = history[historyIndex];
  }
});

document.getElementById('redoBtn').addEventListener('click', () => {
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const img = new Image();
    img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
    img.src = history[historyIndex];
  }
});

// Reset
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!originalImage) return;
  canvas.width = originalImage.width;
  canvas.height = originalImage.height;
  ctx.drawImage(originalImage, 0, 0);
  canvas.style.filter = 'none';
  currentFilter = 'none';
  adjustments = { brightness: 0, contrast: 0, saturation: 0, hue: 0, blur: 0, sharpen: 0 };
  ['brightness', 'contrast', 'saturation', 'hue', 'blur', 'sharpen'].forEach(id => {
    document.getElementById(id).value = 0;
    document.getElementById(id + 'Val').textContent = '0';
  });
  layers = [{ name: 'Background', imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), visible: true, opacity: 1, blendMode: 'source-over' }];
  activeLayerIndex = 0;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="none"]').classList.add('active');
  updateLayers();
  saveHistory();
  showToast('Reset!');
});

// Export
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!originalImage) return showToast('No image loaded');
  compositeToCanvas();
  var format = document.getElementById('exportFormat') ? document.getElementById('exportFormat').value : 'png';
  var quality = document.getElementById('exportQuality') ? parseInt(document.getElementById('exportQuality').value) / 100 : 1;
  var mimeType = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  var link = document.createElement('a');
  link.download = 'clipforge_edit_' + Date.now() + '.' + (format === 'jpg' ? 'jpg' : format);
  link.href = canvas.toDataURL(mimeType, quality);
  link.click();
  showToast('Image exported as ' + format.toUpperCase() + '!');
});

// Layers
function updateLayers() {
  const list = document.getElementById('layersList');
  list.innerHTML = '';
  layers.forEach((layer, i) => {
    const div = document.createElement('div');
    div.className = 'layer-item' + (i === activeLayerIndex ? ' active' : '');
    div.draggable = true;
    div.dataset.index = i;

    var thumb = document.createElement('canvas');
    thumb.className = 'layer-thumb';
    thumb.width = 40;
    thumb.height = 30;
    if (layer.imageData) {
      var tCtx = thumb.getContext('2d');
      var tc = document.createElement('canvas');
      tc.width = canvas.width;
      tc.height = canvas.height;
      tc.getContext('2d').putImageData(layer.imageData, 0, 0);
      tCtx.drawImage(tc, 0, 0, 40, 30);
    }

    var nameSpan = document.createElement('span');
    nameSpan.className = 'layer-name';
    nameSpan.textContent = layer.name;

    var visBtn = document.createElement('button');
    visBtn.className = 'layer-vis' + (layer.visible ? ' visible' : '');
    visBtn.textContent = layer.visible ? '👁' : '🚫';
    visBtn.title = 'Toggle visibility';
    visBtn.onclick = function (e) {
      e.stopPropagation();
      layer.visible = !layer.visible;
      redrawCanvas();
      updateLayers();
    };

    var opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.className = 'layer-opacity';
    opacitySlider.min = '0';
    opacitySlider.max = '100';
    opacitySlider.value = Math.round(layer.opacity * 100);
    opacitySlider.title = 'Opacity: ' + Math.round(layer.opacity * 100) + '%';
    opacitySlider.onclick = function (e) { e.stopPropagation(); };
    opacitySlider.oninput = function () {
      layer.opacity = parseInt(this.value) / 100;
      this.title = 'Opacity: ' + this.value + '%';
      redrawCanvas();
    };

    var delBtn = document.createElement('button');
    delBtn.className = 'layer-del';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete layer';
    delBtn.onclick = function (e) {
      e.stopPropagation();
      if (layers.length <= 1) return showToast('Cannot delete last layer');
      layers.splice(i, 1);
      if (activeLayerIndex >= layers.length) activeLayerIndex = layers.length - 1;
      redrawCanvas();
      updateLayers();
    };

    div.appendChild(thumb);
    div.appendChild(nameSpan);
    div.appendChild(opacitySlider);
    div.appendChild(visBtn);
    div.appendChild(delBtn);

    div.onclick = () => { activeLayerIndex = i; updateLayers(); };

    // Drag reorder
    div.ondragstart = function (e) { e.dataTransfer.setData('text/plain', i); };
    div.ondragover = function (e) { e.preventDefault(); div.style.borderTop = '2px solid #e94560'; };
    div.ondragleave = function () { div.style.borderTop = ''; };
    div.ondrop = function (e) {
      e.preventDefault();
      div.style.borderTop = '';
      var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      if (fromIdx !== i) {
        var moved = layers.splice(fromIdx, 1)[0];
        layers.splice(i, 0, moved);
        if (activeLayerIndex === fromIdx) activeLayerIndex = i;
        else if (fromIdx < activeLayerIndex && i >= activeLayerIndex) activeLayerIndex--;
        else if (fromIdx > activeLayerIndex && i <= activeLayerIndex) activeLayerIndex++;
        redrawCanvas();
        updateLayers();
      }
    };

    list.appendChild(div);
  });
}

document.getElementById('addLayerBtn').addEventListener('click', () => {
  if (!originalImage) return;
  var tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  var tempCtx = tempCanvas.getContext('2d');
  layers.push({
    name: 'Layer ' + (layers.length + 1),
    imageData: tempCtx.getImageData(0, 0, canvas.width, canvas.height),
    visible: true,
    opacity: 1,
    blendMode: 'source-over'
  });
  activeLayerIndex = layers.length - 1;
  updateLayers();
  showToast('Layer added');
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); document.getElementById('undoBtn').click(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); document.getElementById('redoBtn').click(); }
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); document.getElementById('exportBtn').click(); }
});

// Blend mode
document.getElementById('blendMode').addEventListener('change', function () {
  if (layers[activeLayerIndex]) {
    layers[activeLayerIndex].blendMode = this.value;
    redrawCanvas();
  }
});

// AI Tools
document.getElementById('aiAutoColor').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (var i = 0; i < data.length; i += 4) {
    if (data[i] < rMin) rMin = data[i]; if (data[i] > rMax) rMax = data[i];
    if (data[i+1] < gMin) gMin = data[i+1]; if (data[i+1] > gMax) gMax = data[i+1];
    if (data[i+2] < bMin) bMin = data[i+2]; if (data[i+2] > bMax) bMax = data[i+2];
  }
  for (var i = 0; i < data.length; i += 4) {
    data[i] = rMax > rMin ? ((data[i] - rMin) / (rMax - rMin)) * 255 : data[i];
    data[i+1] = gMax > gMin ? ((data[i+1] - gMin) / (gMax - gMin)) * 255 : data[i+1];
    data[i+2] = bMax > bMin ? ((data[i+2] - bMin) / (bMax - bMin)) * 255 : data[i+2];
  }
  ctx.putImageData(imageData, 0, 0);
  layers[activeLayerIndex].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  saveHistory();
  showToast('Auto color corrected!');
});

document.getElementById('aiSmartCrop').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
  var threshold = 20;
  for (var y = 0; y < canvas.height; y++) {
    for (var x = 0; x < canvas.width; x++) {
      var idx = (y * canvas.width + x) * 4;
      var avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
      if (avg > threshold && avg < 235) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  var pad = 20;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width - 1, maxX + pad);
  maxY = Math.min(canvas.height - 1, maxY + pad);
  if (maxX > minX && maxY > minY) {
    applyCrop({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
  }
  showToast('Smart cropped!');
});

document.getElementById('aiBgRemove').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var data = imageData.data;
  var corners = [
    [data[0], data[1], data[2]],
    [data[(canvas.width-1)*4], data[(canvas.width-1)*4+1], data[(canvas.width-1)*4+2]],
    [data[(canvas.height-1)*canvas.width*4], data[(canvas.height-1)*canvas.width*4+1], data[(canvas.height-1)*canvas.width*4+2]],
    [data[(canvas.height*canvas.width-1)*4], data[(canvas.height*canvas.width-1)*4+1], data[(canvas.height*canvas.width-1)*4+2]]
  ];
  var bgR = (corners[0][0]+corners[1][0]+corners[2][0]+corners[3][0])/4;
  var bgG = (corners[0][1]+corners[1][1]+corners[2][1]+corners[3][1])/4;
  var bgB = (corners[0][2]+corners[1][2]+corners[2][2]+corners[3][2])/4;
  var threshold = 60;
  for (var i = 0; i < data.length; i += 4) {
    var dist = Math.sqrt(Math.pow(data[i]-bgR,2)+Math.pow(data[i+1]-bgG,2)+Math.pow(data[i+2]-bgB,2));
    if (dist < threshold) data[i+3] = 0;
  }
  ctx.putImageData(imageData, 0, 0);
  layers[activeLayerIndex].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  saveHistory();
  showToast('Background removed!');
});

document.getElementById('aiStyleMonet').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  adjustments = { brightness: 10, contrast: -15, saturation: 20, hue: 10, blur: 1, sharpen: 0 };
  currentFilter = 'warm';
  compositeToCanvas();
  layers[activeLayerIndex].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  saveHistory();
  showToast('Monet style applied!');
});

document.getElementById('aiStyleVanGogh').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  adjustments = { brightness: 5, contrast: 40, saturation: 60, hue: 20, blur: 0, sharpen: 3 };
  currentFilter = 'warm';
  compositeToCanvas();
  layers[activeLayerIndex].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  saveHistory();
  showToast('Van Gogh style applied!');
});

document.getElementById('aiStylePopArt').addEventListener('click', function () {
  if (!originalImage) return showToast('No image loaded');
  adjustments = { brightness: 10, contrast: 50, saturation: 80, hue: 0, blur: 0, sharpen: 1 };
  currentFilter = 'popart';
  compositeToCanvas();
  layers[activeLayerIndex].imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  saveHistory();
  showToast('Pop Art style applied!');
});

// Slider value updates
document.getElementById('brushSize').addEventListener('input', function() { document.getElementById('brushSizeVal').textContent = this.value; });
document.getElementById('brushOpacity').addEventListener('input', function() { document.getElementById('brushOpacityVal').textContent = this.value + '%'; });
