# Aseprite Export - Additional Dependencies & Risks Analysis

## Additional Dependencies Identified

### 1. Bundle Size Impact ⚠️ MEDIUM RISK

**Issue**: Adding `fflate` will increase the client-side bundle size.

**Analysis**:
- `fflate` is **2KB gzipped** (10KB uncompressed)
- Current project has minimal dependencies (React, Next.js only)
- The export functionality is client-side only ('use client' directive)

**Risk Level**: Low-Medium
- Bundle increase: ~2KB gzipped
- Only loaded when user visits the page (not critical path)
- Next.js automatically code-splits per page

**Mitigation**:
1. **Dynamic import** the export functions:
   ```typescript
   // Instead of top-level import
   import { generateAsepriteFile } from '@/lib/exportAseprite';
   
   // Use dynamic import
   const handleExport = async () => {
     const { generateAsepriteFile } = await import('@/lib/exportAseprite');
     // ... use it
   }
   ```
   This defers loading fflate until the user actually clicks export.

2. **Monitor with Next.js Bundle Analyzer** (optional):
   ```bash
   npm install --save-dev @next/bundle-analyzer
   ```
   Add to `next.config.ts`:
   ```typescript
   const withBundleAnalyzer = require('@next/bundle-analyzer')({
     enabled: process.env.ANALYZE === 'true',
   })
   module.exports = withBundleAnalyzer(nextConfig)
   ```
   Run: `ANALYZE=true npm run build`

**Decision**: Acceptable. 2KB for compression library is reasonable. Use dynamic import if bundle analysis shows concern.

---

### 2. Browser API Compatibility ✅ LOW RISK

**APIs Required**:
- `DataView` - binary data manipulation
- `ArrayBuffer` / `Uint8Array` - byte arrays
- `TextEncoder` - UTF-8 string encoding
- `Blob` / `URL.createObjectURL()` - file download
- `zlibSync` from fflate - compression

**Browser Support**:
- **DataView**: Supported in all modern browsers (Chrome 9+, Firefox 15+, Safari 5.1+, Edge all versions)
- **ArrayBuffer/Uint8Array**: Same as DataView (ES2015+)
- **TextEncoder**: Supported in Chrome 38+, Firefox 18+, Safari 10.1+, Edge 79+
- **Blob/URL.createObjectURL**: Widely supported (IE 10+, all modern browsers)
- **fflate**: Pure JavaScript, works in all browsers with ES5+ support

**Target Browser Matrix** (from Next.js defaults):
- Chrome/Edge: Last 2 versions ✅
- Firefox: Last 2 versions ✅
- Safari: Last 2 versions ✅
- Mobile browsers: iOS Safari 12+, Chrome Android ✅

**Risk Level**: Very Low
- All required APIs are widely supported
- Next.js already targets modern browsers
- No polyfills needed

**Verification**:
```typescript
// Add runtime check (optional defensive coding)
if (typeof TextEncoder === 'undefined') {
  throw new Error('Browser does not support TextEncoder');
}
```

**Decision**: No action required. All APIs are supported in target browsers.

---

### 3. TypeScript Type Definitions 📝 ACTION REQUIRED

**Issue**: `fflate` needs type definitions for TypeScript.

**Analysis**:
- `fflate` includes built-in TypeScript definitions (✅ ships with .d.ts files)
- No `@types/fflate` package needed

**Verification**:
```bash
npm install fflate
# Check node_modules/fflate/lib/index.d.ts exists
```

**Files to Import**:
```typescript
import { zlibSync } from 'fflate';
// TypeScript will find types automatically
```

**Risk Level**: None
**Decision**: No additional action required.

---

### 4. Next.js App Router Compatibility ✅ VERIFIED

**Current Setup**:
- Next.js 16.2.2 (App Router)
- React 19.2.4
- Client components with 'use client' directive

**Compatibility Check**:
- Binary generation: Client-side only ✅
- File download: Client-side only ✅
- No Server Components involved ✅
- No server actions needed ✅

**Pattern Match**:
Existing `SvgDownload` and `FigmaExport` components already use:
- 'use client' directive
- Client-side blob generation
- Browser download APIs

**Risk Level**: None
**Decision**: Same pattern as existing exports. No compatibility issues.

---

### 5. Memory Constraints (Large Pixel Grids) ⚠️ MEDIUM RISK

**Issue**: Generating large pixel grids in memory could cause browser issues.

**Analysis**:

**Worst-case scenario**:
- 200×200 pixel grid (max dimension from UI: 100×100 typical, but could be 200×200)
- 32bpp RGBA: 4 bytes per pixel
- Raw pixel data: 200 × 200 × 4 = **160KB** uncompressed
- Compressed (zlib): ~**40-80KB** (depends on image complexity)
- Total file size: ~**50-100KB** (with headers/chunks)

**Browser Limits**:
- Chrome/Firefox/Safari: Can handle MB-sized blobs easily
- ArrayBuffer limit: ~2GB in modern browsers
- Our use case: <100KB typical, <200KB worst case

**Memory Usage Breakdown**:
```
PixelGrid object:       ~10-50KB (JavaScript objects)
RGBA byte array:        ~160KB (200×200×4)
Compressed data:        ~40-80KB
Final .aseprite buffer: ~50-100KB
Temporary blob:         ~50-100KB
TOTAL PEAK:            ~400-500KB
```

**Risk Level**: Low
- Well within browser memory limits
- Garbage collected immediately after download
- No memory leaks (no event listeners or timers)

**Mitigation**:
1. **Add size validation** (defensive):
   ```typescript
   if (pixelGrid.width > 200 || pixelGrid.height > 200) {
     alert('Maximum size is 200×200 pixels');
     return;
   }
   ```

2. **Clean up immediately**:
   ```typescript
   URL.revokeObjectURL(url); // Already in plan
   ```

3. **Monitor in dev** (optional):
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log('Memory before export:', performance.memory?.usedJSHeapSize);
     // ... export
     console.log('Memory after export:', performance.memory?.usedJSHeapSize);
   }
   ```

**Decision**: Add dimension validation. No other action needed.

---

### 6. Compression Performance ⚠️ LOW RISK

**Issue**: zlib compression is CPU-intensive. Could block UI on slow devices.

**Analysis**:

**fflate Performance** (from library benchmarks):
- Compression speed: ~30-100 MB/s (varies by device)
- Our use case: ~160KB worst case
- Estimated time: **~2-5ms on typical device**, **~10-20ms on slow device**

**UI Blocking**:
- Compression is synchronous (`zlibSync`)
- Blocks main thread during compression
- Risk of janky UI on slow devices

**Alternatives**:
1. **Use async compression** (`zlib()` instead of `zlibSync`):
   ```typescript
   import { zlib } from 'fflate';
   
   zlib(rawPixels, (err, compressed) => {
     if (err) throw err;
     // continue with compressed data
   });
   ```
   - Pro: Non-blocking
   - Con: Slightly more complex (callback-based)

2. **Use Web Worker** (overkill for <200KB):
   - Pro: Completely off main thread
   - Con: Complex setup, not worth it for small files

3. **Show loading indicator**:
   ```typescript
   setProcessing(true);
   // ... compression
   setProcessing(false);
   ```

**Risk Level**: Very Low
- Compression is fast for our file sizes
- Modern devices handle this easily
- Worst case: 20ms blocking (imperceptible)

**Decision**: 
- Use `zlibSync` (simpler, fast enough)
- Add loading state during export (already in plan via `disabled` prop)
- If performance issues arise in testing, switch to async `zlib()`

---

### 7. Error Handling & Edge Cases 📝 ACTION REQUIRED

**Scenarios to Handle**:

1. **Compression failure**:
   ```typescript
   try {
     const compressed = zlibSync(rawPixels);
   } catch (err) {
     console.error('Compression failed:', err);
     // Fallback: use raw cel data (type=0 instead of type=2)
     // OR: alert user and abort
   }
   ```

2. **Invalid pixel grid**:
   ```typescript
   if (!pixelGrid || pixelGrid.pixels.length === 0) {
     throw new Error('No pixel data to export');
   }
   ```

3. **Download failure** (browser blocks):
   ```typescript
   try {
     a.click();
   } catch (err) {
     alert('Download failed. Please check browser permissions.');
   }
   ```

4. **Empty color selection**:
   - Already handled by `disabled` prop
   - File would be valid but transparent (intentional)

**Risk Level**: Low
- Most errors are user-facing and recoverable
- No data loss risk (client-side only, no persistence)

**Decision**: Add try/catch blocks in T06, T07, T08. Include in task plans.

---

### 8. Aseprite Version Compatibility 🔍 RESEARCH REQUIRED

**Issue**: Does the exported file work with all Aseprite versions?

**Analysis**:

**File Format Versions**:
- Official spec: Based on Aseprite v1.3+
- Our implementation: Minimal chunks (Layer, Cel, Palette)
- Magic number: 0xA5E0 (stable across all versions)

**Compatibility Matrix** (from spec):
- **Aseprite v1.2.x**: ✅ Supports our chunks (0x2004, 0x2005, 0x2019)
- **Aseprite v1.3.x**: ✅ Fully compatible
- **Aseprite v1.4+**: ✅ Backward compatible (our chunks still valid)
- **Older versions (<1.2)**: ⚠️ May not support new palette chunk (0x2019)

**Risk Level**: Low-Medium
- Modern Aseprite versions (v1.2+): Full compatibility expected
- Older versions: Untested, but likely works (old palette chunk 0x0004 could be fallback)

**Decision**: 
- Document tested version (v1.3+) in README/JSDoc
- Test with at least 2 Aseprite versions during T11
- Add version check note in UI (optional): "Requires Aseprite v1.2 or newer"

---

### 9. CORS / Content Security Policy 🔒 LOW RISK

**Issue**: Does CSP or CORS block blob downloads?

**Analysis**:

**Blob URLs**:
- `blob:` URLs are same-origin
- Not affected by CORS
- Not blocked by CSP (unless `blob:` is explicitly blocked)

**Current CSP** (check in browser):
```bash
# In browser DevTools -> Network -> Headers
# Look for Content-Security-Policy header
```

**Next.js Default**:
- No restrictive CSP by default
- Blob downloads work out of the box

**Risk Level**: Very Low
- Only an issue if project adds custom CSP later
- Easy to fix: add `blob:` to CSP `default-src` or `script-src`

**Decision**: No action required. Document CSP requirement if project adds CSP later.

---

### 10. File Size Validation ✅ LOW RISK

**Issue**: Ensure exported file isn't bloated or corrupt.

**Expected File Sizes**:
- 8×8 (4 colors): ~500 bytes - 1KB
- 16×16 (8 colors): ~1-2KB
- 32×32 (16 colors): ~2-4KB
- 64×64 (32 colors): ~5-10KB
- 200×200 (64 colors): ~50-100KB

**Compression Ratio** (typical):
- Raw RGBA: 100%
- Compressed (zlib): 25-50% (depends on image complexity)
- Solid colors compress better (~10-20%)
- Noisy/dithered images compress worse (~40-60%)

**Validation**:
```typescript
if (fileBuffer.byteLength > 500_000) { // 500KB
  console.warn('File size unexpectedly large:', fileBuffer.byteLength);
  // Continue anyway, but log for debugging
}
```

**Risk Level**: Very Low
- Easy to detect in testing
- No user impact (files are small)

**Decision**: Add file size logging in development mode (T07).

---

## Additional Risks Not Previously Identified

### 11. Byte Order Errors (Little-Endian) 🔴 HIGH RISK

**Issue**: Writing multi-byte values in wrong byte order breaks file format.

**Aseprite Requirement**: Intel (little-endian) byte order

**JavaScript DataView**:
```typescript
// CORRECT - little-endian (last param: true)
dataView.setUint16(offset, value, true);  // ✅
dataView.setUint32(offset, value, true);  // ✅

// WRONG - big-endian (default or false)
dataView.setUint16(offset, value);        // ❌
dataView.setUint16(offset, value, false); // ❌
```

**Risk Level**: High
- Silent corruption (file appears valid but Aseprite rejects it)
- Hard to debug without hex dump

**Mitigation**:
1. **Always specify endianness explicitly**:
   ```typescript
   class BinaryWriter {
     writeWord(value: number) {
       this.view.setUint16(this.pos, value, true); // ✅ explicit
       this.pos += 2;
     }
   }
   ```

2. **Add unit test** (T02):
   ```typescript
   const writer = new BinaryWriter();
   writer.writeWord(0xA5E0); // Magic number
   const bytes = new Uint8Array(writer.getBuffer());
   // Little-endian: [E0, A5] not [A5, E0]
   expect(bytes[0]).toBe(0xE0);
   expect(bytes[1]).toBe(0xA5);
   ```

3. **Hex dump debug utility** (optional):
   ```typescript
   function hexDump(buffer: ArrayBuffer, length = 32) {
     const bytes = new Uint8Array(buffer);
     console.log(
       Array.from(bytes.slice(0, length))
         .map(b => b.toString(16).padStart(2, '0'))
         .join(' ')
     );
   }
   ```

**Decision**: **CRITICAL** - Add explicit endianness to all DataView methods. Add unit test in T02.

---

### 12. String Encoding (UTF-8) ⚠️ MEDIUM RISK

**Issue**: Layer names and color names must be UTF-8 encoded correctly.

**Aseprite STRING Format**:
```
WORD: length in bytes (NOT characters)
BYTE[length]: UTF-8 bytes
```

**JavaScript TextEncoder**:
```typescript
const encoder = new TextEncoder();
const bytes = encoder.encode("Pixel Art"); // UTF-8 Uint8Array
const length = bytes.length; // BYTE length, not character length
```

**Common Mistakes**:
```typescript
// WRONG - string.length is character count, not byte count
writer.writeWord("Pixel 🎨".length); // ❌ 8 characters
// Correct byte length is 11 (emoji is 4 bytes)

// CORRECT
const bytes = new TextEncoder().encode("Pixel 🎨");
writer.writeWord(bytes.length); // ✅ 11 bytes
writer.writeBytes(bytes);
```

**Risk Level**: Medium
- ASCII layer names: works fine (1 char = 1 byte)
- Emoji or non-ASCII: breaks file if byte length wrong

**Mitigation**:
```typescript
writeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  this.writeWord(bytes.length); // Byte length
  this.writeBytes(bytes);
}
```

**Decision**: Use TextEncoder in `writeString()`. Add test with emoji in T02.

---

### 13. Chunk Size Calculation ⚠️ MEDIUM RISK

**Issue**: Chunk size must include the size field itself.

**Chunk Structure**:
```
DWORD: Chunk size (includes these 4 bytes + type + data)
WORD:  Chunk type
BYTE[]: Chunk data
```

**Correct Calculation**:
```typescript
// Data is 10 bytes
const dataSize = 10;
const chunkSize = 4 + 2 + dataSize; // size field + type + data
writer.writeDword(chunkSize); // ✅ 16
writer.writeWord(0x2004);
writer.writeBytes(data);
```

**Wrong Calculation**:
```typescript
const chunkSize = dataSize; // ❌ Missing size field + type
```

**Risk Level**: Medium
- Aseprite may reject file or read wrong number of bytes
- Chunk misalignment breaks entire file

**Mitigation**:
```typescript
function writeChunk(type: number, dataWriter: () => void) {
  const startPos = this.pos;
  this.writeDword(0); // Placeholder for size
  const sizePos = startPos;
  
  this.writeWord(type);
  const dataStart = this.pos;
  dataWriter(); // Write chunk-specific data
  const dataEnd = this.pos;
  
  // Calculate and write correct size
  const totalSize = (dataEnd - startPos);
  const view = new DataView(this.buffer);
  view.setUint32(sizePos, totalSize, true);
}
```

**Decision**: Implement chunk size helper in T02-T05. Verify each chunk size in tests.

---

## Summary of Required Actions

### High Priority (Critical for Success)
1. ✅ **T02**: Implement endianness correctly (always use `true` for little-endian)
2. ✅ **T02**: Add unit test for byte order (magic number verification)
3. ✅ **T02**: Implement `writeString()` with TextEncoder
4. ✅ **T02**: Add chunk size calculation helper

### Medium Priority (Quality & UX)
5. ✅ **T07**: Add dimension validation (max 200×200)
6. ✅ **T06-T08**: Add try/catch error handling
7. ✅ **T11**: Test with Aseprite v1.2 and v1.3
8. ✅ **T07**: Add file size logging (development mode)

### Low Priority (Optional Optimizations)
9. ⚪ **Consider**: Dynamic import of export functions (bundle size)
10. ⚪ **Monitor**: Add bundle analyzer if bundle size becomes concern
11. ⚪ **Consider**: Async compression if performance issues found

### No Action Required
- ✅ Browser API compatibility (all modern browsers supported)
- ✅ TypeScript types (fflate ships with .d.ts)
- ✅ Next.js App Router compatibility (verified)
- ✅ CORS/CSP (not an issue for blob URLs)

---

## Updated Risk Matrix

| Risk | Severity | Likelihood | Mitigation Status |
|------|----------|------------|-------------------|
| Byte order errors | High | Medium | ✅ Explicit in plan (T02) |
| Chunk size calculation | Medium | Medium | ✅ Helper in plan (T02) |
| String encoding (UTF-8) | Medium | Low | ✅ TextEncoder in plan (T02) |
| Memory constraints | Low | Very Low | ✅ Validation in plan (T07) |
| Compression performance | Low | Very Low | ✅ Loading state in plan |
| Bundle size impact | Low | Low | ⚪ Monitor (optional) |
| Aseprite version compat | Low | Low | ✅ Testing in plan (T11) |
| Browser API support | Very Low | Very Low | ✅ No action needed |

---

## Conclusion

**The plan is viable with the following critical additions**:

1. **T02 must include**:
   - Explicit little-endian parameter on all DataView methods
   - TextEncoder for UTF-8 string encoding
   - Chunk size calculation helper
   - Unit tests for byte order and string encoding

2. **T07 must include**:
   - Dimension validation (200×200 max)
   - File size logging in dev mode

3. **T06-T08 must include**:
   - Try/catch error handling
   - User-friendly error messages

4. **T11 must include**:
   - Test with at least 2 Aseprite versions
   - Document minimum version requirement

**No blockers identified.** All risks are addressable within the existing task structure.

**Estimated impact on timeline**: +0-1 hour (adding tests and error handling)

**Overall Risk Assessment**: ✅ **LOW** - Plan is sound with identified additions.
