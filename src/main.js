/**
 * 启动入口
 * ------------------------------------------------------------------
 * 顺序：域名校验 → 开屏文案/进度 → 资源加载 → 创建 Game + UI →
 * 首次手势解锁音频 → 开屏淡出 → 菜单。
 */
import { GAME_CONFIG } from '../config/game.config.js';
import { t, i18n } from './core/i18n.js';
import { assets } from './core/assets.js';
import { audio } from './core/audio.js';
import { domainLock } from './core/domain-lock.js';
import { save } from './core/save.js';
import { ads } from './core/ads.js';
import { Game } from './game/engine.js';
import { UI } from './ui/ui.js';

const canvas = document.getElementById('game');
const stage = document.getElementById('stage');
const boot = document.getElementById('bootSplash');
const domainOverlay = document.getElementById('domainLock');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectQuality() {
  const Q = GAME_CONFIG.quality;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 620;
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (mem <= 2 || cores <= 2) return Q.low;
  return coarse || narrow ? Q.mobile : Q.desktop;
}

function isPortraitView() {
  return window.innerHeight > window.innerWidth * 1.16;
}

function fitCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const portrait = isPortraitView();
  document.body.classList.toggle('phone-portrait', portrait);
  if (portrait) {
    // 竖屏只保留战场中段（裁掉两侧空场），把 16:9 战场放大成竖屏主画面
    const visW = 1320;
    const worldLeft = 300;
    const scale = vw / visW;
    canvas.style.width = `${GAME_CONFIG.meta.width * scale}px`;
    canvas.style.height = `${GAME_CONFIG.meta.height * scale}px`;
    canvas.style.left = `${-worldLeft * scale}px`;
    canvas.style.top = `calc(env(safe-area-inset-top, 0px) + ${Math.round(vh * 0.18)}px)`;
  } else {
    const scale = Math.min(vw / GAME_CONFIG.meta.width, vh / GAME_CONFIG.meta.height);
    const w = GAME_CONFIG.meta.width * scale;
    const h = GAME_CONFIG.meta.height * scale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.left = `${(vw - w) / 2}px`;
    canvas.style.top = `${(vh - h) / 2}px`;
  }
  if (window.__RVZ__ && window.__RVZ__.game) window.__RVZ__.game.setPortrait(portrait);
}

function localizeDocument() {
  const lang = i18n.lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = `${t('meta.title')} — ${t('meta.tagline')}`;
  const set = (sel, attr, text) => {
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, text);
  };
  set('meta[name="description"]', 'content', t('meta.desc'));
  set('meta[property="og:title"]', 'content', `${t('meta.title')} — ${t('meta.tagline')}`);
  set('meta[property="og:description"]', 'content', t('meta.desc'));
  set('meta[name="twitter:title"]', 'content', `${t('meta.title')} — ${t('meta.tagline')}`);
  set('meta[name="twitter:description"]', 'content', t('meta.desc'));
}

function localizeBoot() {
  const health = boot.querySelector('.splash-health');
  if (health) health.textContent = t('boot.health');
  const label = boot.querySelector('.loadlabel-text');
  if (label) label.textContent = t('boot.loading');
  const tip = boot.querySelector('.boot-tip');
  if (tip) tip.textContent = t('boot.tip');
  const foot = boot.querySelector('.boot-foot');
  if (foot) foot.textContent = t('boot.foot');
  const logo = boot.querySelector('.boot-logo');
  if (logo) logo.alt = t('meta.title');
}

function setProgress(p) {
  const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
  const fill = boot.querySelector('.loadfill');
  const runner = boot.querySelector('.load-runner');
  const value = boot.querySelector('.loadpct');
  if (fill) fill.style.width = `${pct}%`;
  if (runner) runner.style.left = `${pct}%`;
  if (value) value.textContent = `${pct}%`;
}

function showDomainLock(firstLeft) {
  if (!domainOverlay) return;
  domainOverlay.classList.remove('hidden');
  const title = domainOverlay.querySelector('.domain-title');
  const count = domainOverlay.querySelector('.domain-count');
  if (title) title.textContent = t('domain.lock');
  if (count) count.textContent = t('domain.redirect', { n: Math.max(0, Math.ceil(firstLeft)) });
  boot.classList.add('done');
  setTimeout(() => boot.classList.add('hidden'), 800);
}

function currentMusic(state, hasBoss) {
  if (state === 'menu' || state === 'over' || state === 'victory') return 'menu';
  if (state === 'playing') return hasBoss ? 'boss' : 'run';
  return null;
}

async function main() {
  localizeDocument();
  localizeBoot();
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));

  // ① 域名锁：非白名单域名只展示倒计时，不加载游戏
  const allowed = domainLock.guard({
    onLock: (seconds) => showDomainLock(seconds),
    onTick: (left) => {
      const count = domainOverlay && domainOverlay.querySelector('.domain-count');
      if (count) count.textContent = t('domain.redirect', { n: Math.max(0, Math.ceil(left)) });
    },
  });
  if (!allowed) return;

  // ② 开屏进度：图片按张数汇报，至少展示一小段完整动画
  const startedAt = performance.now();
  await assets.loadAll((p) => setProgress(p));
  const minShow = 1500;
  const remain = minShow - (performance.now() - startedAt);
  if (remain > 0) await delay(remain);
  setProgress(1);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  // ③ 创建游戏与 UI
  const quality = detectQuality();
  let ui = null;
  const game = new Game({
    canvas,
    quality,
    hooks: {
      hud: (p) => ui && ui.onHud(p),
      banner: (b) => ui && ui.showBanner(b),
      gameOver: (r) => ui && ui.showResult(r, false),
      victory: (r) => ui && ui.showResult(r, true),
      toast: (k, tone) => ui && ui.toast(k, tone),
      tutorial: (tut) => ui && ui.syncTutorial(tut),
      hint: (k) => ui && ui.setHint(k),
      paused: (v) => ui && ui.onPaused(v),
      menu: () => ui && ui.showMenu(true),
      bossStart: () => ui && ui.onBossStart(),
    },
  });
  ui = new UI(game);
  ui.applySettings();
  game.start();

  // ④ 首次手势解锁音频（移动端 / 桌面通用）
  let unlocking = false;
  const unlock = async () => {
    if (unlocking) return;
    unlocking = true;
    await audio.unlock();
    ui.applySettings();
    const track = currentMusic(game.state, !!game.boss);
    if (track) audio.playMusic(track, { fade: 0.9 });
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // ⑤ 切后台自动暂停，避免回来时被围殴
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === 'playing') game.setPaused(true);
      audio.suspend();
    } else if (game.state === 'playing') {
      audio.resume();
    }
  });

  // ⑥ 开屏淡出
  await delay(420);
  boot.classList.add('done');
  setTimeout(() => boot.classList.add('hidden'), 860);

  window.__RVZ__ = { game, ui, assets, audio, save, ads };
}

main().catch((e) => {
  console.error('[rvz] 启动失败', e);
  const tip = boot && boot.querySelector('.boot-tip');
  if (tip) tip.textContent = e && e.message ? e.message : 'Boot failed';
});
