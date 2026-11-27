/**
 * Minimal QR code encoder (byte mode, ECC level L, auto version 1-6).
 * Pure JS, no dependencies — used by the share card to encode pipygames.com.
 */
/* ------------------------------------------------------------------ *
 * Based on the public-domain QR code model, re-implemented compactly. *
 * ------------------------------------------------------------------ */

// Galois field arithmetic for QR (GF(256), prime poly 0x11d)
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

function rsGenPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gmul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly.reverse(); // highest degree first
}

function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const b of data) {
    const factor = b ^ res[0];
    res.shift(); res.push(0);
    for (let i = 0; i < ecLen; i++) res[i] ^= gmul(gen[i], factor);
  }
  return res;
}

// --- version tables (ECC L) ---
const V_COUNT = [19, 34, 55, 80, 108, 136];          // total data codewords v1..v6 (L)
const V_ECB = [7, 10, 15, 20, 26, 18];               // ecc per block v1..v6 (L)
const V_GROUPS = [[1], [1], [1], [1], [2, 1], [2, 2]]; // blocks per group v1..v6 (L)
const ALIGN = [[], [18], [22], [26], [30], [34]];    // alignment pattern centers

export function makeQR(text) {
  // pick smallest version v1..v6 whose capacity fits byte-mode data
  const bytes = [];
  for (const ch of unescape(encodeURIComponent(text))) bytes.push(ch.charCodeAt(0));
  let ver = 0;
  for (let v = 1; v <= 6; v++) {
    const cap = V_COUNT[v - 1] - V_ECB[v - 1] * V_GROUPS[v - 1].length;
    if (bytes.length + 2 <= cap) { ver = v; break; }
  }
  if (!ver) ver = 6;
  const size = 17 + ver * 4;
  const ecLen = V_ECB[ver - 1];
  const groups = V_GROUPS[ver - 1];
  const dataCount = V_COUNT[ver - 1] - ecLen * groups.length;

  // bit stream: mode(4) len(8 for v1-9) data terminator pad
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(4, 4); push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  const capBits = dataCount * 8;
  push(0, Math.min(4, capBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < capBits) { push(padBytes[padIdx++ % 2], 8); }

  // split into blocks, add ECC
  const dataBlocks = [], ecBlocks = [];
  let off = 0;
  for (const g of groups) {
    for (let b = 0; b < g; b++) {
      const blk = bits.slice(off * 8, (off + dataCount / g) * 8);
      const dc = [];
      for (let i = 0; i < blk.length; i += 8) {
        let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | blk[i + j];
        dc.push(v);
      }
      dataBlocks.push(dc);
      ecBlocks.push(rsEncode(dc, ecLen));
      off += dataCount / g;
    }
  }
  // interleave
  const final = [];
  const maxD = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxD; i++) for (const b of dataBlocks) if (i < b.length) final.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const b of ecBlocks) final.push(b[i]);

  // build matrix
  const m = Array.from({ length: size }, () => new Array(size).fill(null));
  const setF = (x, y, v) => { if (x >= 0 && x < size && y >= 0 && y < size) m[y][x] = v ? 1 : 0; };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setF(cx + dx, cy + dy, d !== 4 && (d === 0 || d === 2) ? 1 : (d === 4 ? 0 : m[cy + dy]?.[cx + dx] ?? null));
    }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (cx + dx >= 0 && cx + dx < size && cy + dy >= 0 && cy + dy < size)
        m[cy + dy][cx + dx] = d !== 4 && (d === 0 || d === 2) ? 1 : (d === 4 ? 0 : m[cy + dy][cx + dx]);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  // timing patterns
  for (let i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  // alignment patterns
  for (const c of ALIGN[ver - 1]) for (const cy of [c]) for (const cx of [c]) {
    if (m[cy][cx] !== null && !(cy < 8 && cx < 8) && !(cy < 8 && cx >= size - 8) && !(cy >= size - 8 && cx < 8)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      setF(cx + dx, cy + dy, d === 1 ? 0 : 1);
    }
  }
  // dark module + reserve format areas
  setF(8, size - 8, 1);
  const reserved = (x, y) =>
    (x <= 8 && y <= 8) || (x >= size - 8 && y <= 8) || (x <= 8 && y >= size - 8) ||
    x === 6 || y === 6;

  // place data with mask 0
  let bitIdx = 0; const totalBits = final.length * 8;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (m[row][c] === null) {
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (final[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          if ((row + c) % 2 === 0) bit ^= 1; // mask pattern 0
          m[row][c] = bit;
        }
      }
    }
    upward = !upward;
  }

  // format info: ECC L (01) mask 0 (000) -> BCH(15,5)
  const fmtData = (0b00001 << 3) | 0; // (L=01)<<3 | mask0
  let fmt = fmtData << 10;
  const G = 0b10100110111;
  for (let i = 4; i >= 0; i--) if ((fmt >> (i + 10)) & 1) fmt ^= G << i;
  fmt = ((fmtData << 10) | fmt) ^ 0b101010000010010;
  const fmtBits = []; for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1);
  const placeFmt = (positions, flip) => {
    positions.forEach(([x, y], i) => {
      const b = fmtBits[i] ^ (flip ? 1 : 0);
      if (x >= 0 && x < size && y >= 0 && y < size) m[y][x] = b;
    });
  };
  placeFmt([[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]].map(([x, y]) => [x, y]), false);
  placeFmt([[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]], true);

  return m;
}

/** Render a QR matrix onto a canvas context at (x,y) with given cell size. */
export function drawQR(ctx, text, x, y, cell, opts = {}) {
  const m = makeQR(text);
  const n = m.length;
  const quiet = opts.quiet ?? 2;
  const fg = opts.fg || '#2a1636';
  const bg = opts.bg || '#fff8ea';
  const w = (n + quiet * 2) * cell;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, w);
  ctx.fillStyle = fg;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (m[r][c]) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell * 0.92, cell * 0.92);
  }
  return w;
}
