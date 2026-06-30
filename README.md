# ClipForge Video Editor

A full-stack, browser-based video editor built with Node.js, Express, and FFmpeg. Features 30+ visual effects, 11 transitions, text/sticker overlays, speed control, and an MCP server for AI-powered editing.

## Features

### Effects (30+)
- **Basic**: Brightness, Contrast, Saturation, Speed, Volume
- **Blur**: Box blur, Gaussian, Motion, Lens blur
- **Color**: Grayscale, Sepia, Vintage, Warm, Cool, Invert
- **LUT Presets**: Cinematic, Warm, Cold, B&W High Contrast, Bleach Bypass, Cross Process
- **Stylized**: Glitch, Neon Glow, Emboss, Pixelate, RGB Split, Film Grain, Vignette
- **Transform**: Mirror, Flip, Kaleidoscope
- **Advanced**: Chroma Key, Color Key

### Transitions
Fade, Fade Black, Fade White, Wipe (4 directions), Slide (4 directions), Smooth (4 directions), Circle Open/Close, Zoom In, Dissolve, Pixelize, Radial, Diagonal, and more.

### Timeline & Editing
- Drag & drop video upload
- Multi-project support
- Clip splitting at playhead
- Clip trimming and reordering
- Multi-track management (video, audio, overlay)

### Pro Features
- Speed control (0.25x - 4x) with speed ramping
- Reverse playback
- Freeze frame insertion
- Ken Burns zoom animation
- Keyframe animations (position, scale, rotation, opacity)
- Picture-in-Picture
- Background music with volume control
- Audio waveform visualization
- Watermark support

### Text & Overlays
- Custom text overlays with font size, color, and timing
- 30+ emoji sticker overlays

### AI Scene Detection
Automatic scene change detection using I-frame analysis.

### MCP Server
JSON-RPC server for AI-controlled editing - upload, apply effects, add transitions, and export videos programmatically.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express 5 |
| Video Engine | FFmpeg (bundled via ffmpeg-static) |
| Frontend | HTML5 + CSS + Vanilla JS |
| Upload | Multer (500MB limit) |
| AI Control | Custom JSON-RPC MCP server |
| Image Processing | Sharp |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/yourusername/clipforge-video-editor.git
cd clipforge-video-editor
npm install
```

### Running

**Video Editor (port 3040):**
```bash
npm start
```

**MCP Server (port 3001):**
```bash
npm run mcp
```

**Both:**
```bash
npm run dev
```

Open [http://localhost:3040](http://localhost:3040) in your browser.

## Project Structure

```
video-editor/
├── server.js              # Main Express server (port 3040)
├── mcp-server.js          # MCP JSON-RPC server (port 3001)
├── package.json
├── public/
│   ├── index.html         # Video editor UI
│   ├── editor.html        # Photo editor UI
│   ├── app.js             # Video editor frontend logic
│   ├── editor.js          # Photo editor frontend logic
│   ├── style.css          # Video editor styles
│   └── editor.css         # Photo editor styles
├── uploads/               # Uploaded videos (auto-created)
├── exports/               # Exported videos (auto-created)
├── proxies/               # 480p proxy previews (auto-created)
├── data/                  # Project persistence (auto-created)
└── FEATURES.txt           # Detailed feature list
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a video |
| GET | `/api/projects` | List all projects |
| GET | `/api/project/:id` | Get project details |
| POST | `/api/project/:id/trim` | Trim a clip |
| POST | `/api/project/:id/split` | Split clip at playhead |
| POST | `/api/project/:id/effect` | Apply visual effect |
| POST | `/api/project/:id/transition` | Add transition |
| POST | `/api/project/:id/text` | Add text overlay |
| POST | `/api/project/:id/sticker` | Add emoji sticker |
| POST | `/api/project/:id/speed` | Set clip speed |
| POST | `/api/project/:id/export` | Export final video |
| POST | `/api/project/:id/undo` | Undo last action |
| POST | `/api/project/:id/redo` | Redo last action |

## MCP Tools

The MCP server exposes these tools via JSON-RPC at `http://localhost:3001`:

`upload_video`, `list_projects`, `get_timeline`, `trim`, `split_clip`, `apply_effect`, `add_transition`, `add_text`, `add_sticker`, `set_speed`, `set_speed_ramp`, `reverse_clip`, `set_volume`, `set_zoom`, `set_keyframe`, `export_video`

## License

ISC
