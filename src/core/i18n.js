/**
 * 国际化
 * ------------------------------------------------------------------
 * 语言由 config/locales.js 的 ACTIVE_LANG 决定，游戏内没有切换入口。
 * 用法：t('hud.score') / t('share.inviteText', { name: '@Dusty' })
 */
import { LOCALES, ACTIVE_LANG } from '../../config/locales.js';

class I18n {
  constructor() {
    let lang = ACTIVE_LANG;
    if (typeof window !== 'undefined') {
      // 仅用于部署/调试（URL ?lang=zh）；界面上不会出现语言切换按钮
      const q = new URLSearchParams(window.location.search).get('lang');
      if (q) lang = q;
    }
    this.lang = lang === 'zh' ? 'zh' : 'en';
    this.dict = LOCALES[this.lang] || LOCALES.en;
  }

  t(key, vars) {
    let s = this.dict[key];
    if (s === undefined) s = LOCALES.en[key];
    if (s === undefined) s = key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    }
    return s;
  }

  get code() {
    return this.lang === 'zh' ? 'zh-CN' : 'en';
  }

  num(n) {
    return Math.round(n).toLocaleString(this.code);
  }

  /** mm:ss */
  clock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }
}

export const i18n = new I18n();
export const t = (k, v) => i18n.t(k, v);
export default i18n;
