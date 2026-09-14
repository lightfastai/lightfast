import { toRgbaPng } from "./png-codec";

/** Pack multiple PNG buffers into a single .ico file */
export function buildIco(sourcePngs: Buffer[]): Buffer {
  const pngs = sourcePngs.map(toRgbaPng);
  const HEADER = 6;
  const ENTRY = 16;
  const headerBuf = Buffer.alloc(HEADER + ENTRY * pngs.length);
  headerBuf.writeUInt16LE(0, 0);
  headerBuf.writeUInt16LE(1, 2);
  headerBuf.writeUInt16LE(pngs.length, 4);

  let dataOffset = HEADER + ENTRY * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i]!;
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const off = HEADER + ENTRY * i;
    headerBuf.writeUInt8(w >= 256 ? 0 : w, off);
    headerBuf.writeUInt8(h >= 256 ? 0 : h, off + 1);
    headerBuf.writeUInt8(0, off + 2);
    headerBuf.writeUInt8(0, off + 3);
    headerBuf.writeUInt16LE(1, off + 4);
    headerBuf.writeUInt16LE(32, off + 6);
    headerBuf.writeUInt32LE(png.length, off + 8);
    headerBuf.writeUInt32LE(dataOffset, off + 12);
    dataOffset += png.length;
  }
  return Buffer.concat([headerBuf, ...pngs]);
}
