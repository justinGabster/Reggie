import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { newToken, qrPng, qrSvg } from "../worker/services/qr";
import { matrixToPng, toBase64 } from "../worker/services/png";
import { checkinInput } from "../shared/schemas";
import { PNG_SIGNATURE, decodeGrayPng } from "./helpers/png";

async function scan(png: Uint8Array): Promise<string | undefined> {
  const { width, height, rgba } = await decodeGrayPng(png);
  return jsQR(rgba, width, height)?.data;
}

describe("newToken", () => {
  it("is 22 characters of base64url with no padding", () => {
    for (let i = 0; i < 100; i++) {
      const t = newToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });

  it("passes the check-in token schema", () => {
    expect(checkinInput.safeParse({ token: newToken() }).success).toBe(true);
  });

  it("produces no duplicates in 10,000 tokens", () => {
    const tokens = new Set(Array.from({ length: 10_000 }, newToken));
    expect(tokens.size).toBe(10_000);
  });
});

describe("qrPng", () => {
  it("starts with the PNG signature", async () => {
    const png = await qrPng(newToken());
    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it("decodes back to the token with jsQR", async () => {
    for (let i = 0; i < 5; i++) {
      const token = newToken();
      expect(await scan(await qrPng(token))).toBe(token);
    }
  });

  it("works at a small scale and for longer text", async () => {
    const text = "https://reggie.example/ticket/" + newToken();
    expect(await scan(await qrPng(text, 4))).toBe(text);
  });

  it("includes the quiet zone (image size = (modules + 8) * scale)", async () => {
    const { width, height } = await decodeGrayPng(await qrPng(newToken(), 8));
    expect(width).toBe(height);
    expect(width % 8).toBe(0);
    // A 22-char token at ECC M fits in version 2 (25 modules): (25 + 8) * 8 = 264.
    expect(width).toBe(264);
  });
});

describe("matrixToPng", () => {
  it("renders dark modules black and the rest white", async () => {
    const png = await matrixToPng([[true, false], [false, true]], 1, 1);
    const { width, height, rgba } = await decodeGrayPng(png);
    expect([width, height]).toEqual([4, 4]);
    const gray = (x: number, y: number) => rgba[(y * width + x) * 4];
    expect(gray(0, 0)).toBe(255); // quiet zone
    expect(gray(1, 1)).toBe(0);
    expect(gray(2, 1)).toBe(255);
    expect(gray(1, 2)).toBe(255);
    expect(gray(2, 2)).toBe(0);
  });
});

describe("qrSvg", () => {
  it("is a self-contained SVG with a path and a white background", () => {
    const svg = qrSvg(newToken());
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(svg).toMatch(/<path d="(M\d+ \d+h1v1h-1z)+" fill="#000"\/>/);
    expect(svg).toContain('fill="#fff"');
  });

  it("differs for different tokens", () => {
    expect(qrSvg(newToken())).not.toBe(qrSvg(newToken()));
  });
});

describe("toBase64", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(1000));
    expect(new Uint8Array(Buffer.from(toBase64(bytes), "base64"))).toEqual(bytes);
  });

  it("handles inputs larger than its 32 KiB chunk size", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("handles empty input", () => {
    expect(toBase64(new Uint8Array(0))).toBe("");
  });

  it("round-trips a QR PNG", async () => {
    const png = await qrPng(newToken());
    expect(new Uint8Array(Buffer.from(toBase64(png), "base64"))).toEqual(png);
  });
});
