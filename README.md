# Noteboard

Noteboard is a fast, lightweight, and touch-first **infinite canvas whiteboard** and digital note-taking application. It offers an expansive boundless workspace, smooth pressure-sensitive freehand drawing, smart shapes, inline text editing, marquee crop selection, a magic eraser for one-tap object removal, high-resolution Retina 2x image export, clipboard image pasting, and natural pinch-to-zoom at the cursor location.

---

## ✨ Features

- **Infinite Canvas Workspace**: Seamless 2D plane spanning infinitely in all directions with smooth pan, zoom, and dynamic grid rendering.
- **Natural Navigation**:
  - **Pinch-to-zoom** centered at mouse or touch position.
  - **Two-finger trackpad / touch pan**.
  - **Spacebar + Drag** temporary pan mode (standard Figma/Miro workflow).
  - **Fit to Content (`Shift + 1`)** & **Reset View (`0` / `Cmd+0`)**.
- **Smooth Pressure Drawing**: Powered by `perfect-freehand` for pressure-sensitive ink strokes and highlighter.
- **Smart Shapes & Text**: Rectangles, circles, straight lines, directional arrows, and double-clickable inline text blocks.
- **Object Selection & Manipulation**: Drag moving, corner resize handles, multi-item marquee box selection, and contextual layer arrangement (bring forward / send backward).
- **Magic Eraser**: Touch or drag over any object or stroke to instantly erase it.
- **Clipboard & Image Support**: Paste images directly from clipboard (`Cmd+V`) or upload from device.
- **HiDPI Retina Export**: Export the canvas auto-cropped to all content or capture the current viewport in PNG / JPG.
- **Dark Mode**: Fluid morphing between light paper and dark canvas themes.

---

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| `V` | Select / Transform Tool |
| `H` / `Space + Drag` | Pan Infinite Canvas |
| `P` | Pen Tool |
| `M` | Highlighter Tool |
| `E` | Pixel Eraser |
| `X` | Magic Object Eraser |
| `T` | Text Tool |
| `S` | Shape Tool |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` / `Cmd/Ctrl + Y` | Redo |
| `Cmd/Ctrl + A` | Select All Items |
| `Cmd/Ctrl + V` | Paste Image from Clipboard |
| `+` / `=` | Zoom In |
| `-` | Zoom Out |
| `0` | Reset Zoom (100%) |
| `Shift + 1` | Fit to Content |
| `Delete` / `Backspace` | Delete Selected Item(s) |
| `Escape` | Deselect All |

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ recommended) or [Bun](https://bun.sh/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/noteboard.git
   cd noteboard
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   # or
   pnpm install
   ```

### Running Locally

Start the local development server:

```bash
npm run dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Production Build

To create an optimized production build:

```bash
npm run build
npm run start
```
