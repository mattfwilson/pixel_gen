# Aseprite Export Implementation Plan

## Overview
Implement client-side .aseprite binary file export for the pixel generator, allowing users to open their pixelated images directly in Aseprite for further editing.

## Milestone Structure

### Dependencies
- Parent: None (new feature)
- Blocks: None
- Risk: Medium (binary format implementation, new compression library)

### Success Criteria
1. User can click "Download .aseprite" button
2. Browser downloads a valid .aseprite file
3. File opens in Aseprite without errors
4. Image dimensions, colors, and pixels match the preview
5. File size is reasonable (<10KB for typical scale-mode grids, <100KB for max 200×200 exact-mode grids)
6. Export respects color filtering (selectedColors)

### Definition of Done
- [ ] All tasks complete and verified
- [ ] Manual testing in Aseprite successful (8×8, 16×16, 32×32, 64×64)
- [ ] UI integrated and matches existing export pattern
- [ ] No console errors or warnings
- [ ] Documentation updated

---

## Task Breakdown

### T01: Install Dependencies and Setup
**Estimate**: 15 minutes

**Description**:
Install the fflate compression library and verify it works in the Next.js build.

**⚠️ Pre-requisite**: Before writing any code, read the Next.js guides in `node_modules/next/dist/docs/` per `AGENTS.md`. This project uses Next.js 16.2.2, which has breaking changes from earlier versions. Verify client component patterns, import conventions, and any deprecations before proceeding.

**Steps**:
1. Read Next.js 16 docs in `node_modules/next/dist/docs/` — note any breaking changes to client components, imports, or build behavior
2. Install fflate: `npm install fflate`
3. Create placeholder file `lib/asepriteWriter.ts` with basic imports
4. Verify Next.js build still works
5. Test that fflate imports correctly in a client component

**Files**:
- `package.json` (modified)
- `lib/asepriteWriter.ts` (created)

**Verify**:
```bash
npm run dev
# No build errors
```

**Inputs**:
- `ASEPRITE_EXPORT_RESEARCH.md` (dependency requirements)

**Expected Output**:
- `package.json` with `fflate` dependency
- `lib/asepriteWriter.ts` skeleton file
- Clean dev server startup

---

### T02: Implement Binary Writer Utilities
**Estimate**: 2-3 hours

**Description**:
Create low-level utilities for writing binary data in little-endian format, following the Aseprite spec. These are the building blocks for all chunks and headers.

**Steps**:
1. Create `BinaryWriter` class with DataView-backed buffer
2. Implement methods:
   - `writeByte(value: number)` - 8-bit unsigned
   - `writeWord(value: number)` - 16-bit unsigned
   - `writeShort(value: number)` - 16-bit signed
   - `writeDword(value: number)` - 32-bit unsigned
   - `writeLong(value: number)` - 32-bit signed
   - `writeString(value: string)` - length-prefixed UTF-8
   - `writeBytes(bytes: Uint8Array)` - raw byte array
   - `getBuffer(): ArrayBuffer` - finalize and return
3. Add position tracking and auto-resize logic
4. Add helper: `writeChunkHeader(type: number, size: number)`
   - **CRITICAL**: `size` must be the total chunk size including the 6-byte header (4-byte DWORD size + 2-byte WORD type). Every chunk generator must compute `size = 6 + data_length`. Aseprite uses this value to seek to the next chunk — wrong values corrupt the file.
5. Write JSDoc comments explaining byte order

**Files**:
- `lib/asepriteWriter.ts`

**Verify**:
```typescript
// Manual test in browser console or component
const writer = new BinaryWriter();
writer.writeWord(0xA5E0); // Magic number
writer.writeDword(1024); // File size
const buffer = writer.getBuffer();
console.log(new Uint8Array(buffer)); // Should show [224, 165, 0, 4, 0, 0] (decimal) or E0 A5 00 04 00 00 (hex)
```

**Inputs**:
- Aseprite file spec: byte order, data types
- Reference: `docs/ase-file-specs.md` (from research)

**Expected Output**:
- `lib/asepriteWriter.ts` with complete `BinaryWriter` class
- All methods handle little-endian correctly
- Buffer auto-resizes as needed

**Observability Impact**:
- Console logs for buffer size and position during development (remove in final)

---

### T03: Implement Header Generator
**Estimate**: 1-2 hours

**Description**:
Generate the 128-byte Aseprite file header with correct dimensions, color depth, and metadata.

**Steps**:
1. Create `generateHeader(width: number, height: number): Uint8Array`
2. Write all header fields in order:
   - File size (placeholder, will be updated later)
   - Magic number: 0xA5E0
   - Frames: 1
   - Width, Height (from params)
   - Color depth: 32 (RGBA)
   - Flags: 1 (bit 0 = layer opacity valid; Aseprite ignores layer opacity if this is 0)
   - Speed: 100 (deprecated, but required)
   - Reserved fields (zeros)
   - Transparent color index: 0
   - Number of colors: actual palette size (NOTE: 0 means 256 per spec, not "no palette")
   - Pixel ratio: 1:1
   - Grid: 0,0,0,0 (no grid)
   - Padding: 84 bytes of zeros
3. Verify total size is exactly 128 bytes
4. Add JSDoc with field offsets for debugging

**Files**:
- `lib/asepriteWriter.ts`

**Verify**:
```typescript
const header = generateHeader(32, 32);
console.assert(header.length === 128, 'Header must be 128 bytes');
console.assert(header[4] === 0xE0 && header[5] === 0xA5, 'Magic number incorrect');
```

**Inputs**:
- `pixelGrid.width`, `pixelGrid.height`
- Aseprite header spec

**Expected Output**:
- `generateHeader()` function
- 128-byte header with valid structure

---

### T04: Implement Palette Chunk Generator
**Estimate**: 1 hour

**Description**:
Generate the Palette Chunk (0x2019) from the pixel grid's unique colors.

**Steps**:
1. Create `generatePaletteChunk(colors: string[]): Uint8Array`
2. Chunk structure:
   - Chunk size (DWORD) — **includes the 6-byte chunk header (size + type fields)**
   - Chunk type: 0x2019 (WORD)
   - Palette size: colors.length (DWORD)
   - First color index: 0 (DWORD)
   - Last color index: colors.length - 1 (DWORD)
   - Reserved: 8 bytes of zeros
   - For each color entry (6 bytes each):
     - Flags: 0 (WORD — 2 bytes, not BYTE; set to 1 if entry has a name string)
     - R (BYTE), G (BYTE), B (BYTE), A (BYTE) = 255
3. Calculate chunk size correctly (including size field itself)
4. Handle empty palette edge case

**Files**:
- `lib/asepriteWriter.ts`

**Verify**:
```typescript
const palette = generatePaletteChunk(['#FF0000', '#00FF00', '#0000FF']);
// Should have 3 color entries, each 4 bytes (RGBA)
```

**Inputs**:
- `pixelGrid.uniqueColors` (hex color strings)

**Expected Output**:
- `generatePaletteChunk()` function
- Valid palette chunk binary data

---

### T05: Implement Layer Chunk Generator
**Estimate**: 45 minutes

**Description**:
Generate the Layer Chunk (0x2004) for a single "Background" layer.

**Steps**:
1. Create `generateLayerChunk(name: string = 'Background'): Uint8Array`
2. Chunk structure:
   - Chunk size (DWORD) — **includes the 6-byte chunk header (size + type fields)**
   - Chunk type: 0x2004 (WORD)
   - Flags: 1 (visible) (WORD)
   - Layer type: 0 (normal image layer) (WORD)
   - Child level: 0 (WORD)
   - Default width: 0 (ignored) (WORD)
   - Default height: 0 (ignored) (WORD)
   - Blend mode: 0 (Normal) (WORD)
   - Opacity: 255 (BYTE)
   - Reserved: 3 bytes zeros
   - Layer name: STRING (WORD length prefix + UTF-8 bytes, NO null terminator)
3. No tileset index (layer type = 0)
4. No UUID (flags bit 4 not set in header)

**Files**:
- `lib/asepriteWriter.ts`

**Verify**:
```typescript
const layer = generateLayerChunk('Pixel Art');
// Verify chunk type is 0x2004
// Verify layer name is encoded correctly
```

**Inputs**:
- Layer name (default: "Background")

**Expected Output**:
- `generateLayerChunk()` function
- Valid layer chunk

---

### T06: Implement Pixel Data Converter and Cel Chunk
**Estimate**: 2-3 hours

**Description**:
Convert PixelGrid to RGBA byte array, compress with zlib, and wrap in Cel Chunk (0x2005).

**Steps**:
1. Create `pixelGridToRGBA(grid: PixelGrid, selectedColors?: string[]): Uint8Array`
   - Create width × height × 4 byte array (RGBA)
   - **Build a coordinate lookup map first**: `Map<string, Pixel>` keyed on `"x,y"` from `grid.pixels` — avoids O(n) linear scan per pixel
   - For each pixel position (y then x, row-major order):
     - Look up `"x,y"` in the coordinate map
     - If found and color is in selectedColors (or no filter):
       - Parse hex color → RGB
       - Set alpha = 255
     - Else (missing from map or filtered out):
       - Set RGBA = [0, 0, 0, 0] (transparent)
   - Note: `grid.pixels` is sparse — not every (x,y) has an entry. Missing coordinates = transparent.
   - Return row-by-row, left-to-right byte array
2. Create `generateCelChunk(width: number, height: number, rawPixels: Uint8Array): Uint8Array`
   - Compress rawPixels with fflate: `zlibSync(rawPixels)` — **must use `zlibSync`, NOT `deflateSync`**. Aseprite's decoder calls `inflateInit()` which expects the zlib wrapper (2-byte header + DEFLATE + 4-byte Adler-32). Raw DEFLATE without the wrapper will fail.
   - Chunk structure:
     - Chunk size (DWORD) — **includes the 6-byte chunk header (size + type fields)**
     - Chunk type: 0x2005 (WORD)
     - Layer index: 0 (WORD)
     - X position: 0 (SHORT)
     - Y position: 0 (SHORT)
     - Opacity: 255 (BYTE)
     - Cel type: 2 (Compressed Image) (WORD)
     - Z-Index: 0 (SHORT)
     - Reserved: 5 bytes zeros
     - Width (WORD)
     - Height (WORD)
     - Compressed pixel data (BYTE[])
3. Handle compression errors
4. Add console logging for compressed size vs raw size

**Files**:
- `lib/asepriteWriter.ts`

**Verify**:
```typescript
const testGrid: PixelGrid = {
  width: 2, height: 2,
  pixels: [
    {x: 0, y: 0, color: '#FF0000'},
    {x: 1, y: 0, color: '#00FF00'},
    {x: 0, y: 1, color: '#0000FF'},
    {x: 1, y: 1, color: '#FFFF00'}
  ],
  uniqueColors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00']
};
const rgba = pixelGridToRGBA(testGrid);
console.assert(rgba.length === 2 * 2 * 4, 'RGBA size incorrect');
console.assert(rgba[0] === 255 && rgba[1] === 0 && rgba[2] === 0, 'First pixel should be red');
```

**Inputs**:
- `pixelGrid.pixels`, `pixelGrid.width`, `pixelGrid.height`
- `selectedColors` (optional filter)

**Expected Output**:
- `pixelGridToRGBA()` function
- `generateCelChunk()` function
- Compressed pixel data

**Observability Impact**:
- Log compression ratio: `console.log('Compressed:', compressed.length, 'from', raw.length)`

---

### T07: Implement Frame Generator and File Assembly
**Estimate**: 1-2 hours

**Description**:
Assemble all chunks into a frame, wrap in frame header, combine with file header, and return complete .aseprite file.

**Steps**:
1. Create `generateFrame(chunks: Uint8Array[]): Uint8Array`
   - Calculate total frame size (16 + sum of chunk sizes)
   - Frame header:
     - Bytes in frame (DWORD)
     - Magic: 0xF1FA (WORD)
     - Old chunks field: min(chunks.length, 0xFFFF) (WORD)
     - Frame duration: 100 ms (WORD)
     - Reserved: 2 bytes zeros
     - New chunks field: chunks.length (DWORD) — actual count; Aseprite's own writer populates both fields
   - Append all chunks
2. Create `generateAsepriteFile(pixelGrid: PixelGrid, selectedColors?: string[]): ArrayBuffer`
   - Generate header (with placeholder file size)
   - Generate color profile chunk (0x2007): sRGB profile (~20 bytes, ensures correct color interpretation)
   - Generate layer chunk (must come before cel chunk — cel references layer by index)
   - Generate palette chunk
   - Generate cel chunk
   - **Assemble frame chunks in this order**: Color Profile → Layer → Palette → Cel (matches Aseprite spec expectations)
   - Generate frame from ordered chunks
   - Combine header + frame
   - Update file size in header (offset 0)
   - Return ArrayBuffer

   **Export boundary**: `asepriteWriter.ts` exports the following public functions for `exportAseprite.ts` to consume:
   - `BinaryWriter` class
   - `generateHeader()`
   - `generateColorProfileChunk()`
   - `generateLayerChunk()`
   - `generatePaletteChunk()`
   - `generateCelChunk()`
   - `generateFrame()`
   - `pixelGridToRGBA()`

   All other helpers remain internal to `asepriteWriter.ts`.

3. Add validation: throw if dimensions are 0 or pixels array is empty

**Files**:
- `lib/exportAseprite.ts` (create - high-level export function)
- `lib/asepriteWriter.ts` (frame/assembly functions)

**Verify**:
```typescript
const testGrid: PixelGrid = { /* ... */ };
const fileBuffer = generateAsepriteFile(testGrid);
console.assert(fileBuffer.byteLength > 128, 'File should be larger than header');
// Check magic number at offset 4-5
const view = new DataView(fileBuffer);
console.assert(view.getUint16(4, true) === 0xA5E0, 'Magic number incorrect');
```

**Inputs**:
- All chunk generators (T03-T06)
- `pixelGrid`, `selectedColors`

**Expected Output**:
- `generateFrame()` function
- `generateAsepriteFile()` function in `lib/exportAseprite.ts`
- Complete binary .aseprite file

---

### T08: Implement Download Function
**Estimate**: 30 minutes

**Description**:
Trigger browser download of the .aseprite ArrayBuffer as a file.

**Steps**:
1. In `lib/exportAseprite.ts`, create `downloadAseprite(fileBuffer: ArrayBuffer, filename: string = 'pixel-art.aseprite')`
2. Create Blob from ArrayBuffer with type `application/octet-stream`
3. Create object URL: `URL.createObjectURL(blob)`
4. Create temporary anchor element
5. Set href and download attribute
6. Trigger click
7. Clean up: remove element, revoke URL
8. Pattern match existing `downloadSvg()` in `lib/exportSvg.ts`

**Files**:
- `lib/exportAseprite.ts`

**Verify**:
```typescript
// In browser console
const buffer = generateAsepriteFile(testGrid);
downloadAseprite(buffer, 'test.aseprite');
// File should download
```

**Inputs**:
- ArrayBuffer from `generateAsepriteFile()`
- Desired filename

**Expected Output**:
- `downloadAseprite()` function
- Browser downloads .aseprite file

---

### T09: Create AsepriteExport Component
**Estimate**: 45 minutes

**Description**:
Create React component for the Aseprite export UI, matching the pattern of SvgDownload.

**Steps**:
1. Create `components/AsepriteExport.tsx`
2. Component props:
   ```typescript
   interface AsepriteExportProps {
     pixelGrid: PixelGrid;
     selectedColors?: string[];
     disabled?: boolean;
   }
   ```
3. Render:
   - Single button: "Download .aseprite"
   - Styling matches SvgDownload button
   - onClick handler calls `downloadAseprite(generateAsepriteFile(...))`
4. Add 'use client' directive
5. Handle errors with try/catch + alert (consistent with existing pattern)

**Files**:
- `components/AsepriteExport.tsx` (created)

**Verify**:
```typescript
// In page.tsx during development
{pixelGrid && (
  <AsepriteExport
    pixelGrid={pixelGrid}
    selectedColors={selectedColors}
  />
)}
```

**Inputs**:
- `pixelGrid` from parent state
- `selectedColors` from parent state
- Export functions from T07-T08

**Expected Output**:
- `AsepriteExport.tsx` component
- Button renders correctly

---

### T10: Integrate into Export Section UI
**Estimate**: 30 minutes

**Description**:
Add AsepriteExport component to the export section in page.tsx, alongside SVG and Figma export.

**Steps**:
1. Import `AsepriteExport` in `app/page.tsx`
2. Add to export section (below SVG download):
   ```tsx
   <AsepriteExport
     pixelGrid={pixelGrid}
     selectedColors={selectedColors.length > 0 ? selectedColors : undefined}
     disabled={processing || selectedColors.length === 0}
   />
   ```
3. Add divider between SVG and Aseprite (match existing "or" divider pattern)
4. Ensure layout is responsive
5. Test disabled state

**Files**:
- `app/page.tsx` (modified)

**Verify**:
- Visit http://localhost:3000
- Upload image
- Export section shows: SVG, Aseprite, Figma (in that order)
- Aseprite button is disabled when no colors selected
- Aseprite button is disabled during processing

**Inputs**:
- Existing export section layout
- `AsepriteExport` component from T09

**Expected Output**:
- Export section with Aseprite button
- Button enables/disables correctly
- Layout is clean and consistent

---

### T11: End-to-End Testing and Validation
**Estimate**: 2-3 hours

**Description**:
Test the complete export workflow with various pixel grids and validate in Aseprite.

**Test Cases**:
1. **Small grid (8×8, 4 colors)**
   - Export, download, open in Aseprite
   - Verify dimensions, colors, no errors
2. **Medium grid (32×32, 16 colors)**
   - Same verification
3. **Large grid (64×64, 32 colors)**
   - Same verification
4. **Color filtering**
   - Select subset of colors
   - Verify unselected colors are transparent in Aseprite
5. **Edge cases**:
   - 1×1 pixel
   - 200×200 pixel (max size)
   - Monochrome (1 color)
   - Full palette (64 colors)

**Manual Verification in Aseprite**:
- Open → file opens without errors
- Image → dimensions match
- Image → pixels match preview
- Palette → colors are correct
- Layer → "Background" layer exists and is visible
- File info → shows as RGBA mode

**Browser Testing**:
- Chrome/Edge (desktop)
- Firefox (desktop)
- Safari (macOS)

**Files**:
- None (testing only)

**Verify**:
All test cases pass without errors or visual discrepancies.

**Inputs**:
- Various PixelGrid configurations
- Aseprite application (for validation)

**Expected Output**:
- Test results documented
- Any bugs found and fixed
- Confidence that export works reliably

**Observability Impact**:
- Console should show compression stats during export (in dev mode)
- No errors or warnings in browser console
- File size should be reasonable (<10KB for typical 32×32, <100KB for max 200×200)

---

## Risk Mitigation

### Risk: Binary format implementation errors
**Mitigation**: 
- Start with smallest possible file (1×1 pixel)
- Validate magic number and basic structure before adding complexity
- Compare byte-by-byte with reference .ase file if needed

### Risk: Compression issues
**Mitigation**:
- Test fflate compression separately before integrating
- Add fallback to raw cel data (type=0) if compression fails
- Log compression ratio to detect anomalies

### Risk: Color conversion errors
**Mitigation**:
- Unit test hex → RGB conversion separately
- Visual comparison: export, open in Aseprite, compare side-by-side

### Risk: Browser compatibility
**Mitigation**:
- Test download in multiple browsers early
- Use standard Blob/URL APIs (widely supported)

---

## Rollback Plan

If critical issues are discovered after initial implementation:
1. Hide Aseprite export button via feature flag (commented out in page.tsx)
2. Keep code in place for future fixes
3. Document the issue in GitHub issue or project notes

---

## Future Enhancements (Out of Scope for V1)

- [ ] Multiple layers (group by color)
- [ ] Layer names from color names
- [ ] Support for animations (multiple frames)
- [ ] 8bpp Indexed mode for smaller files
- [ ] User data chunks (metadata)
- [ ] Tags/slices support
- [ ] Batch export (multiple sizes)

---

## Documentation

Update `README.md` (if exists) or add inline JSDoc:
- Explain Aseprite export feature
- Note Aseprite version compatibility (tested with v1.3+)
- Link to Aseprite file format spec for future maintainers

---

## Observability Summary

**Metrics to Log (Development Only)**:
- File size (bytes)
- Compression ratio (compressed / raw)
- Number of colors in palette
- Pixel grid dimensions
- Export duration (performance.now())

**User-Facing Signals**:
- Download triggers (user sees file download)
- No error alerts = success
- File opens in Aseprite = success

**Developer Signals**:
- Console logs for debugging (remove before production)
- No browser console errors
- Network tab shows no unexpected requests (client-side only)

---

## Verification Contract

**Before marking complete**:
1. ✅ All tasks T01-T11 completed
2. ✅ At least 3 different image sizes tested in Aseprite
3. ✅ Color filtering tested and verified
4. ✅ No console errors during export
5. ✅ File size is reasonable (not bloated)
6. ✅ UI is consistent with existing export buttons
7. ✅ Code is clean (no commented debug code, no TODOs)
8. ✅ Dependencies are installed and documented
