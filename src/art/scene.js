/**
 * 场景 / 动态背景
 * ------------------------------------------------------------------
 * 层次（远→近）：天空渐变 + 日月 + 星点 → 远景荒漠图 → 雾带 → 云
 * → 远道具（仙人掌/石柱）→ 地面贴图 → 近道具 → 前景草丛 → 沙尘 → 暗角。
 * 章节切换时色板渐变过渡，太阳/月亮位置随一局进度缓慢移动。
 */
import { assets } from '../core/assets.js';
import { GAME_CONFIG } from '../../config/game.config.js';

const W = GAME_CONFIG.meta.width;
const H = GAME_CONFIG.meta.height;
const GY = GAME_CONFIG.meta.groundY;

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}
function css(c, a = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function numericPalette(p) {
  return {
    skyTop: hexToRgb(p.skyTop),
    skyBottom: hexToRgb(p.skyBottom),
    sun: hexToRgb(p.sun),
    sunGlow: p.sunGlow,
    sunX: p.sunX,
    sunY: p.sunY,
    sunR: p.sunR,
    wash: p.wash,
    haze: p.haze,
    groundLight: hexToRgb(p.groundLight),
    groundDark: hexToRgb(p.groundDark),
    fg: p.fg,
    cloudAlpha: p.cloudAlpha,
    starAlpha: p.starAlpha,
    ambient: hexToRgb(p.ambient),
  };
}

export class Scene {
  constructor(quality) {
    this.q = quality;
    this.seed = 20261024;
    this.clouds = [];
    this.farProps = [];
    this.nearProps = [];
    this.dust = [];
    this.stars = [];
    this.scroll = 0;
    this.time = 0;
    this.palette = numericPalette({
      skyTop: '#79c9ec', skyBottom: '#ffe6b8', sun: '#fff7d2',
      sunGlow: 'rgba(255,240,180,0.85)', sunX: 0.74, sunY: 0.18, sunR: 150,
      wash: 'rgba(255,196,120,0.10)', haze: 'rgba(255,226,172,0.42)',
      groundLight: '#f6c477', groundDark: '#a25f26', fg: 'rgba(92,52,20,0.92)',
      cloudAlpha: 0.92, starAlpha: 0, ambient: '#ffe4b0',
    });
    this.fromPalette = this.palette;
    this.toPalette = this.palette;
    this.paletteMix = 1;
    this.paletteSpeed = 0.42;
    this._buildProps();
    this._buildClouds();
    this._buildDust();
    this._buildStars();
  }

  _buildProps() {
    const rnd = mulberry32(this.seed);
    const kinds = ['cactus', 'rock', 'pillar', 'bush', 'ladder'];
    this.farProps = [];
    for (let i = 0; i < this.q.props; i++) {
      this.farProps.push({
        kind: kinds[Math.floor(rnd() * kinds.length)],
        x: i * (W / this.q.props) + rnd() * 140,
        scale: 0.34 + rnd() * 0.26,
        flip: rnd() > 0.5,
        tint: 0.55 + rnd() * 0.2,
      });
    }
    this.nearProps = [];
    for (let i = 0; i < Math.max(3, Math.floor(this.q.props * 0.5)); i++) {
      this.nearProps.push({
        kind: rnd() > 0.55 ? 'rock' : 'bush',
        x: i * (W / Math.max(3, Math.floor(this.q.props * 0.5))) + rnd() * 220,
        scale: 0.35 + rnd() * 0.3,
        flip: rnd() > 0.5,
      });
    }
  }

  _buildClouds() {
    const rnd = mulberry32(this.seed + 7);
    const n = this.q.clouds;
    this.clouds = [];
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        sprite: 'cloud_' + (i % 3),
        x: rnd() * W,
        y: 70 + rnd() * 260,
        scale: 0.75 + rnd() * 0.9,
        speed: 6 + rnd() * 12,
        alpha: 0.55 + rnd() * 0.35,
      });
    }
  }

  _buildDust() {
    const rnd = mulberry32(this.seed + 31);
    this.dust = [];
    const n = Math.round(46 * this.q.particles);
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x: rnd() * W,
        y: 120 + rnd() * (GY - 100),
        vx: -(18 + rnd() * 46),
        vy: (rnd() - 0.5) * 12,
        size: 8 + rnd() * 26,
        alpha: 0.08 + rnd() * 0.22,
        phase: rnd() * Math.PI * 2,
      });
    }
  }

  _buildStars() {
    const rnd = mulberry32(this.seed + 77);
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: rnd() * W,
        y: 30 + rnd() * 420,
        r: 1 + rnd() * 2.6,
        a: 0.25 + rnd() * 0.6,
        phase: rnd() * Math.PI * 2,
      });
    }
  }

  setPalette(name, palettes) {
    const target = numericPalette(palettes[name]);
    if (!target) return;
    this.fromPalette = this._snapshotPalette();
    this.toPalette = target;
    this.paletteMix = 0;
  }

  _snapshotPalette() {
    return Object.assign({}, this.palette);
  }

  _mixPalette(dt) {
    if (this.paletteMix >= 1) return;
    this.paletteMix = Math.min(1, this.paletteMix + dt * this.paletteSpeed);
    const t = this.paletteMix;
    const a = this.fromPalette, b = this.toPalette;
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.palette = {
      skyTop: mix(a.skyTop, b.skyTop, ease),
      skyBottom: mix(a.skyBottom, b.skyBottom, ease),
      sun: mix(a.sun, b.sun, ease),
      sunGlow: b.sunGlow,
      sunX: a.sunX + (b.sunX - a.sunX) * ease,
      sunY: a.sunY + (b.sunY - a.sunY) * ease,
      sunR: a.sunR + (b.sunR - a.sunR) * ease,
      wash: b.wash,
      haze: b.haze,
      groundLight: mix(a.groundLight, b.groundLight, ease),
      groundDark: mix(a.groundDark, b.groundDark, ease),
      fg: b.fg,
      cloudAlpha: a.cloudAlpha + (b.cloudAlpha - a.cloudAlpha) * ease,
      starAlpha: a.starAlpha + (b.starAlpha - a.starAlpha) * ease,
      ambient: mix(a.ambient, b.ambient, ease),
    };
  }

  update(dt, scrollDelta, speed) {
    this.time += dt;
    this.scroll += scrollDelta;
    this._mixPalette(dt);
    for (const c of this.clouds) {
      c.x -= (c.speed + speed * 0.012) * dt;
      if (c.x < -500) c.x = W + 200 + Math.random() * 200;
    }
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt + Math.sin(this.time * 2 + d.phase) * 0.3;
      if (d.x < -60) {
        d.x = W + Math.random() * 120;
        d.y = 120 + Math.random() * (GY - 100);
      }
    }
  }

  draw(ctx, camera) {
    const p = this.palette;
    const t = this.time;

    // ---------------- 天空
    const sky = ctx.createLinearGradient(0, 0, 0, GY + 40);
    sky.addColorStop(0, css(p.skyTop));
    sky.addColorStop(0.62, css(mix(p.skyTop, p.skyBottom, 0.72)));
    sky.addColorStop(1, css(p.skyBottom));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GY + 40);

    // ---------------- 星（夜里才可见）
    if (p.starAlpha > 0.02) {
      for (const s of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * 1.6 + s.phase);
        ctx.globalAlpha = p.starAlpha * s.a * tw;
        ctx.fillStyle = '#eaf3ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---------------- 日 / 月
    const sunX = p.sunX * W;
    const sunY = p.sunY * H;
    const halo = ctx.createRadialGradient(sunX, sunY, p.sunR * 0.3, sunX, sunY, p.sunR * 4.4);
    halo.addColorStop(0, p.sunGlow.replace(/[\d.]+\)$/, '0.55)'));
    halo.addColorStop(0.45, p.sunGlow.replace(/[\d.]+\)$/, '0.16)'));
    halo.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - p.sunR * 4.6, sunY - p.sunR * 4.6, p.sunR * 9.2, p.sunR * 9.2);
    const disc = ctx.createRadialGradient(sunX, sunY, 1, sunX, sunY, p.sunR);
    disc.addColorStop(0, css(p.sun, 0.98));
    disc.addColorStop(0.72, css(p.sun, 0.9));
    disc.addColorStop(1, css(p.sun, 0));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sunX, sunY, p.sunR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ---------------- 远景荒漠
    const bg = assets.get('bg_game');
    if (bg) {
      const dw = W * 1.14;
      const dh = dw * bg.height / bg.width;
      const sway = Math.sin(t * 0.05) * 14;
      const dx = (W - dw) / 2 - 20 + sway;
      const dy = GY - dh * 0.72;
      ctx.drawImage(bg, dx, dy, dw, dh);
      // 夜景压暗/染色
      ctx.fillStyle = p.wash;
      ctx.fillRect(dx, dy, dw, dh);
    }

    // ---------------- 地平线雾带
    const haze = ctx.createLinearGradient(0, GY - 300, 0, GY + 30);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(0.65, p.haze);
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, GY - 300, W, 330);

    // ---------------- 云
    for (const c of this.clouds) {
      const img = assets.get(c.sprite);
      if (!img) continue;
      const cw = 520 * c.scale;
      const ch = cw * img.height / img.width;
      ctx.globalAlpha = c.alpha * p.cloudAlpha;
      ctx.drawImage(img, c.x, c.y, cw, ch);
    }
    ctx.globalAlpha = 1;

    // ---------------- 远道具（视差 0.38）
    const farOffset = (this.scroll * 0.38) % W;
    for (const prop of this.farProps) {
      let x = prop.x - farOffset;
      if (x < -400) x += W;
      this._drawProp(ctx, prop, x, GY + 4, p, 0.55, camera);
    }

    // ---------------- 地面
    const tile = assets.get('ground_tile');
    if (tile) {
      const th = 256;
      const off = (this.scroll % 1024);
      for (let i = -1; i <= 2; i++) {
        ctx.drawImage(tile, i * 1024 - off, GY, 1024, th);
      }
      // 地面顶部高光 + 底部压暗
      const gl = ctx.createLinearGradient(0, GY, 0, GY + 26);
      gl.addColorStop(0, css(p.groundLight, 0.55));
      gl.addColorStop(1, css(p.groundLight, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(0, GY, W, 26);
      const gd = ctx.createLinearGradient(0, GY + 120, 0, H);
      gd.addColorStop(0, css(p.groundDark, 0));
      gd.addColorStop(1, css(p.groundDark, 0.85));
      ctx.fillStyle = gd;
      ctx.fillRect(0, GY + 100, W, H - GY - 100);
    } else {
      ctx.fillStyle = css(p.groundDark);
      ctx.fillRect(0, GY, W, H - GY);
    }

    // ---------------- 近道具（视差 0.9）
    const nearOffset = (this.scroll * 0.9) % W;
    for (const prop of this.nearProps) {
      let x = prop.x - nearOffset;
      if (x < -500) x += W;
      this._drawProp(ctx, prop, x, GY + 8, p, 1, camera);
    }

    // ---------------- 前景草丛（视差 1.22）
    const fg = assets.get('fg_grass');
    if (fg) {
      const fw = 1600;
      const fh = fw * fg.height / fg.width;
      const off = (this.scroll * 1.22) % fw;
      ctx.globalAlpha = 0.9;
      for (let i = -1; i <= 2; i++) {
        ctx.drawImage(fg, i * fw - off, H - fh + 26, fw, fh);
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, H - fh * 0.7, 0, H);
      shade.addColorStop(0, 'rgba(20,10,4,0)');
      shade.addColorStop(0.7, 'rgba(20,10,4,0.32)');
      shade.addColorStop(1, 'rgba(12,6,2,0.82)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, H - fh, W, fh);
    }

    // ---------------- 沙尘
    const dust = assets.get('fx_dust');
    if (dust && this.q.particles > 0.2) {
      for (const d of this.dust) {
        ctx.globalAlpha = d.alpha;
        const s = d.size;
        ctx.drawImage(dust, d.x, d.y, s, s * 0.5);
      }
      ctx.globalAlpha = 1;
    }

    // ---------------- 全局色温 / 暗角
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css(p.ambient, 0.16);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const vig = ctx.createRadialGradient(W / 2, H * 0.46, H * 0.35, W / 2, H * 0.5, H * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(24,10,2,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  _drawProp(ctx, prop, x, baseY, p, alpha, camera) {
    let key = 'prop_rock';
    if (prop.kind === 'cactus') key = 'prop_tree';
    else if (prop.kind === 'pillar') key = 'prop_pillar';
    else if (prop.kind === 'bush') key = 'prop_bush';
    else if (prop.kind === 'ladder') key = 'prop_ladder';
    const img = assets.get(key);
    if (!img) return;
    const h = (key === 'prop_pillar' ? 780 : 300) * prop.scale;
    const w = h * img.width / img.height;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (prop.flip) {
      ctx.translate(x + w, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(x, 0);
    }
    ctx.drawImage(img, 0, baseY - h, w, h);
    ctx.restore();
  }
}

export default Scene;
