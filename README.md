# ClipForge - AI Powered Video Editor

An **AI-powered video editor** that lets you edit videos using AI. Built with Node.js, Express, and FFmpeg. AI automatically edits videos through scripts, applies effects, transitions, and exports - all controlled programmatically by AI.

## What Makes This AI Powered

- **AI Auto-Edit Scripts** - AI generates and runs scripts to edit your videos automatically
- **MCP Server** - AI controls the editor via JSON-RPC: upload, edit, apply effects, export
- **AI Scene Detection** - Automatic scene change detection using I-frame analysis
- **AI Effect Selection** - AI picks the best effects and transitions for your content
- **AI Slideshow Generator** - AI creates slideshows from photos with transitions and music
- **Programmatic Editing** - Every edit operation is API-accessible for AI automation

## Features

### Effects (30+)
- **Basic**: Brightness, Contrast, Saturation, Speed, Volume
- **Blur**: Box blur, Gaussian, Motion, Lens blur
- **Color**: Grayscale, Sepia, Vintage, Warm, Cool, Invert
- **LUT Presets**: Cinematic, Warm, Cold, B&W High Contrast, Bleach Bypass, Cross Process
- **Stylized**: Glitch, Neon Glow, Emboss, Pixelate, RGB Split, Film Grain, Vignette
- **Transform**: Mirror, Flip, Kaleidoscope
- **Advanced**: Chroma Key, Color Key, Solarize, Posterize, Cartoon, Sketch

### Transitions (40+)
Fade, Fade Black, Fade White, Wipe, Slide, Smooth, Circle Open/Close, Zoom, Dissolve, Pixelize, Radial, Diagonal, Film, and more.

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

## AI Edit Scripts

The `ai video editor/scripts/` folder contains AI-powered edit scripts:

| Script | Description |
|--------|-------------|
| `sukuna_edit.js` | AI epic edit - applies 12 effects, chains xfade transitions, generates beat audio |
| `sukuna_simple.js` | AI simple slideshow - fast concat with fade transitions |
| `video_editor.js` | Core AI video editing engine |

### How AI Edits Videos

1. AI reads images/videos from the `custom upload/` folder
2. AI applies effects (zoom, glitch, cinematic, neon, etc.)
3. AI chains transitions between clips (fade, wipe, slide, dissolve)
4. AI generates beat-synced audio
5. AI exports the final polished video

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express 5 |
| Video Engine | FFmpeg (bundled via ffmpeg-static) |
| Frontend | HTML5 + CSS + Vanilla JS |
| Upload | Multer (500MB limit) |
| AI Control | MCP JSON-RPC server |
| Image Processing | Sharp |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/aarravhacker/clipforge-video-editor.git
cd clipforge-video-editor
npm install
```

### Running

**Video Editor (port 3040):**
```bash
npm start
```

**MCP AI Server (port 3001):**
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
clipforge-video-editor/
├── server.js                  # Main Express server (port 3040)
├── mcp-server.js              # AI MCP JSON-RPC server (port 3001)
├── package.json
├── public/
│   ├── index.html             # Video editor UI
│   ├── editor.html            # Photo editor UI
│   ├── app.js                 # Video editor frontend
│   ├── editor.js              # Photo editor frontend
│   ├── style.css              # Video editor styles
│   └── editor.css             # Photo editor styles
├── ai video editor/
│   ├── scripts/               # AI edit scripts
│   ├── video_editor.js        # AI video editing engine
│   └── clips/                 # AI working clips
├── uploads/                   # Uploaded videos (auto-created)
├── exports/                   # Exported videos (auto-created)
├── proxies/                   # 480p proxy previews (auto-created)
└── FEATURES.txt               # Detailed feature list
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
| POST | `/api/project/:id/ai/scene-detect` | AI scene detection |
| POST | `/api/project/:id/ai/upscale` | AI video upscaling |

## MCP AI Tools

The MCP server exposes these AI tools via JSON-RPC at `http://localhost:3001`:

`upload_video`, `list_projects`, `get_timeline`, `trim`, `split_clip`, `apply_effect`, `add_transition`, `add_text`, `add_sticker`, `set_speed`, `set_speed_ramp`, `reverse_clip`, `set_volume`, `set_zoom`, `set_keyframe`, `export_video`

## Author

**Aarav Hacker** - [GitHub](https://github.com/aarravhacker)

## License

ISC
