/* qr.js — self-contained QR encoder (byte mode, error-correction level M,
   versions 1–10). No dependencies, no CDN. window.QRLite.toCanvas(canvas, text) */
(function () {
  "use strict";

  // per-version: ec codewords per block, and block structure, at level M
  var EC = {
    1:  { ec: 10, g1: 1, d1: 16, g2: 0, d2: 0 },
    2:  { ec: 16, g1: 1, d1: 28, g2: 0, d2: 0 },
    3:  { ec: 26, g1: 1, d1: 44, g2: 0, d2: 0 },
    4:  { ec: 18, g1: 2, d1: 32, g2: 0, d2: 0 },
    5:  { ec: 24, g1: 2, d1: 43, g2: 0, d2: 0 },
    6:  { ec: 16, g1: 4, d1: 27, g2: 0, d2: 0 },
    7:  { ec: 18, g1: 4, d1: 31, g2: 0, d2: 0 },
    8:  { ec: 22, g1: 2, d1: 38, g2: 2, d2: 39 },
    9:  { ec: 22, g1: 3, d1: 36, g2: 2, d2: 37 },
    10: { ec: 26, g1: 4, d1: 43, g2: 1, d2: 44 }
  };
  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  // ---- GF(256) ----
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function mul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  function genPoly(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1);
      for (var k = 0; k < ng.length; k++) ng[k] = 0;
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function rsEncode(data, ecLen) {
    var g = genPoly(ecLen);
    var res = data.slice();
    for (var i = 0; i < ecLen; i++) res.push(0);
    for (var p = 0; p < data.length; p++) {
      var coef = res[p];
      if (coef !== 0) for (var j = 1; j < g.length; j++) res[p + j] ^= mul(g[j], coef);
    }
    return res.slice(data.length);
  }

  // ---- BCH ----
  function bch(data, poly, bits) {
    var d = data << (bits - 1);
    var polyBits = 0, t = poly;
    while (t) { polyBits++; t >>= 1; }
    while (true) {
      var len = 0, v = d;
      while (v) { len++; v >>= 1; }
      if (len < polyBits) break;
      d ^= poly << (len - polyBits);
    }
    return d;
  }
  function formatBits(mask) {
    // level M indicator = 0b00
    var data = (0 << 3) | mask;
    return ((data << 10) | bch(data, 0x537, 11)) ^ 0x5412;
  }
  function versionBits(ver) {
    return (ver << 12) | bch(ver, 0x1f25, 13);
  }

  // ---- payload ----
  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xffff) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      var c = EC[v];
      var dataCw = c.g1 * c.d1 + c.g2 * c.d2;
      var overhead = 4 + (v < 10 ? 8 : 16);
      if (dataCw * 8 - overhead >= byteLen * 8) return v;
    }
    throw new Error("QR: text too long for versions 1–10");
  }

  function makeCodewords(bytes, ver) {
    var c = EC[ver];
    var total = c.g1 * c.d1 + c.g2 * c.d2;
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
    var capBits = total * 8;
    for (var t = 0; t < 4 && bits.length < capBits; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var dc = [];
    for (var b = 0; b < bits.length; b += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[b + j];
      dc.push(v);
    }
    var pad = [0xec, 0x11], k = 0;
    while (dc.length < total) dc.push(pad[k++ % 2]);

    var blocks = [], p = 0, n;
    for (n = 0; n < c.g1; n++) { blocks.push(dc.slice(p, p + c.d1)); p += c.d1; }
    for (n = 0; n < c.g2; n++) { blocks.push(dc.slice(p, p + c.d2)); p += c.d2; }
    var ecs = blocks.map(function (bl) { return rsEncode(bl, c.ec); });

    var maxD = 0;
    blocks.forEach(function (bl) { if (bl.length > maxD) maxD = bl.length; });
    var out = [];
    for (var i2 = 0; i2 < maxD; i2++) blocks.forEach(function (bl) { if (i2 < bl.length) out.push(bl[i2]); });
    for (var i3 = 0; i3 < c.ec; i3++) ecs.forEach(function (e) { out.push(e[i3]); });
    return out;
  }

  // ---- matrix ----
  function build(ver, codewords) {
    var size = 17 + 4 * ver;
    var m = [], fixed = [], r, c2;
    for (r = 0; r < size; r++) {
      m.push(new Array(size).fill(0));
      fixed.push(new Array(size).fill(false));
    }
    function set(row, col, val) { m[row][col] = val; fixed[row][col] = true; }

    function finder(row, col) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = row + dr, cc = col + dc;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var inRing = (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6);
          var on = false;
          if (inRing) {
            var edge = (dr === 0 || dr === 6 || dc === 0 || dc === 6);
            var core = (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4);
            on = edge || core;
          }
          set(rr, cc, on ? 1 : 0);
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    for (var i = 8; i < size - 8; i++) {
      var bit = (i % 2 === 0) ? 1 : 0;
      set(6, i, bit); set(i, 6, bit);
    }

    var centers = ALIGN[ver];
    for (var a = 0; a < centers.length; a++) {
      for (var b = 0; b < centers.length; b++) {
        var ar = centers[a], ac = centers[b];
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) continue;
        for (var dr2 = -2; dr2 <= 2; dr2++) {
          for (var dc2 = -2; dc2 <= 2; dc2++) {
            var mx = Math.max(Math.abs(dr2), Math.abs(dc2));
            set(ar + dr2, ac + dc2, (mx === 1) ? 0 : 1);
          }
        }
      }
    }

    // reserve format areas
    for (var f = 0; f <= 8; f++) {
      if (!fixed[8][f]) set(8, f, 0);
      if (!fixed[f][8]) set(f, 8, 0);
    }
    for (var f2 = 0; f2 < 8; f2++) {
      set(8, size - 1 - f2, 0);
      set(size - 1 - f2, 8, 0);
    }
    set(size - 8, 8, 1); // dark module

    if (ver >= 7) {
      for (var v2 = 0; v2 < 18; v2++) {
        set(Math.floor(v2 / 3), size - 11 + (v2 % 3), 0);
        set(size - 11 + (v2 % 3), Math.floor(v2 / 3), 0);
      }
    }

    // data placement
    var bitIdx = 0;
    var totalBits = codewords.length * 8;
    function nextBit() {
      if (bitIdx >= totalBits) return 0;
      var byteI = bitIdx >> 3, bitI = 7 - (bitIdx & 7);
      bitIdx++;
      return (codewords[byteI] >> bitI) & 1;
    }
    var up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var step = 0; step < size; step++) {
        var row = up ? size - 1 - step : step;
        for (var w = 0; w < 2; w++) {
          var cc2 = col - w;
          if (!fixed[row][cc2]) m[row][cc2] = nextBit();
        }
      }
      up = !up;
    }
    return { m: m, fixed: fixed, size: size };
  }

  function maskFn(k, r, c) {
    switch (k) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function penalty(m, size) {
    var score = 0, r, c, run, i;
    function runScore(len) { return len >= 5 ? 3 + (len - 5) : 0; }
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) run++;
        else { score += runScore(run); run = 1; }
      }
      score += runScore(run);
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }
    var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var patR = pat.slice().reverse();
    function matches(get, len, at, p) {
      for (i = 0; i < 11; i++) { if (at + i >= len || get(at + i) !== p[i]) return false; }
      return true;
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) {
        var rowGet = function (x) { return m[r][x]; };
        var colGet = function (x) { return m[x][c]; };
        if (matches(rowGet, size, c, pat) || matches(rowGet, size, c, patR)) score += 40;
        if (matches(colGet, size, r, pat) || matches(colGet, size, r, patR)) score += 40;
      }
    }
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var pct = dark * 100 / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  function writeFormat(m, size, mask, ver) {
    var bitsF = formatBits(mask);
    function bitAt(n, i) { return (n >> i) & 1; }
    for (var i = 0; i <= 5; i++) m[8][i] = bitAt(bitsF, 14 - i);
    m[8][7] = bitAt(bitsF, 8);
    m[8][8] = bitAt(bitsF, 7);
    m[7][8] = bitAt(bitsF, 6);
    for (var j = 0; j <= 5; j++) m[5 - j][8] = bitAt(bitsF, j);

    for (var k = 0; k <= 7; k++) m[size - 1 - k][8] = bitAt(bitsF, 14 - k);
    for (var l = 0; l <= 6; l++) m[8][size - 7 + l] = bitAt(bitsF, 6 - l);
    m[size - 8][8] = 1;

    if (ver >= 7) {
      var bv = versionBits(ver);
      for (var v = 0; v < 18; v++) {
        var b = bitAt(bv, v);
        m[Math.floor(v / 3)][size - 11 + (v % 3)] = b;
        m[size - 11 + (v % 3)][Math.floor(v / 3)] = b;
      }
    }
  }

  function encode(text) {
    var bytes = utf8(String(text));
    var ver = pickVersion(bytes.length);
    var cw = makeCodewords(bytes, ver);
    var base = build(ver, cw);
    var size = base.size, best = null, bestScore = Infinity, bestMask = 0;
    for (var k = 0; k < 8; k++) {
      var cand = base.m.map(function (row) { return row.slice(); });
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (!base.fixed[r][c] && maskFn(k, r, c)) cand[r][c] ^= 1;
        }
      }
      writeFormat(cand, size, k, ver);
      var s = penalty(cand, size);
      if (s < bestScore) { bestScore = s; best = cand; bestMask = k; }
    }
    return { modules: best, size: size, version: ver, mask: bestMask, fixed: base.fixed, codewords: cw };
  }

  function toCanvas(canvas, text, opts) {
    opts = opts || {};
    var q = encode(text);
    var margin = opts.margin == null ? 4 : opts.margin;
    var total = q.size + margin * 2;
    var px = Math.max(1, Math.floor((opts.width || canvas.width || 320) / total));
    var dim = px * total;
    canvas.width = dim; canvas.height = dim;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dim, dim);
    if (opts.light) { ctx.fillStyle = opts.light; ctx.fillRect(0, 0, dim, dim); }
    ctx.fillStyle = opts.dark || "#000000";
    for (var r = 0; r < q.size; r++) {
      for (var c = 0; c < q.size; c++) {
        if (q.modules[r][c]) ctx.fillRect((c + margin) * px, (r + margin) * px, px, px);
      }
    }
    return q;
  }

  window.QRLite = { encode: encode, toCanvas: toCanvas };
})();
