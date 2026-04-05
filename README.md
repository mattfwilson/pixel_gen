# Pixel Gen

Convert images to Figma-ready pixel art vectors.

## Features

- Upload JPG, PNG, or SVG images
- Adjustable pixel scale (1-50x)
- Live preview of pixelated output
- Color filtering - export only selected colors
- Direct export to Figma via API
- Max output: 100×100 pixels (10,000 shapes)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000)

## Usage

### 1. Upload Image
- Click "Upload Image" and select a JPG, PNG, or SVG file
- Adjust pixel scale slider (higher = coarser/fewer shapes)

### 2. Filter Colors (Optional)
- Click color swatches to include/exclude specific colors
- Use "Select All" / "Deselect All" for bulk actions
- Preview updates in real-time

### 3. Export to Figma
You'll need:
- **Figma Access Token**: Get from [Account Settings → Personal Access Tokens](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens)
- **File Key**: From your Figma file URL `figma.com/file/FILE_KEY/...`

Enter both and click "Export to Figma". The pixel art will be created as a frame with individual vector rectangles.

## Technical Details

- Built with Next.js 14, React, TypeScript, Tailwind CSS
- Client-side image processing via Canvas API
- Each pixel becomes a 10×10 rectangle in Figma
- Color filtering preserves all unique colors until export

## Limitations

- Output capped at 100×100 pixels (10,000 shapes) for Figma performance
- Figma API has rate limits - avoid exporting very frequently
- SVGs are rasterized before pixelation (vector data is lost)
