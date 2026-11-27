/**
 * 物理与数学小工具
 */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function approach(v, target, delta) {
  if (v < target) return Math.min(v + delta, target);
  return Math.max(v - delta, target);
}

export function aabb(a, b) {
  return a.x - a.w / 2 < b.x + b.w / 2
    && a.x + a.w / 2 > b.x - b.w / 2
    && a.y - a.h / 2 < b.y + b.h / 2
    && a.y + a.h / 2 > b.y - b.h / 2;
}

export function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
