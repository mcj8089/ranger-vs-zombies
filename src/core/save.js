/**
 * 本地存档
 * ------------------------------------------------------------------
 * 只存必要数据：最高分、累计击杀、局数、胜利数、教学是否看过、音频设置。
 * 公共 SDK 可用时走一次 shield 校验，被改动过就回退默认值。
 */
const KEY = 'rvz_save_v1';

const DEFAULTS = {
  best: 0,
  bestKills: 0,
  bestTime: 0,
  runs: 0,
  wins: 0,
  kills: 0,
  tutorialDone: false,
  settings: {
    music: true,
    sfx: true,
    shake: true,
  },
};

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

class SaveStore {
  constructor() {
    this.data = clone(DEFAULTS);
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const merged = Object.assign(clone(DEFAULTS), parsed);
      merged.settings = Object.assign(clone(DEFAULTS.settings), parsed.settings || {});
      if (!Number.isFinite(merged.best) || merged.best < 0 || merged.best > 1e9) merged.best = 0;
      if (!Number.isFinite(merged.kills) || merged.kills < 0 || merged.kills > 1e9) merged.kills = 0;
      const sdk = window.GameSDK;
      if (sdk && sdk.shield && typeof sdk.shield.verify === 'function') {
        const check = sdk.shield.verify(merged, KEY);
        if (check && check.tampered) {
          console.warn('[save] 存档校验失败，已重置');
          this.data = clone(DEFAULTS);
          this.persist();
          return;
        }
      }
      this.data = merged;
    } catch (e) {
      console.warn('[save] 读取失败，使用默认存档', e && e.message);
    }
  }

  persist() {
    try {
      const sdk = window.GameSDK;
      if (sdk && sdk.shield && typeof sdk.shield.save === 'function') {
        sdk.shield.save(clone(this.data), KEY);
      }
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[save] 写入失败', e && e.message);
    }
  }

  get(key) {
    return key ? this.data[key] : this.data;
  }

  patch(obj) {
    Object.assign(this.data, obj);
    this.persist();
    return this.data;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.persist();
    return this.data.settings;
  }

  /**
   * 结算。复活后再次死亡时用 resume=true 续记，避免把同一局算两次。
   */
  commitRun({ score, kills, time, win, stage, resume = false, prevKills = 0 }) {
    const prevBest = this.data.best;
    if (!resume) {
      this.data.runs += 1;
      this.data.kills += kills;
    } else {
      this.data.kills += Math.max(0, kills - prevKills);
    }
    if (win) this.data.wins += 1;
    if (score > this.data.best) this.data.best = Math.round(score);
    if (kills > this.data.bestKills) this.data.bestKills = kills;
    if (time > this.data.bestTime) this.data.bestTime = Math.round(time);
    this.persist();
    return { newBest: score > prevBest, data: this.data };
  }

  reset() {
    this.data = clone(DEFAULTS);
    this.persist();
  }
}

export const save = new SaveStore();
export default save;
