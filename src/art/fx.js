/**
 * 特效系统
 * ------------------------------------------------------------------
 * 所有粒子都使用 AI 原创贴图（火花/血/尘土/冰晶/酸液/爆炸），
 * 不做几何占位。屏幕震动、闪白、伤害数字、闪电链也集中在这里。
 */
import { assets } from '../core/assets.js';

export class FX {
  constructor(quality) {
    this.q = quality;
    this.particles = [];
    this.numbers = [];
    this.bolts = [];
    this.flashes = [];
    this.shakeAmt = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.time = 0;
    this.enabled = true;
  }

  clear() {
    this.particles.length = 0;
    this.numbers.length = 0;
    this.bolts.length = 0;
    this.flashes.length = 0;
    this.shakeAmt = 0;
  }

  add(sprite, x, y, opt = {}) {
    if (this.particles.length > 420) return;
    const {
      vx = 0, vy = 0, size = 60, life = 0.6, grow = 0, rot = 0, vr = 0,
      gravity = 0, alpha = 1, additive = false, fadeIn = 0, stretch = 0,
    } = opt;
    this.particles.push({
      sprite, x, y, vx, vy, size, life, maxLife: life, grow, rot, vr,
      gravity, alpha, additive, fadeIn, stretch, age: 0, seed: Math.random() * 6.28,
    });
  }

  burst(sprite, x, y, count, opt = {}) {
    const n = Math.max(1, Math.round(count * (this.q.particles || 1)));
    for (let i = 0; i < n; i++) {
      const a = opt.angle !== undefined ? opt.angle + (Math.random() - 0.5) * (opt.spread || 1.4) : Math.random() * Math.PI * 2;
      const sp = (opt.speed || 260) * (0.45 + Math.random() * 0.8);
      this.add(sprite, x + (Math.random() - 0.5) * (opt.jitter || 18), y + (Math.random() - 0.5) * (opt.jitter || 18), {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        size: (opt.size || 60) * (0.6 + Math.random() * 0.8),
        life: (opt.life || 0.6) * (0.7 + Math.random() * 0.7),
        gravity: opt.gravity || 0,
        grow: opt.grow || 0,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 4,
        alpha: opt.alpha || 1,
        additive: !!opt.additive,
      });
    }
  }

  muzzle(x, y, angle = 0) {
    this.add('fx_muzzle', x, y, {
      vx: Math.cos(angle) * 60, vy: Math.sin(angle) * 60,
      size: 150, life: 0.09, rot: angle, additive: true, alpha: 1,
    });
    this.burst('fx_dust', x - 20, y, 3, { speed: 90, size: 26, life: 0.28, angle: angle + Math.PI, spread: 0.9, alpha: 0.5 });
    this.burst('fx_fire', x + 18, y, 2, { speed: 160, size: 30, life: 0.14, additive: true, alpha: 0.7 });
  }

  impact(x, y, color = 'blood') {
    if (color === 'ice') {
      this.burst('fx_ice', x, y, 7, { speed: 300, size: 38, life: 0.5, gravity: 400, additive: true });
    } else if (color === 'fire') {
      this.burst('fx_fire', x, y, 8, { speed: 260, size: 56, life: 0.42, gravity: -80, additive: true });
    } else {
      this.burst('fx_blood', x, y, 6, { speed: 300, size: 46, life: 0.6, gravity: 900, angle: -0.4, spread: 1.5 });
    }
    this.burst('fx_dust', x, y, 3, { speed: 170, size: 34, life: 0.35, alpha: 0.55 });
  }

  hitSpark(x, y) {
    this.burst('fx_muzzle', x, y, 3, { speed: 340, size: 34, life: 0.18, additive: true });
  }

  death(x, y, scale = 1) {
    this.burst('fx_blood', x, y - 40 * scale, 10, { speed: 320 * scale, size: 54 * scale, life: 0.7, gravity: 900 });
    this.burst('fx_dust', x, y, 6, { speed: 220 * scale, size: 52 * scale, life: 0.5, alpha: 0.7 });
    this.add('fx_dust', x, y - 30, { size: 160 * scale, life: 0.5, grow: 180, alpha: 0.55 });
  }

  explosion(x, y, scale = 1) {
    this.add('fx_explosion', x, y, {
      size: 320 * scale, life: 0.5, grow: 340 * scale, additive: false, alpha: 1,
    });
    this.burst('fx_fire', x, y, 12, { speed: 320 * scale, size: 70 * scale, life: 0.55, gravity: -40, additive: true });
    this.burst('fx_dust', x, y, 8, { speed: 260 * scale, size: 90 * scale, life: 0.7, alpha: 0.5 });
    this.shake(16 * scale);
  }

  dust(x, y, scale = 1) {
    this.add('fx_dust', x, y, { size: 130 * scale, life: 0.55, grow: 120 * scale, alpha: 0.6 });
    this.burst('fx_dust', x, y, 4, { speed: 160 * scale, size: 40 * scale, life: 0.45, alpha: 0.5 });
  }

  shockwave(x, y, dir, width = 120, height = 90) {
    this.add('fx_dust', x, y, {
      vx: dir * 110, size: width, life: 1.0, grow: 60, alpha: 0.75, stretch: 0,
    });
    this.burst('fx_dust', x, y + 10, 8, {
      speed: 200, angle: dir > 0 ? 0 : Math.PI, spread: 0.5, size: 70, life: 0.55, alpha: 0.55,
    });
    this.shake(10);
  }

  bolt(points) {
    this.bolts.push({ points, life: 0.22, maxLife: 0.22, seed: Math.random() * 10 });
    for (const p of points) {
      if (Math.random() < 0.6) this.burst('fx_muzzle', p.x, p.y, 2, { speed: 200, size: 40, life: 0.18, additive: true });
    }
  }

  damage(x, y, text, { crit = false, color = '#fff3cf' } = {}) {
    this.numbers.push({
      x, y, vy: -110, life: 0.9, maxLife: 0.9, text: String(text), crit, color,
      drift: (Math.random() - 0.5) * 40,
    });
  }

  floatText(x, y, text, color = '#ffe9a8', size = 40) {
    this.numbers.push({
      x, y, vy: -80, life: 1.25, maxLife: 1.25, text, crit: false, color, size, drift: 0,
    });
  }

  flash(color = '#fff', alpha = 0.6, life = 0.25) {
    this.flashes.push({ color, alpha, life, maxLife: life });
  }

  shake(amount) {
    if (!this.enabled) return;
    this.shakeAmt = Math.min(26, this.shakeAmt + amount);
  }

  update(dt) {
    this.time += dt;
    const decay = Math.exp(-dt * 8);
    this.shakeAmt *= decay;
    if (this.shakeAmt < 0.12) this.shakeAmt = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shakeAmt;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeAmt;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.life -= dt;
      n.y += n.vy * dt;
      n.x += n.drift * dt;
      n.vy += 240 * dt;
      if (n.life <= 0) this.numbers.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].life -= dt;
      if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const img = assets.get(p.sprite);
      if (!img) continue;
      const k = p.age / p.life;
      let a = p.alpha;
      if (p.fadeIn && k < p.fadeIn) a *= k / p.fadeIn;
      a *= 1 - Math.max(0, (k - 0.55) / 0.45);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a);
      if (p.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      const ratio = img.width / img.height;
      if (p.stretch) {
        ctx.drawImage(img, -s * ratio * 0.5, -s * 0.2, s * ratio, s * 0.4);
      } else {
        ctx.drawImage(img, -s * ratio / 2, -s / 2, s * ratio, s);
      }
      ctx.restore();
    }

    // 闪电链
    for (const b of this.bolts) {
      const k = b.life / b.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = k;
      ctx.strokeStyle = 'rgba(140, 210, 255, 0.55)';
      ctx.lineWidth = 18;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      b.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.strokeStyle = '#fffbe0';
      ctx.lineWidth = 4;
      ctx.stroke();
      // 分叉
      ctx.globalAlpha = k * 0.75;
      ctx.lineWidth = 2.5;
      for (let i = 1; i < b.points.length - 1; i++) {
        if ((i + Math.floor(b.seed)) % 2) continue;
        const p = b.points[i];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(b.seed + i) * 70, p.y + Math.sin(b.seed * 2 + i) * 46);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 伤害数字
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numbers) {
      const k = n.life / n.maxLife;
      const alpha = Math.min(1, k * 2.2);
      const size = (n.size || (n.crit ? 62 : 42)) * (1 + (1 - k) * 0.18);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${Math.round(size)}px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(48, 22, 6, 0.86)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.crit ? '#ffd24a' : n.color;
      ctx.fillText(n.text, n.x, n.y);
    }
    ctx.restore();

    // 全屏闪白 / 冰冻
    for (const f of this.flashes) {
      const k = f.life / f.maxLife;
      ctx.save();
      ctx.globalAlpha = f.alpha * k;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.restore();
    }
  }
}

export default FX;
