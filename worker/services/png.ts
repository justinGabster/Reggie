/**
 * Tiny dependency-free PNG encoder for QR matrices (Implementation Plan §8.2, fallback path).
 * 8-bit grayscale, zlib-compressed with the built-in CompressionStream("deflate"), CRC32 chunks.
 * Runs on Cloudflare Workers and Node 18+.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  const typeAndData = out.subarray(4, 8 + data.length);
  for (let i = 0; i < 4; i++) typeAndData[i] = type.charCodeAt(i);
  typeAndData.set(data, 4);
  view.setUint32(8 + data.length, crc32(typeAndData));
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Encodes a boolean matrix (true = dark module) as a PNG.
 * @param scale pixels per module
 * @param quietZone modules of white border added on each side
 */
export async function matrixToPng(matrix: boolean[][], scale = 8, quietZone = 4): Promise<Uint8Array> {
  const modules = matrix.length;
  const size = (modules + quietZone * 2) * scale;
  const rowLen = size + 1; // 1 filter byte per row
  const raw = new Uint8Array(rowLen * size).fill(255);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    const my = Math.floor(y / scale) - quietZone;
    if (my < 0 || my >= modules) continue;
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / scale) - quietZone;
      if (mx >= 0 && mx < modules && matrix[my][mx]) raw[y * rowLen + 1 + x] = 0;
    }
  }

  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, size);
  v.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) s += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(s);
}
