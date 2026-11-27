/**
 * 音频引擎
 * ------------------------------------------------------------------
 * - 全部音频为本项目原创合成（tools/gen_audio.py），不包含原作素材
 * - 音乐：buffer 循环 + 交叉淡入淡出（章节/BOSS 切换不突兀）
 * - 音效：小对象池，同名音效 60ms 内不重复，避免叠成噪音
 * - 浏览器要求手势后才能播放：main.js 在首次点击/按键时调用 unlock()
 */
const AUDIO_ROOT = 'assets/audio/';

function resolveSrc(rel) {
  const map = typeof window !== 'undefined' ? window.__ASSETS__ : null;
  return (map && map[rel]) || rel;
}

const MUSIC_FILES = {
  menu: 'bgm_menu.wav',
  run: 'bgm_run.wav',
  boss: 'bgm_boss.wav',
};

const SFX_FILES = {
  shoot: 'sfx_shoot.wav',
  empty: 'sfx_empty.wav',
  jump: 'sfx_jump.wav',
  land: 'sfx_land.wav',
  kill: 'sfx_kill.wav',
  hurt: 'sfx_hurt.wav',
  shield: 'sfx_shield.wav',
  pickup: 'sfx_pickup.wav',
  ammo: 'sfx_ammo.wav',
  heart: 'sfx_heart.wav',
  star: 'sfx_star.wav',
  freeze: 'sfx_freeze.wav',
  fire: 'sfx_fire.wav',
  lightning: 'sfx_lightning.wav',
  boom: 'sfx_boom.wav',
  spit: 'sfx_spit.wav',
  roar: 'sfx_roar.wav',
  slam: 'sfx_slam.wav',
  charge: 'sfx_charge.wav',
  victory: 'sfx_victory.wav',
  lose: 'sfx_lose.wav',
  ui: 'sfx_ui.wav',
  wave: 'sfx_wave.wav',
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.buffers = new Map();
    this.musicVolume = 0.36;
    this.sfxVolume = 0.62;
    this.muted = false;
    this.current = null;
    this.unlocked = false;
    this._lastSfx = new Map();
    this._loading = null;
  }

  init() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);
    return this.ctx;
  }

  async unlock() {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { /* 忽略 */ }
    }
    this.unlocked = this.ctx.state === 'running';
    if (!this._loading) this._loading = this.preload();
    await this._loading;
  }

  async _loadBuffer(file) {
    if (!this.ctx) return null;
    if (this.buffers.has(file)) return this.buffers.get(file);
    try {
      const res = await fetch(resolveSrc(AUDIO_ROOT + file));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(raw);
      this.buffers.set(file, buf);
      return buf;
    } catch (e) {
      console.warn('[audio] 解码失败:', file, e && e.message);
      this.buffers.set(file, null);
      return null;
    }
  }

  async preload() {
    if (!this.ctx) return;
    await Promise.all(Object.values(MUSIC_FILES).map((f) => this._loadBuffer(f)));
    await Promise.all(Object.values(SFX_FILES).map((f) => this._loadBuffer(f)));
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  async playMusic(name, { fade = 1.0, force = false } = {}) {
    if (!this.ctx) return;
    if (!force && this.current && this.current.name === name) return;
    const file = MUSIC_FILES[name];
    if (!file) return;
    const buf = await this._loadBuffer(file);
    if (!buf) return;

    const t0 = this._now();
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(1, t0 + fade);
    gain.connect(this.musicGain);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    src.start(t0);

    const prev = this.current;
    this.current = { name, src, gain };
    if (prev) {
      const p = prev;
      p.gain.gain.cancelScheduledValues(t0);
      p.gain.gain.setValueAtTime(p.gain.gain.value || 1, t0);
      p.gain.gain.linearRampToValueAtTime(0, t0 + fade * 0.8);
      setTimeout(() => {
        try { p.src.stop(); } catch (e) { /* 已停止 */ }
        try { p.src.disconnect(); } catch (e) { /* 已断开 */ }
      }, Math.ceil(fade * 800) + 60);
    }
  }

  stopMusic(fade = 0.4) {
    if (!this.ctx || !this.current) return;
    const c = this.current;
    const t0 = this._now();
    c.gain.gain.cancelScheduledValues(t0);
    c.gain.gain.setValueAtTime(c.gain.gain.value || 1, t0);
    c.gain.gain.linearRampToValueAtTime(0, t0 + fade);
    setTimeout(() => {
      try { c.src.stop(); } catch (e) { /* 已停止 */ }
    }, Math.ceil(fade * 1000) + 40);
    this.current = null;
  }

  play(name, { volume = 1, rate = 1 } = {}) {
    if (!this.ctx || this.muted) return;
    const file = SFX_FILES[name];
    if (!file) return;
    const buf = this.buffers.get(file);
    if (!buf) return;
    const now = this.ctx.currentTime;
    const last = this._lastSfx.get(name) || 0;
    if (now - last < 0.06) return;
    this._lastSfx.set(name, now);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.sfxGain);
    src.start(now);
    src.onended = () => {
      try { src.disconnect(); g.disconnect(); } catch (e) { /* 忽略 */ }
    };
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master && this.ctx) {
      const t = this._now();
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 1, t + 0.15);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended' && this.unlocked) {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const audio = new AudioEngine();
export default audio;
