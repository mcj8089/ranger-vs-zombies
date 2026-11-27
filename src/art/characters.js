/**
 * 角色绘制
 * ------------------------------------------------------------------
 * 所有角色都来自 AI 原创立绘（带完整轮廓、材质与光影），没有几何拼接。
 * 这里只负责：帧选择、随速度/重力的姿态变化、受击染色、阴影与状态叠加。
 */
import { assets } from '../core/assets.js';
import { GAME_CONFIG } from '../../config/game.config.js';

const tintCache = new Map();

/** 给整张立绘染色（受击白闪 / 冰冻青蓝），结果缓存，避免每帧重画 */
function tinted(img, color, alpha) {
  if (!img) return null;
  const key = `${img.src.length}|${img.src.slice(0, 48)}|${color}|${alpha}`;
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1;
  tintCache.set(key, c);
  return c;
}

function shadow(ctx, x, groundY, w, alpha = 0.32, squash = 0.18) {
  const h = w * squash;
  const grad = ctx.createRadialGradient(x, groundY, h * 0.2, x, groundY, w * 0.5);
  grad.addColorStop(0, `rgba(28, 14, 4, ${alpha})`);
  grad.addColorStop(1, 'rgba(28, 14, 4, 0)');
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(1, squash * 2.4);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const HERO_FRAMES = ['hero_0', 'hero_1', 'hero_2', 'hero_3'];

/** 输出枪口/抛壳位置（屏幕坐标），供 FX 与自动瞄准使用 */
export function heroMuzzle(s) {
  const img = assets.get(s.onGround ? HERO_FRAMES[s.frame] : 'hero_jump');
  const h = GAME_CONFIG.player.height;
  const w = h * (img ? img.width / img.height : 0.72);
  const top = s.feetY - h;
  // 跑动帧枪口在画面约 88% 宽度 / 52% 高度；跳跃帧更靠前、更靠上
  const rx = s.onGround ? 0.38 : 0.44;
  const ry = s.onGround ? 0.51 : 0.43;
  return { x: s.x + w * rx, y: top + h * ry, w, top };
}

export function drawHero(ctx, s, time, quality) {
  const onGround = s.onGround;
  const img = assets.get(onGround ? HERO_FRAMES[s.frame] : 'hero_jump');
  if (!img) return;
  const h = GAME_CONFIG.player.height;
  const w = h * (img.width / img.height);
  const bob = onGround ? Math.sin(s.runPhase * 2) * 2.2 : 0;
  const feetY = s.feetY + bob;

  shadow(ctx, s.x + 6, GAME_CONFIG.meta.groundY + 6, w * 0.82, s.onGround ? 0.34 : 0.18);

  ctx.save();
  ctx.translate(s.x, feetY - h / 2);

  // 受击无敌闪烁
  if (s.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;

  // 起跳/下落时轻微前倾，落地压扁；前后走位时身体跟着倾一点
  let rot = s.lean || 0;
  if (!onGround) rot = Math.max(-0.09, Math.min(0.12, s.vy / 14000));
  let sx = 1, sy = 1;
  if (s.landSquash > 0) {
    const k = s.landSquash;
    sx = 1 + 0.12 * k;
    sy = 1 - 0.14 * k;
  }
  if (s.jumpStretch > 0) {
    const k = s.jumpStretch;
    sx = 1 - 0.05 * k;
    sy = 1 + 0.06 * k;
  }
  ctx.rotate(rot);
  ctx.scale(sx, sy);

  // 枪口后坐：整张图轻微后移
  const kick = s.recoil > 0 ? s.recoil * 3.2 : 0;
  ctx.drawImage(img, -w / 2 - kick, -h / 2, w, h);
  ctx.restore();

  // 护盾：柔光护罩 + 像素级高光（非几何描边）
  if (s.shield > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 6);
    const cx = s.x, cy = feetY - h * 0.52;
    const r = h * 0.62;
    const g = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, 'rgba(120, 220, 255, 0)');
    g.addColorStop(0.82, `rgba(120, 220, 255, ${0.10 + pulse * 0.06})`);
    g.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.78, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function healthBar(ctx, x, y, w, ratio) {
  const h = 9;
  ctx.save();
  ctx.fillStyle = 'rgba(32, 18, 8, 0.75)';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w / 2 - 2, y - 2, w + 4, h + 4, 5) : ctx.rect(x - w / 2 - 2, y - 2, w + 4, h + 4);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, ratio > 0.4 ? '#b6f06a' : '#ff9a6a');
  grad.addColorStop(1, ratio > 0.4 ? '#4f9c25' : '#c2412a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x - w / 2, y, w * ratio, h, 4) : ctx.rect(x - w / 2, y, w * ratio, h);
  ctx.fill();
  ctx.restore();
}

export function drawZombie(ctx, e, time) {
  const img = assets.get(e.sprite);
  if (!img) return;
  const h = e.height;
  const w = h * (img.width / img.height);
  const walk = Math.sin(e.phase);
  const bob = Math.abs(walk) * (e.kind === 'flyer' ? 0 : 4.5);

  // 灵魂图腾生效时，所有小怪脚下透出绿色魂光
  if (e.game && e.game.totemBuff) {
    const gx = e.x;
    const gy = e.kind === 'flyer' ? e.y + 10 : GAME_CONFIG.meta.groundY + 6;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5 + e.seed);
    const rg = ctx.createRadialGradient(gx, gy, 4, gx, gy, w * 0.62);
    rg.addColorStop(0, `rgba(110, 255, 150, ${0.20 + pulse * 0.12})`);
    rg.addColorStop(1, 'rgba(60, 220, 120, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(gx, gy, w * 0.6, w * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (e.kind === 'flyer') {
    // 地面投影随高度变淡
    const groundGap = GAME_CONFIG.meta.groundY - e.y;
    const a = Math.max(0.05, 0.24 - groundGap / 4000);
    shadow(ctx, e.x + 20, GAME_CONFIG.meta.groundY + 4, w * 0.55, a);

    // 灵魂火环：压在立绘后面，亮度压低，避免糊住脸
    const fire = assets.get('fx_fire');
    if (fire) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 1 + Math.sin(time * 9 + e.seed) * 0.05;
      const fw = w * 1.06 * pulse;
      const fh = h * 1.12 * pulse;
      ctx.globalAlpha = 0.30;
      ctx.drawImage(fire, e.x - fw / 2, e.y - fh * 0.92, fw, fh);
      ctx.globalAlpha = 0.18;
      ctx.drawImage(fire, e.x - fw * 0.3, e.y - fh * 0.7, fw * 0.72, fh * 0.72);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(e.x, e.y - h / 2);
    ctx.rotate(Math.sin(time * 3 + e.seed) * 0.04 + (e.vx || 0) * -0.00002);
    const bobY = Math.sin(time * 2.6 + e.seed) * 7;
    let spr = img;
    if (e.hitFlash > 0) spr = tinted(img, '#fff4d6', 0.5) || img;
    else if (e.frozen > 0) spr = tinted(img, '#8bdcff', 0.5) || img;
    ctx.translate(0, bobY);
    if (e.frozen > 0) {
      ctx.shadowColor = 'rgba(130, 220, 255, 0.85)';
      ctx.shadowBlur = 22;
    }
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (e.hp < e.maxHp) healthBar(ctx, e.x, e.y - h * 1.02 - 14, Math.min(110, w * 0.8), Math.max(0, e.hp / e.maxHp));
    return;
  }

  shadow(ctx, e.x + 10, GAME_CONFIG.meta.groundY + 8, w * 0.72, 0.3);
  ctx.save();
  ctx.translate(e.x, GAME_CONFIG.meta.groundY - h / 2 - bob);
  ctx.rotate(walk * 0.028);
  if (e.kind === 'boss') {
    // boss 用独立的绘制，不会走到这里
  }
  let spr = img;
  if (e.hitFlash > 0) spr = tinted(img, '#fff4d6', 0.45) || img;
  else if (e.frozen > 0) spr = tinted(img, '#8bdcff', 0.5) || img;
  if (e.frozen > 0) {
    ctx.shadowColor = 'rgba(130, 220, 255, 0.8)';
    ctx.shadowBlur = 18;
  }
  ctx.drawImage(spr, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (e.frozen > 0) {
    const ice = assets.get('fx_ice');
    if (ice) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(ice, e.x - w * 0.2, GAME_CONFIG.meta.groundY - h * 0.62, w * 0.4, w * 0.4);
      ctx.restore();
    }
  }

  if (e.hp < e.maxHp) healthBar(ctx, e.x, GAME_CONFIG.meta.groundY - h - 22, Math.min(120, w * 0.75), Math.max(0, e.hp / e.maxHp));
}

export function drawBoss(ctx, b, time) {
  const img = assets.get('boss_crowned');
  if (!img) return;
  const h = GAME_CONFIG.boss.height;
  const w = h * (img.width / img.height);
  const groundY = GAME_CONFIG.meta.groundY;

  shadow(ctx, b.x + 10, groundY + 10, w * 0.95, 0.4, 0.22);

  // 二阶段红色怒气光环
  if (b.phase2) {
    const pulse = 0.65 + 0.35 * Math.sin(time * 7);
    const g = ctx.createRadialGradient(b.x, groundY - h * 0.45, w * 0.2, b.x, groundY - h * 0.45, w * 0.95);
    g.addColorStop(0, `rgba(255, 70, 30, ${0.24 * pulse})`);
    g.addColorStop(0.6, `rgba(200, 20, 20, ${0.14 * pulse})`);
    g.addColorStop(1, 'rgba(120, 0, 0, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(b.x - w, groundY - h * 1.2, w * 2, h * 1.5);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(b.x, groundY - h / 2);

  let rot = 0, sx = 1, sy = 1;
  if (b.state === 'telegraph') {
    rot = Math.sin(time * 30) * 0.018;
    sx = 0.98; sy = 1.03;
  } else if (b.state === 'charge') {
    rot = -0.08;
  } else if (b.state === 'stun') {
    rot = 0.06;
  } else if (b.state === 'slam') {
    sy = 0.92; sx = 1.06;
  }
  ctx.rotate(rot);
  ctx.scale(sx, sy);

  let spr = img;
  if (b.hitFlash > 0) spr = tinted(img, '#ffffff', 0.7) || img;
  else if (b.frozen > 0) spr = tinted(img, '#8bdcff', 0.42) || img;
  ctx.drawImage(spr, -w / 2, -h / 2, w, h);
  ctx.restore();

  // 王冠高光
  const crownY = groundY - h + h * 0.07;
  const glow = 0.4 + 0.25 * Math.sin(time * 4);
  const g2 = ctx.createRadialGradient(b.x + w * 0.04, crownY, 4, b.x + w * 0.04, crownY, w * 0.24);
  g2.addColorStop(0, `rgba(255, 236, 150, ${glow})`);
  g2.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(b.x + w * 0.04, crownY, w * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPickup(ctx, p, time) {
  const img = assets.get(p.sprite);
  if (!img) return;
  const s = p.size;
  const bob = Math.sin(time * 3.2 + p.seed) * (p.type === 'special' ? 8 : 6);
  const glowColor = p.glow || 'rgba(255, 230, 140, 0.55)';
  const pulse = 0.5 + 0.5 * Math.sin(time * 4.4 + p.seed);
  const glowR = s * (p.type === 'special' ? 1.25 + pulse * 0.12 : 1.05);
  const g = ctx.createRadialGradient(p.x, p.y + bob, s * 0.2, p.x, p.y + bob, glowR);
  g.addColorStop(0, glowColor);
  g.addColorStop(1, 'rgba(255, 240, 180, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 特殊子弹宝箱：围绕箱体旋转的弹壳火星，和普通补给一眼区分
  if (p.type === 'special') {
    const spark = assets.get('fx_muzzle');
    if (spark) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = time * 1.9 + i * 1.57 + p.seed;
        const rx = Math.cos(a) * s * 0.72;
        const ry = Math.sin(a * 1.3) * s * 0.34;
        ctx.globalAlpha = 0.32 + 0.28 * Math.sin(time * 5 + i * 1.7);
        ctx.drawImage(spark, p.x + rx - 17, p.y + bob + ry - 17, 34, 34);
      }
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.rotate(Math.sin(time * 2 + p.seed) * 0.06);
  const ratio = img.width / img.height;
  ctx.drawImage(img, -s * ratio / 2, -s / 2, s * ratio, s);
  ctx.restore();

  // 宝箱顶部悬浮的子弹类型徽章
  if (p.type === 'special' && p.icon) {
    const badge = assets.get(p.icon);
    if (badge) {
      const bh = 62 + pulse * 6;
      const iy = p.y + bob - s * 0.82 - Math.sin(time * 3.4 + p.seed) * 5;
      const halo = ctx.createRadialGradient(p.x, iy, 4, p.x, iy, bh * 0.8);
      halo.addColorStop(0, p.tint || '#ffe6a8');
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, iy, bh * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const br = badge.width / badge.height;
      ctx.save();
      ctx.translate(p.x, iy);
      ctx.rotate(Math.sin(time * 2.6 + p.seed) * 0.12);
      ctx.drawImage(badge, -bh * br / 2, -bh / 2, bh * br, bh);
      ctx.restore();
    }
  }
}

/** 教程用手势图标 / 高亮环（由 UI 的 canvas 图层绘制） */
export function drawGuideRing(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, r * 0.45, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.72, color.replace('ALPHA', String(alpha)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
