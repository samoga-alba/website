/* Fun mode — 8-bit London → Kent coast journey, plus a runner game */
(() => {
  /* ---------- Column layout: equal heights, widen until text fits ---------- */
  const strip = document.getElementById('strip');
  const panels = [...strip.querySelectorAll('.panel')];

  function fitPanels() {
    panels.forEach((p) => {
      p.style.overflowY = 'hidden';
      let w = Math.min(320, window.innerWidth * 0.85);
      p.style.width = w + 'px';
      while (p.scrollHeight > p.clientHeight + 1 && w < 2000) {
        w += 30;
        p.style.width = w + 'px';
      }
      if (p.scrollHeight > p.clientHeight + 1) p.style.overflowY = 'auto';
    });
  }
  fitPanels();
  window.addEventListener('resize', fitPanels);
  if (document.fonts) document.fonts.ready.then(fitPanels);

  // Mouse wheel scrolls the strip sideways (down = further right)
  strip.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      strip.scrollBy({ left: e.deltaY });
      e.preventDefault();
    }
  }, { passive: false });

  /* ---------- Mode switch back to the boring homepage ---------- */
  const sw = document.querySelector('.mode-switch');
  sw.addEventListener('click', (e) => {
    e.preventDefault();
    sw.classList.remove('is-on');
    setTimeout(() => { location.href = sw.getAttribute('href'); }, 260);
  });

  /* ---------- Canvas scene ---------- */
  const cvs = document.getElementById('scene');
  const ctx = cvs.getContext('2d');
  const hud = document.getElementById('hud');
  const msg = document.getElementById('msg');
  const btnNight = document.getElementById('daynight');
  const btnPlay = document.getElementById('play');

  const H = 120;
  const G = 94; // ground line (road starts here)
  const BG_LEN = 2400; // background world length
  const FAR = 105; // far lane wheel line
  const NEAR = 117; // near lane wheel line
  const VIDEO_T = 90; // seconds for the video journey
  const GAME_T = 600; // 10 minute game
  let W = 240;

  let night = false;
  let mode = 'video';
  let t = 0;
  let videoT = 0;
  let roadScroll = 0;
  let lights = [];
  let vehicles = [];
  let laneTimer = { far: 0, near: 1 };

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Pre-generated scenery
  const rand = rng(7);
  const fillers = [];
  for (let x = -20; x < 1160;) {
    const w = 14 + Math.floor(rand() * 18);
    fillers.push({ x, w, h: 14 + Math.floor(rand() * 22), c: ['#8d8f98', '#a1887a', '#7d8590', '#b3a79a', '#6f7a86'][Math.floor(rand() * 5)] });
    x += w + Math.floor(rand() * 4);
  }
  const trees = [];
  for (let x = 1120; x < 1990; x += 18 + Math.floor(rand() * 40)) trees.push({ x, s: rand() > 0.5 ? 1 : 0 });
  const oasts = [1340, 1470, 1600, 1760, 1880];
  const stars = Array.from({ length: 50 }, () => [rand(), rand() * 0.6]);
  const clouds = Array.from({ length: 5 }, () => [rand(), 8 + rand() * 30, 10 + Math.floor(rand() * 14)]);

  function resize() {
    const r = cvs.getBoundingClientRect();
    if (!r.height) return;
    W = Math.max(160, Math.round((r.width / r.height) * H));
    cvs.width = W;
    cvs.height = H;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- Drawing helpers ---------- */
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const pushLight = (x, y, w, h, c) => {
    const m = ctx.getTransform();
    lights.push([m.a < 0 ? m.e - x - w : x + m.e, y, w, h, c]);
  };
  // Window: dark by day, sometimes lit at night
  const win = (x, y, w, h) => {
    R(x, y, w, h, '#2d3a4f');
    if (night && ((Math.round(x + bxNow) * 7 + y * 13) % 5) > 1) pushLight(x, y, w, h, '#ffd86b');
  };
  const lamp = (x, y, w, h, c) => { if (night) pushLight(x, y, w, h, c || '#fff3b0'); };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) R(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1, 1, c);
  };
  function mirrored(x, w, dir, fn) {
    if (dir > 0) return fn();
    ctx.save();
    ctx.translate(Math.round(2 * x + w), 0);
    ctx.scale(-1, 1);
    fn();
    ctx.restore();
  }
  let bxNow = 0;

  function regionAt(wx) {
    if (wx < 1150) return 'London';
    if (wx < 1960) return 'Kent';
    return 'Dover';
  }

  /* ---------- Landmarks ---------- */
  function parliament(sx) {
    R(sx, G - 22, 120, 22, '#c9a86a');
    R(sx, G - 24, 120, 2, '#a8884f');
    for (let i = 0; i < 120; i += 6) {
      R(sx + i, G - 28, 1, 4, '#a8884f');
      win(sx + i + 2, G - 19, 2, 5);
      win(sx + i + 2, G - 10, 2, 5);
    }
    R(sx - 6, G - 50, 16, 50, '#c2a062');
    R(sx - 6, G - 54, 2, 4, '#a8884f'); R(sx + 8, G - 54, 2, 4, '#a8884f');
    for (let y = G - 46; y < G - 4; y += 8) win(sx - 2, y, 2, 5), win(sx + 4, y, 2, 5);
    R(sx + 56, G - 38, 8, 16, '#c2a062'); R(sx + 58, G - 46, 4, 8, '#a8884f'); R(sx + 59, G - 50, 2, 4, '#a8884f');
    const x0 = sx + 122; // Elizabeth Tower (Big Ben)
    R(x0, G - 56, 10, 56, '#c9a86a');
    for (let y = G - 52; y < G - 4; y += 7) R(x0 + 4, y, 2, 4, '#a8884f');
    R(x0 - 1, G - 66, 12, 10, '#b8965a');
    R(x0 + 2, G - 64, 6, 6, '#f4ecd0'); lamp(x0 + 2, G - 64, 6, 6, '#fff6cf');
    R(x0 + 5, G - 63, 1, 3, '#222'); R(x0 + 5, G - 61, 2, 1, '#222');
    R(x0, G - 72, 10, 6, '#a8884f');
    R(x0 + 1, G - 76, 8, 4, '#5f6b55'); R(x0 + 2, G - 80, 6, 4, '#5f6b55');
    R(x0 + 3, G - 84, 4, 4, '#5f6b55'); R(x0 + 4, G - 88, 2, 4, '#5f6b55');
  }

  function londonEye(sx) {
    const cx = sx + 40, cy = G - 40, r = 34;
    line(cx, cy, cx - 16, G, '#cfd6de'); line(cx, cy, cx - 10, G, '#cfd6de');
    for (let a = 0; a < Math.PI * 2; a += 0.025) R(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, 1, '#eef1f6');
    const rot = t * 0.05;
    for (let i = 0; i < 16; i++) {
      const a = rot + (i / 16) * Math.PI * 2;
      for (let k = 4; k < r; k += 3) R(cx + Math.cos(a) * k, cy + Math.sin(a) * k, 1, 1, '#aab4c0');
      const px = cx + Math.cos(a) * (r + 1) - 1, py = cy + Math.sin(a) * (r + 1) - 1;
      R(px, py, 3, 3, '#dfe6ee'); lamp(px, py, 3, 3, '#9fd8ff');
    }
    R(cx - 2, cy - 2, 4, 4, '#8a929c');
  }

  function stPauls(sx) {
    R(sx, G - 20, 70, 20, '#d8d2c0');
    for (let i = 4; i < 66; i += 5) R(sx + i, G - 18, 1, 16, '#bdb5a0');
    R(sx + 25, G - 24, 20, 4, '#cfc8b4');
    for (const tx of [sx + 2, sx + 58]) {
      R(tx, G - 36, 10, 16, '#d8d2c0'); R(tx + 2, G - 42, 6, 6, '#cfc8b4'); R(tx + 4, G - 46, 2, 4, '#bdb5a0');
      win(tx + 4, G - 32, 2, 4);
    }
    R(sx + 20, G - 32, 30, 12, '#cfc8b4');
    for (let i = 22; i < 50; i += 3) R(sx + i, G - 31, 1, 10, '#b5ad98');
    for (let dy = 0; dy <= 15; dy++) {
      const half = Math.round(Math.sqrt(225 - dy * dy));
      R(sx + 35 - half, G - 32 - dy, half * 2, 1, dy % 4 === 0 ? '#8a9e96' : '#9fb3aa');
    }
    R(sx + 33, G - 52, 4, 5, '#cfc8b4');
    R(sx + 34, G - 58, 2, 6, '#d9b23a'); R(sx + 33, G - 56, 4, 1, '#d9b23a');
  }

  function shard(sx) {
    const h = 84;
    for (let dy = 0; dy < h; dy++) {
      const w = Math.max(1, Math.round(26 * (1 - (dy / h) * 0.94)));
      R(sx + 13 - w / 2, G - dy, w, 1, dy % 6 === 0 ? '#8ea9c1' : '#b7cadb');
      if (dy % 6 === 3 && w > 4) lamp(sx + 13 - w / 2 + 1, G - dy, w - 2, 1, '#cfe6ff');
    }
  }

  function gherkin(sx) {
    for (let dy = 0; dy < 44; dy++) {
      const k = (dy - 18) / 26;
      const half = Math.max(1, Math.round(10 * Math.sqrt(Math.max(0, 1 - k * k))));
      R(sx + 10 - half, G - dy, half * 2, 1, (dy % 4 < 2) ? '#4f7f96' : '#6a9bb0');
    }
  }

  function towerBridge(sx) {
    R(sx - 30, G - 8, 160, 8, '#3d6e8f');
    for (let i = 0; i < 160; i += 7) R(sx - 30 + ((i + Math.floor(t * 6)) % 160), G - 5, 3, 1, '#6c9cbb');
    R(sx - 30, G - 14, 160, 3, '#5a87b5');
    line(sx + 2, G - 44, sx - 30, G - 14, '#7ab0d8');
    line(sx + 82, G - 44, sx + 128, G - 14, '#7ab0d8');
    R(sx + 14, G - 40, 56, 4, '#7ab0d8'); R(sx + 14, G - 35, 56, 1, '#5a87b5');
    for (const tx of [sx, sx + 70]) {
      R(tx, G - 46, 14, 46, '#b9a27a');
      R(tx, G - 50, 3, 4, '#9a8460'); R(tx + 11, G - 50, 3, 4, '#9a8460'); R(tx + 5, G - 54, 4, 8, '#9a8460');
      win(tx + 4, G - 40, 2, 5); win(tx + 8, G - 40, 2, 5); win(tx + 4, G - 28, 2, 5); win(tx + 8, G - 28, 2, 5);
    }
  }

  function oast(sx) {
    R(sx + 14, G - 14, 24, 14, '#ececec');
    R(sx + 13, G - 17, 26, 3, '#5b3a2a');
    win(sx + 20, G - 10, 3, 4); win(sx + 30, G - 10, 3, 4);
    R(sx, G - 20, 14, 20, '#a5442e');
    for (let i = 0; i < 14; i += 4) R(sx + i, G - 20 + (i % 8), 2, 1, '#8c3522');
    for (let dy = 0; dy < 15; dy++) {
      const w = Math.max(2, Math.round(14 * (1 - dy / 16)));
      R(sx + 7 - w / 2, G - 20 - dy, w, 1, '#5b3a2a');
    }
    R(sx + 4, G - 39, 6, 5, '#f4f4f0'); R(sx + 9, G - 40, 3, 3, '#f4f4f0'); R(sx + 7, G - 42, 1, 3, '#444');
  }

  function tree(sx, big) {
    R(sx + 3, G - 6, 2, 6, '#5a3a1e');
    if (big) { R(sx - 1, G - 16, 10, 10, '#2f6b2e'); R(sx + 1, G - 19, 6, 3, '#2f6b2e'); }
    else { R(sx, G - 13, 8, 7, '#3d7a35'); R(sx + 1, G - 15, 6, 2, '#3d7a35'); }
  }

  function cliffTop(wx) {
    if (wx < 1960) return G;
    if (wx < 2010) return G - Math.round((wx - 1960) * 0.72);
    if (wx < 2330) return G - 36;
    if (wx < 2338) return G - 36 + (wx - 2330) * 4;
    return null;
  }

  function castle(sx) {
    const top = G - 36;
    R(sx, top - 10, 60, 10, '#a99f88');
    for (let i = 0; i < 60; i += 4) R(sx + i, top - 12, 2, 2, '#a99f88');
    R(sx + 16, top - 24, 24, 24, '#bdb29a');
    for (let i = 0; i < 24; i += 4) R(sx + 16 + i, top - 26, 2, 2, '#bdb29a');
    R(sx + 14, top - 28, 4, 28, '#b0a58c'); R(sx + 38, top - 28, 4, 28, '#b0a58c');
    win(sx + 22, top - 20, 2, 4); win(sx + 32, top - 20, 2, 4); win(sx + 27, top - 12, 3, 5);
    R(sx + 4, top - 6, 4, 6, '#3a3328'); R(sx + 50, top - 6, 4, 6, '#3a3328');
    R(sx + 28, top - 36, 1, 10, '#555');
    R(sx + 29, top - 36, 7, 5, '#fff'); R(sx + 31, top - 36, 2, 5, '#d10'); R(sx + 29, top - 34, 7, 1, '#d10');
  }

  function lighthouse(sx) {
    const top = G - 36;
    for (let dy = 0; dy < 28; dy++) {
      const w = 9 - Math.floor(dy / 10);
      R(sx + (9 - w) / 2, top - dy, w, 1, '#f6f6f2');
    }
    R(sx, top - 2, 9, 2, '#d9d9d2');
    win(sx + 4, top - 16, 1, 3);
    R(sx + 1, top - 30, 7, 2, '#333');
    R(sx + 2, top - 34, 5, 4, '#ffe680'); lamp(sx + 2, top - 34, 5, 4, '#fff6a0');
    R(sx + 1, top - 35, 7, 1, '#333'); R(sx + 3, top - 37, 3, 2, '#333');
  }

  /* ---------- Background ---------- */
  function drawBackground(bx) {
    bxNow = bx;
    // Sea behind the Dover cliffs
    for (let sx = 0; sx < W; sx++) {
      const wx = bx + sx;
      if (wx > 1980) {
        R(sx, G - 18, 1, 18, '#2f6fa8');
        if ((wx + Math.floor(t * 4)) % 9 === 0) R(sx, G - 14 + (wx % 3) * 4, 1, 1, '#8cc0e8');
      }
    }
    // Rolling Kent hills (two parallax layers)
    for (let sx = 0; sx < W; sx++) {
      const wx = bx + sx;
      if (wx < 1090 || wx > 2000) continue;
      const fade = Math.min(1, (wx - 1090) / 80, (2000 - wx) / 60);
      const w2 = bx * 0.6 + sx;
      const h1 = Math.round((16 + 6 * Math.sin(w2 / 41) + 3 * Math.sin(w2 / 13)) * fade);
      const h2 = Math.round((8 + 4 * Math.sin(wx / 29 + 1) + 2 * Math.sin(wx / 9)) * fade);
      R(sx, G - h1, 1, h1, '#7cb35d');
      R(sx, G - h2, 1, h2, '#5f9e4a');
      if ((wx % 23) < 2 && h2 > 6) R(sx, G - h2 + 3, 1, 1, '#4a8a3a');
    }
    // London skyline filler
    for (const b of fillers) {
      const sx = b.x - bx;
      if (sx > W || sx + b.w < 0) continue;
      R(sx, G - b.h, b.w, b.h, b.c);
      for (let y = G - b.h + 3; y < G - 3; y += 5)
        for (let x = 2; x < b.w - 2; x += 4) win(sx + x, y, 2, 3);
    }
    const marks = [[40, 150, parliament], [215, 80, londonEye], [330, 70, stPauls], [480, 26, shard], [540, 20, gherkin], [660, 100, towerBridge]];
    for (const [x, w, fn] of marks) {
      const sx = x - bx;
      if (sx < W + 40 && sx + w > -40) fn(sx);
    }
    for (const tr of trees) { const sx = tr.x - bx; if (sx > -12 && sx < W + 4) tree(sx, tr.s); }
    for (const ox of oasts) { const sx = ox - bx; if (sx > -50 && sx < W + 4) oast(sx); }
    // White cliffs
    for (let sx = 0; sx < W; sx++) {
      const wx = bx + sx;
      const top = cliffTop(wx);
      if (top === null || top >= G) continue;
      R(sx, top, 1, 2, '#5a9a3c');
      R(sx, top + 2, 1, G - top - 2, (wx * 7) % 11 < 2 ? '#d4d4cc' : '#f2f2ea');
    }
    if (2040 - bx < W + 10 && 2100 - bx > -10) castle(2040 - bx);
    if (2250 - bx < W + 10 && 2260 - bx > -10) lighthouse(2250 - bx);
  }

  function drawRoad(region) {
    const london = region === 'London';
    R(0, G, W, 2, london ? '#9c9c9c' : '#6b8f3a');
    R(0, G + 2, W, 22, '#3b3b42');
    const off = Math.floor(roadScroll) % 16;
    for (let x = -off; x < W; x += 16) R(x, 107, 8, 1, '#e8e8e8');
    R(0, H - 2, W, 2, london ? '#9c9c9c' : '#6b8f3a');
  }

  /* ---------- Sprites ---------- */
  const frame = () => Math.floor(t * 8) % 2;

  function car(x, by, col, dir, cab) {
    mirrored(x, 18, dir, () => {
      R(x, by - 7, 18, 5, col);
      R(x + 4, by - 11, 10, 4, col);
      R(x + 5, by - 10, 3, 3, '#9fd3ff'); R(x + 10, by - 10, 3, 3, '#9fd3ff');
      if (cab) R(x + 8, by - 12, 3, 1, '#f5c400');
      R(x + 2, by - 3, 4, 3, '#111'); R(x + 12, by - 3, 4, 3, '#111');
      R(x + 17, by - 6, 1, 1, '#ffe9a0'); lamp(x + 17, by - 6, 3, 2);
    });
  }

  function bus(x, by, dir) {
    mirrored(x, 36, dir, () => {
      R(x, by - 23, 36, 20, '#d42a1e');
      R(x, by - 12, 36, 1, '#a51f15');
      for (let i = 2; i < 34; i += 5) { win(x + i, by - 21, 4, 5); win(x + i, by - 10, 4, 4); }
      R(x + 34, by - 21, 2, 5, '#2d3a4f');
      R(x + 3, by - 4, 6, 4, '#111'); R(x + 26, by - 4, 6, 4, '#111');
      R(x + 35, by - 6, 1, 2, '#ffe9a0'); lamp(x + 35, by - 6, 3, 2);
    });
  }

  function horse(x, by, f) {
    R(x + 2, by - 13, 14, 6, '#7a4a24');
    const a = f ? 1 : -1;
    R(x + 3 + a, by - 7, 2, 7, '#6a3d1c'); R(x + 6 - a, by - 7, 2, 7, '#6a3d1c');
    R(x + 12 + a, by - 7, 2, 7, '#6a3d1c'); R(x + 15 - a, by - 7, 2, 7, '#6a3d1c');
    R(x + 15, by - 18, 3, 7, '#7a4a24'); R(x + 16, by - 20, 5, 3, '#7a4a24'); R(x + 16, by - 21, 1, 1, '#7a4a24');
    R(x + 14, by - 19, 2, 6, '#3a2412'); R(x, by - 13, 2, 6, '#3a2412');
    R(x + 19, by - 19, 1, 1, '#111');
  }

  function wagon(x, by, dir) {
    mirrored(x, 44, dir, () => {
      horse(x + 23, by, frame());
      R(x + 20, by - 9, 5, 1, '#5a3a1e');
      R(x, by - 22, 22, 14, '#b22a2a');
      R(x - 1, by - 25, 24, 3, '#2e6b3a'); R(x + 2, by - 27, 18, 2, '#2e6b3a');
      R(x, by - 22, 22, 1, '#e0b23a'); R(x, by - 9, 22, 1, '#e0b23a');
      win(x + 8, by - 19, 5, 5);
      R(x + 16, by - 30, 2, 4, '#333');
      R(x + 1, by - 8, 7, 7, '#e0b23a'); R(x + 3, by - 6, 3, 3, '#5a3a1e');
      R(x + 14, by - 8, 7, 7, '#e0b23a'); R(x + 16, by - 6, 3, 3, '#5a3a1e');
    });
  }

  function motorbike(x, by, f) {
    R(x, by - 5, 5, 5, '#111'); R(x + 12, by - 5, 5, 5, '#111');
    R(x + 1 + f, by - 4, 1, 1, '#888'); R(x + 14 - f, by - 3, 1, 1, '#888');
    R(x + 3, by - 8, 11, 3, '#c0392b'); R(x + 6, by - 10, 5, 2, '#e74c3c');
    R(x + 13, by - 12, 2, 5, '#888'); R(x + 1, by - 9, 4, 1, '#555');
    R(x + 6, by - 17, 4, 7, '#222'); R(x + 9, by - 15, 5, 2, '#222'); R(x + 7, by - 10, 4, 2, '#334');
    R(x + 6, by - 21, 5, 4, '#f1c40f'); R(x + 9, by - 20, 2, 2, '#111');
    R(x + 15, by - 9, 2, 2, '#ffe9a0'); lamp(x + 16, by - 9, 4, 2);
  }

  function horseRider(x, by, f) {
    horse(x, by, f);
    R(x + 7, by - 21, 4, 8, '#2c5aa0'); R(x + 10, by - 18, 4, 2, '#2c5aa0');
    R(x + 7, by - 25, 4, 4, '#f0c8a0');
    R(x + 6, by - 26, 6, 1, '#3a2a1a'); R(x + 7, by - 28, 4, 2, '#3a2a1a');
    R(x + 8, by - 14, 2, 5, '#3a2a1a');
  }

  const obstacleArt = {
    cone: [6, 8, (x, by) => { R(x + 2, by - 8, 2, 2, '#ff7a1a'); R(x + 1, by - 6, 4, 2, '#fff'); R(x + 1, by - 4, 4, 2, '#ff7a1a'); R(x, by - 2, 6, 2, '#ff7a1a'); }],
    barrier: [14, 9, (x, by) => { for (let i = 0; i < 14; i += 4) { R(x + i, by - 9, 2, 3, '#d22'); R(x + i + 2, by - 9, 2, 3, '#fff'); } R(x + 1, by - 6, 1, 6, '#ddd'); R(x + 12, by - 6, 1, 6, '#ddd'); lamp(x + 6, by - 11, 2, 2, '#ffb040'); }],
    bale: [10, 8, (x, by) => { R(x, by - 8, 10, 8, '#d9b44a'); R(x, by - 5, 10, 1, '#b8932e'); R(x + 3, by - 8, 1, 8, '#b8932e'); }],
    bales: [20, 8, (x, by) => { for (const o of [0, 10]) { R(x + o, by - 8, 10, 8, '#d9b44a'); R(x + o, by - 5, 10, 1, '#b8932e'); R(x + o, by - 8, 1, 8, '#b8932e'); } }],
    fence: [12, 11, (x, by) => { R(x, by - 11, 2, 11, '#7a5230'); R(x + 10, by - 11, 2, 11, '#7a5230'); R(x, by - 9, 12, 2, '#a0703f'); R(x, by - 5, 12, 2, '#a0703f'); }],
  };

  /* ---------- Traffic ---------- */
  const carCols = ['#2e86de', '#f5f6fa', '#e1b12c', '#44bd32', '#8c7ae6', '#c23616'];
  function spawnVehicle(lane, region, baseSpeed) {
    const london = region === 'London';
    const roll = Math.random();
    const type = london ? (roll < 0.4 ? 'bus' : roll < 0.6 ? 'cab' : 'car') : (roll < 0.45 ? 'wagon' : 'car');
    const w = { bus: 36, car: 18, cab: 18, wagon: 44 }[type];
    const lastInLane = vehicles.filter((v) => v.lane === lane).pop();
    if (lastInLane && lastInLane.x + lastInLane.w > W - 6) return;
    const slow = type === 'wagon' ? 0.4 : 1;
    vehicles.push({
      type, w, lane,
      x: W + 4,
      by: lane === 'far' ? FAR : NEAR,
      dir: lane === 'far' ? 1 : -1,
      col: type === 'cab' ? '#1c1c1c' : carCols[Math.floor(Math.random() * carCols.length)],
      vx: lane === 'near' ? -(baseSpeed + 30 + Math.random() * 20) * (type === 'wagon' ? 0.8 : 1) : -(baseSpeed * (0.3 + Math.random() * 0.3)) / slow * 0.6,
    });
  }

  function updateTraffic(dt, region, baseSpeed, lanes) {
    for (const lane of lanes) {
      laneTimer[lane] -= dt;
      if (laneTimer[lane] <= 0) {
        spawnVehicle(lane, region, baseSpeed);
        laneTimer[lane] = (lane === 'far' ? 1.5 : 2.5) + Math.random() * 3;
      }
    }
    vehicles.forEach((v) => { v.x += v.vx * dt; });
    vehicles = vehicles.filter((v) => v.x > -60 && lanes.includes(v.lane));
  }

  function drawVehicle(v) {
    if (v.type === 'bus') bus(v.x, v.by, v.dir);
    else if (v.type === 'wagon') wagon(v.x, v.by, v.dir);
    else car(v.x, v.by, v.col, v.dir, v.type === 'cab');
  }

  /* ---------- Sky, night, lights ---------- */
  function drawSun() {
    if (night) return;
    for (const [cx, cy, s] of clouds) {
      const x = ((cx * (W + 60) - t * 3 - bxNow * 0.15) % (W + 60) + W + 60) % (W + 60) - 30;
      R(x, cy, s, 4, '#ffffff'); R(x + 3, cy - 3, s - 6, 3, '#ffffff');
    }
    R(W - 34, 12, 10, 10, '#ffd84a'); R(W - 36, 14, 14, 6, '#ffd84a'); R(W - 32, 10, 6, 14, '#ffd84a');
  }

  function finishNight() {
    if (!night) return;
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(8, 14, 40, 0.58)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    for (const [x, y, w, h, c] of lights) R(x, y, w, h, c);
    // Lighthouse beam
    const lx = 2254 - bxNow;
    if (lx > -80 && lx < W + 80) {
      const sw = Math.sin(t * 1.6) * 70;
      ctx.fillStyle = 'rgba(255, 240, 170, 0.28)';
      ctx.beginPath(); ctx.moveTo(lx, G - 68); ctx.lineTo(lx + sw, G - 78); ctx.lineTo(lx + sw, G - 60); ctx.fill();
    }
    // Stars and moon go behind everything already drawn
    ctx.globalCompositeOperation = 'destination-over';
    for (const [sx, sy] of stars) R(sx * W, sy * H, 1, 1, (Math.floor(t * 2 + sx * 10) % 7) ? '#ffffff' : '#9fb4ff');
    R(W - 34, 10, 10, 12, '#f2f0d8'); R(W - 30, 10, 6, 10, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- Game state ---------- */
  const game = {};
  function resetGame() {
    Object.assign(game, { gt: 0, speed: 75, h: 0, vy: 0, obstacles: [], gap: 120, over: false, won: false, started: false });
    vehicles = [];
    msg.hidden = false;
    msg.innerHTML = 'Press SPACE or tap to jump<br>Ride from London to Dover!';
  }

  function startGame() {
    mode = 'game';
    btnPlay.innerHTML = '&#9632; Stop';
    resetGame();
    cvs.focus && cvs.focus();
  }

  function stopGame() {
    mode = 'video';
    btnPlay.innerHTML = '&#9654; Play';
    msg.hidden = true;
    vehicles = [];
  }

  function jump() {
    if (mode !== 'game') return;
    if (game.over || game.won) { resetGame(); return; }
    if (!game.started) { game.started = true; msg.hidden = true; }
    if (game.h === 0) game.vy = 155;
  }

  function updateGame(dt) {
    if (!game.started || game.over || game.won) return;
    game.gt += dt;
    if (game.gt >= GAME_T) {
      game.gt = GAME_T; game.won = true; msg.hidden = false;
      msg.innerHTML = 'You made it to the white cliffs of Dover!<br>Press SPACE or tap to ride again';
      return;
    }
    game.speed = 75 + 60 * Math.min(1, game.gt / 300);
    roadScroll += game.speed * dt;
    game.vy -= 460 * dt;
    game.h = Math.max(0, game.h + game.vy * dt);
    if (game.h === 0) game.vy = Math.max(0, game.vy);

    game.gap -= game.speed * dt;
    if (game.gap <= 0) {
      const region = regionAt(bxNow + W);
      const pool = region === 'London' ? ['cone', 'cone', 'barrier'] : ['bale', 'fence', 'bales'];
      const kind = pool[Math.floor(Math.random() * pool.length)];
      game.obstacles.push({ kind, x: W + 4 });
      game.gap = game.speed * (0.95 + Math.random() * 1.6) + 30;
    }
    game.obstacles.forEach((o) => { o.x -= game.speed * dt; });
    game.obstacles = game.obstacles.filter((o) => o.x > -30);

    // Collision
    const london = regionAt(bxNow + 40) === 'London';
    const pw = london ? 17 : 21, ph = london ? 21 : 26;
    const px0 = 30 + 3, px1 = 30 + pw - 3, pyBottom = NEAR - game.h;
    for (const o of game.obstacles) {
      const [ow, oh] = obstacleArt[o.kind];
      if (px1 > o.x + 1 && px0 < o.x + ow - 1 && pyBottom > NEAR - oh + 1 && pyBottom - ph < NEAR) {
        game.over = true; msg.hidden = false;
        msg.innerHTML = 'Crash! You got ' + fmt(game.gt) + ' of the way<br>Press SPACE or tap to try again';
        break;
      }
    }
  }

  const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  /* ---------- Main loop ---------- */
  function tick(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    t += dt;
    if (cvs.width !== W || !cvs.height) resize();

    let progress, baseSpeed;
    if (mode === 'video') {
      videoT = (videoT + dt) % (VIDEO_T + 5);
      progress = Math.min(1, videoT / VIDEO_T);
      baseSpeed = 60;
      roadScroll += baseSpeed * dt;
    } else {
      updateGame(dt);
      progress = game.gt / GAME_T;
      baseSpeed = game.speed;
    }
    const bx = progress * (BG_LEN - W);
    const region = regionAt(bx + W / 2);
    if (!(mode === 'game' && (game.over || game.won || !game.started)))
      updateTraffic(dt, regionAt(bx + W), baseSpeed, mode === 'video' ? ['far', 'near'] : ['far']);

    lights = [];
    ctx.clearRect(0, 0, W, H);
    bxNow = bx;
    drawSun();
    drawBackground(bx);
    drawRoad(region);
    vehicles.filter((v) => v.lane === 'far').forEach(drawVehicle);
    vehicles.filter((v) => v.lane === 'near').forEach(drawVehicle);

    if (mode === 'game') {
      for (const o of game.obstacles) obstacleArt[o.kind][2](o.x, NEAR);
      const f = game.started && !game.over && game.h === 0 ? frame() : 0;
      const py = NEAR - Math.round(game.h);
      if (regionAt(bx + 40) === 'London') motorbike(30, py, f);
      else horseRider(30, py, f);
      hud.innerHTML = region + '<br>' + fmt(game.gt) + ' / 10:00';
    } else {
      hud.innerHTML = region === 'Dover' ? 'Dover, Kent coast' : region;
    }
    finishNight();
    requestAnimationFrame(tick);
  }
  let last = 0;

  /* ---------- Controls ---------- */
  btnNight.addEventListener('click', () => {
    night = !night;
    document.body.classList.toggle('night', night);
    btnNight.innerHTML = night ? '&#9728; Day' : '&#9790; Night';
  });
  btnPlay.addEventListener('click', () => (mode === 'game' ? stopGame() : startGame()));
  window.addEventListener('keydown', (e) => {
    if (mode !== 'game') return;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
    if (e.code === 'Escape') stopGame();
  });
  cvs.addEventListener('pointerdown', (e) => { if (mode === 'game') { e.preventDefault(); jump(); } });

  requestAnimationFrame(tick);
})();
