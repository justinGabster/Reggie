/**
 * Minimal PNG decoder for tests: handles exactly what worker/services/png.ts writes
 * (8-bit grayscale, no interlace, filter type 0 on every row) and returns RGBA for jsQR.
 */
export type DecodedPng = { width: number; height: number; rgba: Uint8ClampedArray };

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decodeGrayPng(png: Uint8Array): Promise<DecodedPng> {
  PNG_SIGNATURE.forEach((b, i) => {
    if (png[i] !== b) throw new Error("not a PNG");
  });
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (off < png.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      const [bitDepth, colorType, , , interlace] = data.subarray(8, 13);
      if (bitDepth !== 8 || colorType !== 0 || interlace !== 0) {
        throw new Error(`unsupported PNG: depth ${bitDepth}, color ${colorType}, interlace ${interlace}`);
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }

  const compressed = new Uint8Array(idat.reduce((n, d) => n + d.length, 0));
  let p = 0;
  for (const d of idat) {
    compressed.set(d, p);
    p += d.length;
  }
  const raw = await inflate(compressed);
  const rowLen = width + 1;
  if (raw.length !== rowLen * height) throw new Error(`bad IDAT size ${raw.length}, expected ${rowLen * height}`);

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (raw[y * rowLen] !== 0) throw new Error(`unsupported filter ${raw[y * rowLen]} on row ${y}`);
    for (let x = 0; x < width; x++) {
      const g = raw[y * rowLen + 1 + x];
      const i = (y * width + x) * 4;
      rgba[i] = rgba[i + 1] = rgba[i + 2] = g;
      rgba[i + 3] = 255;
    }
  }
  return { width, height, rgba };
}
