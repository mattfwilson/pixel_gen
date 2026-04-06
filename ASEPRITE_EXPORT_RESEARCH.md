# Aseprite Export Feature - Research & Planning

## Overview

Add Aseprite (.ase/.aseprite) export capability to the pixel generator, allowing users to export pixelated images directly into Aseprite's native format for further editing in the Aseprite pixel art editor.

## Current State

### Existing Export Options
1. **SVG Export** (`lib/exportSvg.ts`, `components/SvgDownload.tsx`)
   - Generates vector SVG from pixel grid
   - Supports color filtering and grouping by color
   - Client-side generation and download

2. **Figma Export** (`lib/figma.ts`, `components/FigmaExport.tsx`)
   - Exports to Figma via REST API
   - Requires access token and file key
   - Server-side operation

### Core Data Structure
```typescript
interface PixelGrid {
  pixels: Pixel[];
  width: number;
  height: number;
  uniqueColors: string[];
}

interface Pixel {
  x: number;
  y: number;
  color: string; // hex format #RRGGBB
}
```

## Aseprite File Format

### Format Specifications

<cite index="1-5,2-15">The .ase/.aseprite format uses Intel (little-endian) byte order and has a magic number of 0xA5E0. It supports 8bpp (Indexed), 16bpp (Grayscale), and 32bpp (RGBA) color depths, with images compressed using zlib.</cite>

### Key Components

1. **Header (128 bytes)**
   - File size, magic number (0xA5E0)
   - Dimensions (width, height)
   - Color depth (32bpp RGBA for our use case)
   - Frame count
   - Palette information

2. **Frames**
   - Frame header (16 bytes)
   - Contains chunks with actual image data

3. **Chunk Types** (relevant for our use case)
   - **Layer Chunk (0x2004)**: Define a single image layer
   - **Cel Chunk (0x2005)**: Image data (Raw, Linked, or Compressed)
   - **Palette Chunk (0x2019)**: Color palette
   - **Color Profile Chunk (0x2007)**: sRGB color profile

### Minimum Viable .ase File Structure

For a single-frame, single-layer pixel art export:
```
Header (128 bytes)
  ├─ Magic: 0xA5E0
  ├─ Frames: 1
  ├─ Width: pixelGrid.width
  ├─ Height: pixelGrid.height
  └─ Color depth: 32 (RGBA)

Frame (1 frame)
  ├─ Frame header (16 bytes)
  ├─ Layer chunk (0x2004)
  │   └─ Single "Background" layer, visible, RGBA mode
  ├─ Palette chunk (0x2019)
  │   └─ Extracted from pixelGrid.uniqueColors
  └─ Cel chunk (0x2005)
      └─ Compressed RGBA image data (zlib)
```

## Technical Approach

### Option 1: Binary Construction (Client-Side) ⭐ Recommended

**Approach**: Build the .ase file binary directly in the browser using TypedArrays and DataView.

**Pros**:
- No server dependency
- Consistent with existing SVG export pattern
- Full control over file structure
- Smaller file size than intermediate formats

**Cons**:
- More complex implementation
- Need to handle binary packing and zlib compression
- Requires careful byte-order handling

**Libraries Needed**:
- `pako` or `fflate` for zlib compression (lightweight, browser-compatible)
- No external Aseprite library needed - we build the binary ourselves

**Implementation Steps**:
1. Create `lib/exportAseprite.ts` with binary writer utilities
2. Implement header generation
3. Implement frame/chunk generation
4. Convert PixelGrid to RGBA pixel array
5. Compress pixel data with zlib
6. Assemble chunks and frames
7. Trigger download as `.aseprite` file

### Option 2: Use Existing npm Library (Client-Side)

**Available Libraries**:
- <cite index="14-2,16-1">`ase-parser` and `node-aseprite` - Parse existing .ase files but don't write them</cite>
- <cite index="11-1,17-1">`@kayahr/aseprite` - TypeScript typings for JSON exports only</cite>
- <cite index="13-26,12-26">`aseprite-atlas` - Parses sprite sheets, not binary .ase files</cite>

**Assessment**: No browser-compatible library exists that **writes** .ase binary format. All libraries either:
1. Parse (read) .ase files, not write them
2. Work with Aseprite's JSON export format, not the binary .ase format
3. Require Node.js backend

### Option 3: JSON Export + CLI Conversion (Hybrid)

**Approach**: Export to Aseprite JSON format, require users to import via Aseprite CLI.

**Pros**:
- Simpler than binary generation
- TypeScript typings available

**Cons**:
- Not a true .ase file export
- Requires Aseprite CLI installation
- Extra user friction

**Verdict**: Not recommended - defeats the purpose of "export to Aseprite"

## Recommended Solution

**Build the binary .ase file directly in the browser** (Option 1).

### Implementation Plan

#### Phase 1: Core Binary Writer
1. Install compression library: `npm install fflate` (2KB gzipped, zero dependencies)
2. Create `lib/asepriteWriter.ts`:
   - `writeHeader()` - 128-byte header
   - `writeString()` - length-prefixed UTF-8 strings
   - `writeChunk()` - generic chunk writer
   - Helper functions for WORD, DWORD, etc.

#### Phase 2: Chunk Generators
1. `generateLayerChunk()` - Layer 0x2004
2. `generatePaletteChunk()` - Palette 0x2019 from uniqueColors
3. `generateCelChunk()` - Compressed image 0x2005
   - Convert PixelGrid to RGBA byte array
   - Compress with zlib
   - Package as cel chunk

#### Phase 3: File Assembly
1. `generateAsepriteFile(pixelGrid, selectedColors?)`:
   - Build header
   - Build frame with chunks
   - Return ArrayBuffer

#### Phase 4: UI Integration
1. Create `components/AsepriteExport.tsx`:
   - "Download .aseprite" button
   - Consistent with `SvgDownload` pattern
2. Add to export section in `app/page.tsx`

### Data Mapping

```typescript
PixelGrid → Aseprite Binary
├─ width, height → Header dimensions
├─ uniqueColors → Palette chunk (0x2019)
├─ selectedColors → Filter pixels before export
└─ pixels[] → RGBA array → zlib compress → Cel chunk (0x2005)
```

### File Size Estimation

For a 32×32 pixel image with 16 colors:
- Header: 128 bytes
- Layer chunk: ~50 bytes
- Palette chunk: ~16 colors × 6 bytes = ~100 bytes
- Cel chunk (compressed): ~1-2KB (depends on zlib compression)
- **Total: ~2-3KB** (comparable to PNG)

## Open Questions

1. **Color mode**: Always use 32bpp RGBA, or support 8bpp Indexed for smaller files?
   - **Decision**: Start with 32bpp RGBA (simpler, no palette index mapping)
   
2. **Transparent pixels**: How to handle pixels not in selectedColors?
   - **Decision**: Set alpha=0 for unselected pixels (consistent with existing SVG export)

3. **Metadata**: Include user data (layer names, color names)?
   - **Decision**: Phase 1 - minimal metadata. Phase 2 - add layer name "Pixel Art"

4. **Multiple layers**: Support exporting color groups as separate layers?
   - **Decision**: Phase 1 - single layer. Future enhancement - grouped export like SVG

## Success Criteria

1. ✅ User clicks "Download .aseprite"
2. ✅ Browser downloads `.aseprite` file
3. ✅ File opens in Aseprite without errors
4. ✅ Image matches the preview in pixel_gen
5. ✅ Colors are preserved accurately
6. ✅ Dimensions match the pixel grid
7. ✅ File size is reasonable (<10KB for typical pixel art)

## Dependencies

```bash
npm install fflate
```

- `fflate` (2KB gzipped) - Fast, small zlib compression for browser
- Alternative: `pako` (45KB, more features, overkill for our use case)

## Files to Create/Modify

### New Files
- `lib/asepriteWriter.ts` - Binary .ase file writer
- `lib/exportAseprite.ts` - High-level export function
- `components/AsepriteExport.tsx` - UI component

### Modified Files
- `app/page.tsx` - Add Aseprite export button to export section
- `package.json` - Add fflate dependency

## Verification Plan

1. **Unit Tests** (future):
   - Test header byte layout
   - Test chunk structure
   - Test pixel data conversion

2. **Manual Testing**:
   - Export various sizes (8×8, 16×16, 32×32, 64×64)
   - Export with different color counts (2, 8, 16, 32)
   - Export with color filtering
   - Open in Aseprite and verify:
     - Dimensions correct
     - Colors match
     - No corruption
     - Layer visible

3. **Cross-platform**:
   - Test on macOS, Windows, Linux
   - Verify Aseprite versions: v1.2.x, v1.3.x

## References

- [Aseprite File Format Specification](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md)
- [fflate documentation](https://github.com/101arrowz/fflate)
- Existing export implementations in this project: `lib/exportSvg.ts`, `lib/figma.ts`

## Risk Assessment

### Low Risk
- Binary format is well-documented
- No server dependency
- Small scope (single-frame, single-layer)
- Compression library is battle-tested

### Medium Risk
- Aseprite format might change in future versions (mitigated by using stable chunks)
- Browser compatibility for large files (mitigated by pixel art size limits)

### Mitigation
- Start with minimal viable implementation
- Test with latest Aseprite version
- Keep compression optional as fallback (raw cel data works too)
- Add format version notes to documentation

## Timeline Estimate

- **Phase 1** (Binary Writer): 2-3 hours
- **Phase 2** (Chunk Generators): 3-4 hours
- **Phase 3** (File Assembly): 1-2 hours
- **Phase 4** (UI Integration): 1 hour
- **Testing & Refinement**: 2-3 hours

**Total: 9-13 hours** for full implementation and testing
