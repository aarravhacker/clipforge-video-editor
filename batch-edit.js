const http = require('http');
const path = require('path');
const fs = require('fs');

const MCP_URL = 'http://localhost:3001';
const CAPTURES_DIR = 'C:\\Users\\aarav\\Videos\\Captures';

function mcpCall(toolName, args) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    });
    const url = new URL(MCP_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: '/',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.result?.content?.[0]?.text;
          resolve(JSON.parse(text));
        } catch (e) {
          resolve({ error: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function editVideo(filePath, videoType) {
  const name = path.basename(filePath);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Processing: ${name}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Upload
  console.log('  → Uploading...');
  const upload = await mcpCall('upload_video', { filePath });
  if (upload.error) { console.log('  ✗ Upload failed:', upload.error); return; }
  const pid = upload.projectId;
  console.log(`  ✓ Uploaded (${upload.duration.toFixed(1)}s) - ID: ${pid}`);

  // Add effects based on video type
  if (videoType === 'code') {
    console.log('  → Adding effects: vintage + contrast...');
    await mcpCall('apply_effect', { projectId: pid, type: 'contrast', value: 1.3 });
    await mcpCall('apply_effect', { projectId: pid, type: 'saturation', value: 1.2 });
    await mcpCall('add_text', {
      projectId: pid, text: '💻 Coding Session', x: 20, y: 20,
      fontsize: 32, color: '#00ff88', startTime: 0, endTime: Math.min(3, upload.duration)
    });
    await mcpCall('add_text', {
      projectId: pid, text: 'Made with ClipForge', x: 20, y: 60,
      fontsize: 18, color: '#ffffff88', startTime: 0, endTime: 2
    });
  } else if (videoType === 'website') {
    console.log('  → Adding effects: brightness + blur vignette...');
    await mcpCall('apply_effect', { projectId: pid, type: 'brightness', value: 0.05 });
    await mcpCall('apply_effect', { projectId: pid, type: 'contrast', value: 1.2 });
    await mcpCall('add_text', {
      projectId: pid, text: '🌐 Website Preview', x: 20, y: 20,
      fontsize: 32, color: '#ff6b6b', startTime: 0, endTime: Math.min(3, upload.duration)
    });
    await mcpCall('add_text', {
      projectId: pid, text: 'Made with ClipForge', x: 20, y: 60,
      fontsize: 18, color: '#ffffff88', startTime: 0, endTime: 2
    });
  } else if (videoType === 'minecraft') {
    console.log('  → Adding effects: vintage + saturation...');
    await mcpCall('apply_effect', { projectId: pid, type: 'saturation', value: 1.4 });
    await mcpCall('apply_effect', { projectId: pid, type: 'contrast', value: 1.15 });
    await mcpCall('add_text', {
      projectId: pid, text: '⛏️ Minecraft', x: 20, y: 20,
      fontsize: 36, color: '#4ade80', startTime: 0, endTime: Math.min(3, upload.duration)
    });
    await mcpCall('add_text', {
      projectId: pid, text: 'Made with ClipForge', x: 20, y: 60,
      fontsize: 18, color: '#ffffff88', startTime: 0, endTime: 2
    });
  } else {
    console.log('  → Adding effects: contrast + saturation...');
    await mcpCall('apply_effect', { projectId: pid, type: 'contrast', value: 1.2 });
    await mcpCall('apply_effect', { projectId: pid, type: 'saturation', value: 1.15 });
    await mcpCall('add_text', {
      projectId: pid, text: '🎬 ' + name.substring(0, 20), x: 20, y: 20,
      fontsize: 28, color: '#60a5fa', startTime: 0, endTime: Math.min(3, upload.duration)
    });
    await mcpCall('add_text', {
      projectId: pid, text: 'Made with ClipForge', x: 20, y: 60,
      fontsize: 18, color: '#ffffff88', startTime: 0, endTime: 2
    });
  }

  // Add fade transition
  console.log('  → Adding fade transition...');
  await mcpCall('add_transition', { projectId: pid, type: 'fade', duration: 1 });

  // Add speed variation for Minecraft
  if (videoType === 'minecraft' && upload.duration > 30) {
    console.log('  → Setting speed to 1.25x...');
    await mcpCall('set_speed', { projectId: pid, speed: 1.25 });
  }

  // Export
  console.log('  → Exporting...');
  const result = await mcpCall('export_video', { projectId: pid });
  if (result.success) {
    console.log(`  ✓ Exported: ${result.exportPath}`);
  } else {
    console.log(`  ✗ Export failed: ${result.error}`);
  }

  return result;
}

async function main() {
  const files = fs.readdirSync(CAPTURES_DIR).filter(f => /\.(mp4|avi|mov|mkv|wmv|webm)$/i.test(f));
  console.log(`\n  Found ${files.length} videos to edit\n`);

  const edits = files.map(f => {
    const lower = f.toLowerCase();
    if (lower.includes('minecraft')) return { file: f, type: 'minecraft' };
    if (lower.includes('build.gradle') || lower.includes('code') || lower.includes('vscode') || lower.includes('visual studio')) return { file: f, type: 'code' };
    if (lower.includes('website') || lower.includes('planet') || lower.includes('space') || lower.includes('edge') || lower.includes('chrome')) return { file: f, type: 'website' };
    if (lower.includes('academy') || lower.includes('scroll')) return { file: f, type: 'school' };
    return { file: f, type: 'general' };
  });

  for (const edit of edits) {
    const filePath = path.join(CAPTURES_DIR, edit.file);
    await editVideo(filePath, edit.type);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  All videos edited!');
  console.log('  Check: video-editor/exports/');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(console.error);
