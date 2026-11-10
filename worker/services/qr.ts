import { encode } from "uqr";
import { matrixToPng } from "./png";

/** 16 random bytes (128 bits), base64url without padding: 22 characters. */
export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function matrix(text: string): boolean[][] {
  // border: 0 here; the renderers add their own quiet zone.
  return encode(text, { ecc: "M", border: 0 }).data;
}

/** Crisp SVG for the ticket page. One <path> keeps it small. */
export function qrSvg(text: string, quietZone = 4): string {
  const m = matrix(text);
  const size = m.length + quietZone * 2;
  let d = "";
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m.length; x++) {
      if (m[y][x]) d += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR ticket">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  );
}

/** PNG for the email attachment (CID inline image). */
export function qrPng(text: string, scale = 8): Promise<Uint8Array> {
  return matrixToPng(matrix(text), scale, 4);
}
