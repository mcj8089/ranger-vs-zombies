/**
 * 广告封装
 * ------------------------------------------------------------------
 * 设计原则：没有账号时「完全不出现广告按钮」，流程自动降级。
 * 对外只暴露 canShow() / showRewarded() / showInterstitial()，
 * 实际投放交给公共 SDK 的 ads 模块；SDK 缺失时退化为本地 mock。
 */
import { ADS_CONFIG } from '../../config/ads.config.js';

class Ads {
  constructor() {
    this.cfg = ADS_CONFIG;
    this.overlay = null;       // { show(text), hide() }
    this.onAdStart = null;
    this.onAdEnd = null;
    this._playCount = 0;
    this._usedThisRun = {};
    this._lastShown = 0;
  }

  get enabled() {
    return !!(this.cfg.enabled && this.cfg.provider !== 'none');
  }

  bindOverlay(overlay) {
    this.overlay = overlay;
  }

  /** 新的一局：重置每局次数限制 */
  startRun() {
    this._usedThisRun = {};
    this._playCount += 1;
  }

  placement(name) {
    return this.cfg.placements[name] || null;
  }

  canShow(name) {
    if (!this.enabled) return false;
    const p = this.placement(name);
    if (!p || !p.enabled) return false;
    const used = this._usedThisRun[name] || 0;
    if (p.maxPerRun && used >= p.maxPerRun) return false;
    if (p.cooldownMs && Date.now() - this._lastShown < p.cooldownMs) return false;
    return true;
  }

  _begin() {
    if (this.onAdStart) this.onAdStart();
    if (this.overlay) this.overlay.show('AD');
  }

  _end() {
    if (this.overlay) this.overlay.hide();
    if (this.onAdEnd) this.onAdEnd();
  }

  _track(name, step, extra) {
    const sdk = window.GameSDK;
    if (this.cfg.tracking.enabled && sdk && sdk.trackAd) {
      sdk.trackAd(Object.assign({ placement: name, step }, extra || {}));
    }
  }

  /** 激励视频：返回 { ok:boolean, reason?:string } */
  async showRewarded(name) {
    if (!this.canShow(name)) {
      return { ok: false, reason: this.enabled ? 'unavailable' : 'disabled' };
    }
    const sdk = window.GameSDK;
    this._begin();
    this._track(name, 'start');
    let ok = false;
    try {
      if (sdk && sdk.ads && typeof sdk.ads.showRewarded === 'function') {
        ok = await sdk.ads.showRewarded(name);
      } else {
        await new Promise((r) => setTimeout(r, 900));
        ok = true; // 本地 mock
      }
    } catch (e) {
      ok = false;
    } finally {
      this._end();
    }
    if (ok) {
      this._usedThisRun[name] = (this._usedThisRun[name] || 0) + 1;
      this._lastShown = Date.now();
    }
    this._track(name, 'end', { granted: ok });
    return ok ? { ok: true } : { ok: false, reason: 'failed' };
  }

  /** 插屏：返回是否真的播放了 */
  async showInterstitial(name) {
    if (!this.canShow(name)) return false;
    const sdk = window.GameSDK;
    this._begin();
    try {
      if (sdk && sdk.ads && typeof sdk.ads.showInterstitial === 'function') {
        await sdk.ads.showInterstitial(name);
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }
      this._usedThisRun[name] = (this._usedThisRun[name] || 0) + 1;
      this._lastShown = Date.now();
      return true;
    } catch (e) {
      return false;
    } finally {
      this._end();
    }
  }
}

export const ads = new Ads();
export default ads;
