# Aura Gallery

A professional ComfyUI image management system with advanced analytics and organization tools.

## Features

- **Image Management**: Upload, import (copy/move/reference), bulk delete, favorites
- **Advanced Filtering**: Filter by checkpoint, sampler, orientation, steps, CFG, date ranges, tags
- **Quick Tag Bar**: One-click filtering with multi-select tag support
- **Bulk Operations**: Tag and delete multiple images at once
- **Smart Import**: Automatic duplicate detection and filename collision handling
- **Browse Mode**: Keyboard navigation through images with metadata viewer
- **Advanced Analytics Dashboard**:
  - Quality metrics by checkpoint
  - Prompt analysis with word frequency
  - Checkpoint deep dive with performance stats
  - Time insights (monthly/weekly generation patterns)
  - Parameter analysis (optimal steps, CFG, samplers)
  - LoRA usage patterns
- **Multi-user Support**: Separate image libraries for different users

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: SQLite
- **Web Server**: nginx
- **Deployment**: Self-hosted on local network

## Project Structure
```
aura-gallery/
├── frontend/          # React frontend application
├── backend/           # Express API server
└── user_images/       # User image storage (not in git)
```

## Setup

### Prerequisites
- Node.js (v18+)
- nginx
- ComfyUI (for generating images)

### Backend Setup
```bash
cd backend
npm install
node server.js
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev       # Development
npm run build     # Production
```

### nginx Configuration
The app runs on `gallery.aura.thehulls.com` with nginx proxying to:
- Frontend: Served from `frontend/dist/`
- Backend API: Proxied to `localhost:3001`
- Images: Proxied to backend for serving

## Production Deployment

1. Build frontend: `npm run build`
2. Update nginx config
3. Reload nginx: `sudo nginx -s reload`
4. Start backend: `node server.js`

## Usage

Access the gallery at: `http://gallery.aura.thehulls.com`

Default users: `admin` / `home`

## Analytics

The Stats page provides comprehensive insights into your generation patterns, including:
- Most effective checkpoints and settings
- Prompt analysis and common keywords
- Generation patterns by time
- Parameter optimization recommendations

---

Built for managing AI-generated images from ComfyUI workflows.