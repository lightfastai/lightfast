/** Portable uncompressed ZIP with fixed metadata for byte-reproducible packs. */
export function buildZip(entries: { filename: string; bytes: Buffer }[]) {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { filename, bytes } of entries) {
    const name = Buffer.from(filename);
    let crc = 0xff_ff_ff_ff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xed_b8_83_20 : 0);
      }
    }
    const checksum = (crc ^ 0xff_ff_ff_ff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(33, 12); // 1980-01-01, 00:00
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02_01_4b_50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(33, 14);
    record.writeUInt32LE(checksum, 16);
    record.writeUInt32LE(bytes.length, 20);
    record.writeUInt32LE(bytes.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    locals.push(local, name, bytes);
    central.push(record, name);
    offset += local.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
