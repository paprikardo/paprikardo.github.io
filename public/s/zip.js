// Minimal ZIP writer/reader. Writes uncompressed ("stored") entries: videos are
// already compressed, and storing keeps memory use low because entries stay Blobs.
// Reads stored entries, and deflated ones where the browser has DecompressionStream.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const CHUNK = 8 * 1024 * 1024;

async function crc32(blob, onBytes) {
  let crc = 0xffffffff;
  for (let pos = 0; pos < blob.size; pos += CHUNK) {
    const buf = new Uint8Array(await blob.slice(pos, pos + CHUNK).arrayBuffer());
    for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    onBytes?.(buf.length);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

export const MAX_ZIP_BYTES = 0xfffffffe; // no ZIP64 support

// entries: [{ name, blob }]. onProgress(bytesProcessed, totalBytes)
export async function makeZip(entries, onProgress) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const total = entries.reduce((s, e) => s + e.blob.size, 0);
  let processed = 0;
  const parts = [];
  const central = [];
  let offset = 0;

  for (const { name, blob } of entries) {
    const nameBytes = enc.encode(name);
    const crc = await crc32(blob, (n) => { processed += n; onProgress?.(processed, total); });
    const size = blob.size;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, nameBytes, blob);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, nameBytes);

    offset += 30 + nameBytes.length + size;
  }

  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  if (offset + cdSize + 22 > MAX_ZIP_BYTES) throw new Error('Backup is larger than 4 GB.');
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

// Returns [{ name, method, size, blob }] where blob is the raw entry data.
export async function readZip(file) {
  const tailLen = Math.min(file.size, 22 + 0xffff);
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file.');
  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  const out = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged zip file.');
    const method = cd.getUint16(p + 10, true);
    const compSize = cd.getUint32(p + 20, true);
    const size = cd.getUint32(p + 24, true);
    const nLen = cd.getUint16(p + 28, true);
    const xLen = cd.getUint16(p + 30, true);
    const cLen = cd.getUint16(p + 32, true);
    const localOff = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nLen));
    p += 46 + nLen + xLen + cLen;
    const lh = new DataView(await file.slice(localOff, localOff + 30).arrayBuffer());
    const start = localOff + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    out.push({ name, method, size, blob: file.slice(start, start + compSize) });
  }
  return out;
}

// Entry contents as a Blob, copied into memory so it no longer refers to the zip file.
export async function entryData(entry, type = '') {
  let blob = entry.blob;
  if (entry.method === 8) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This backup is compressed in a way this browser cannot read.');
    blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
  } else if (entry.method !== 0) {
    throw new Error('Unsupported zip compression.');
  }
  return new Blob([await blob.arrayBuffer()], { type });
}
