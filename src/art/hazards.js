/**
 * 关卡机关绘制
 * ------------------------------------------------------------------
 * 每关一个专属机关，全部使用 AI 原创立绘 / 现有材质 + 光效：
 *   1 尘沙平原：风滚草（可击碎，掉补给）
 *   2 仙人掌峡谷：火药桶（引爆后范围伤害，可连锁）
 *   3 白骨之夜：灵魂方尖碑（全场僵尸持续回血，必须先拆）
 */
import { assets } from '../core/assets.js';
import { GAME_CONFIG } from '../../config/game.config.js';

const GY = GAME_CONFIG.meta.groundY;

let greenFireCache = null;
let totemPillarCache = null;

function greenFire() {
  if (greenFireCache) return greenFireCache;
  const fire = assets.get('fx_fire');
  if (!fire) return null;
  const c = document.createElement('canvas');
  c.width = fire.width;
  c.height = fire.height;
  const g = c.getContext('2d');
  g.drawImage(fire, 0, 0);
  // 只染火舌本身的像素，透明区域必须保持透明，否则会出现方块底
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(46, 224, 150, 0.96)';
  g.fillRect(0, 0, c.width, c.height);
  greenFireCache = c;
  return c;
}

function totemPillar() {
  const src = assets.get('prop_pillar');
  if (!src) return null;
  if (totemPillarCache && totemPillarCache.w === src.width) return totemPillarCache.c;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(78, 130, 112, 0.82)';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(70, 34, 96, 0.30)';
  g.fillRect(0, 0, c.width, c.height);
  totemPillarCache = { w: src.width, c };
  return c;
}

function groundShadow(ctx, x, w, alpha = 0.32) {
  const grad = ctx.createRadialGradient(x, GY + 4, 6, x, GY + 4, w * 0.55);
  grad.addColorStop(0, `rgba(24, 12, 4, ${alpha})`);
  grad.addColorStop(1, 'rgba(24, 12, 4, 0)');
  ctx.save();
  ctx.translate(x, GY + 4);
  ctx.scale(1, 0.26);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bar(ctx, x, y, w, ratio) {
  const h = 10;
  ctx.save();
  ctx.fillStyle = 'rgba(26, 14, 6, 0.78)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2 - 3, y - 3, w + 6, h + 6, 6);
  else ctx.rect(x - w / 2 - 3, y - 3, w + 6, h + 6);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#b8ff7a');
  grad.addColorStop(1, '#3fa32c');
  ctx.fillStyle = grad;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - w / 2, y, Math.max(2, w * ratio), h, 5);
  else ctx.rect(x - w / 2, y, Math.max(2, w * ratio), h);
  ctx.fill();
  ctx.restore();
}

function drawTumbleweed(ctx, hz, time) {
  const img = assets.get('hazard_tumbleweed');
  const s = hz.size;
  groundShadow(ctx, hz.x, s * 1.05, 0.34);
  if (!img) return;
  ctx.save();
  ctx.translate(hz.x, GY - s * 0.42 + Math.sin(time * 9 + hz.seed) * 3);
  ctx.rotate(hz.rot);
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  if (hz.hitFlash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hz.hitFlash * 2.2;
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
  }
  ctx.restore();
}

function drawKeg(ctx, hz, time) {
  const img = assets.get('hazard_keg');
  const h = hz.size;
  const w = h * (img ? img.width / img.height : 0.66);
  groundShadow(ctx, hz.x, w * 1.15, 0.36);
  if (!img) return;
  const charging = hz.fuse > 0;
  ctx.save();
  ctx.translate(hz.x, GY);
  if (charging) {
    const k = 1 - hz.fuse / 0.24;
    ctx.translate(Math.sin(time * 90) * 4 * k, 0);
    ctx.rotate(Math.sin(time * 70) * 0.04 * k);
  }
  // 引线火光
  const fx = hz.x + w * 0.32;
  const fy = GY - h * 0.96;
  const pulse = 0.65 + 0.35 * Math.sin(time * 12 + hz.seed);
  const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, 34);
  glow.addColorStop(0, `rgba(255, 210, 120, ${0.75 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 120, 20, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(fx, fy, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

function drawTotem(ctx, hz, time) {
  const pillar = totemPillar();
  const h = hz.size;
  const w = h * (pillar ? pillar.width / pillar.height : 0.28) * 1.38;
  const x = hz.x;
  const top = GY + 6 - h;
  const dim = hz.dormant ? 0.38 : 1;

  // 灵魂地面光晕
  const pulse = 0.5 + 0.5 * Math.sin(time * 3.4 + hz.seed);
  const g = ctx.createRadialGradient(x, GY - h * 0.5, 10, x, GY - h * 0.5, w * 2.4);
  g.addColorStop(0, `rgba(90, 255, 170, ${(0.20 + pulse * 0.12) * dim})`);
  g.addColorStop(0.55, `rgba(50, 220, 150, ${(0.10 + pulse * 0.06) * dim})`);
  g.addColorStop(1, 'rgba(20, 160, 110, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, GY - h * 0.5, w * 2.4, h * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  groundShadow(ctx, x, w * 1.5, 0.4);
  if (pillar) ctx.drawImage(pillar, x - w / 2, top, w, h);

  // 顶端灵魂火
  const fire = greenFire();
  if (fire) {
    const fw = w * 1.2 * (1 + Math.sin(time * 7 + hz.seed) * 0.08);
    const fh = h * 0.42;
    ctx.save();
    // 外焰用正常混合，保证在明亮背景上仍是幽绿而不是惨白
    ctx.globalAlpha = 0.95 * dim;
    ctx.drawImage(fire, x - fw / 2, top - fh * 0.66, fw, fh);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * dim;
    ctx.drawImage(fire, x - fw * 0.3, top - fh * 0.44, fw * 0.6, fh * 0.62);
    // 火心冷光
    const core = ctx.createRadialGradient(x, top - fh * 0.1, 2, x, top - fh * 0.1, w * 0.42);
    core.addColorStop(0, `rgba(200, 255, 228, ${(0.55 + pulse * 0.25) * dim})`);
    core.addColorStop(0.5, `rgba(90, 240, 160, ${0.20 * dim})`);
    core.addColorStop(1, 'rgba(40, 180, 120, 0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(x, top - fh * 0.1, w * 0.42, fh * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 环绕的魂屑
  for (let i = 0; i < 5; i++) {
    const a = time * 1.1 + i * 1.256 + hz.seed;
    const rx = w * 0.75 + Math.sin(a * 1.7) * 14;
    const py = top + h * (0.18 + ((i * 0.17 + time * 0.09) % 0.6));
    const alpha = (0.25 + 0.2 * Math.sin(time * 4 + i)) * dim;
    const rg = ctx.createRadialGradient(x + Math.cos(a) * rx, py, 1, x + Math.cos(a) * rx, py, 14);
    rg.addColorStop(0, `rgba(150, 255, 200, ${alpha})`);
    rg.addColorStop(1, 'rgba(80, 230, 160, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rx, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (hz.hp < hz.maxHp) bar(ctx, x, top - 34, Math.min(160, w * 1.5), Math.max(0, hz.hp / hz.maxHp));
}

export function drawHazard(ctx, hz, time) {
  if (hz.type === 'tumbleweed') drawTumbleweed(ctx, hz, time);
  else if (hz.type === 'keg') drawKeg(ctx, hz, time);
  else if (hz.type === 'totem') drawTotem(ctx, hz, time);
}

export default drawHazard;
