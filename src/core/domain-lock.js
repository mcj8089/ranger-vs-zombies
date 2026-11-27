/**
 * 域名锁
 * ------------------------------------------------------------------
 * 规则：只有白名单域名（本地调试 + pipygames.com）可以正常运行；
 * 其它域名在资源加载完成后等待 3 秒，自动跳转到官网。
 *
 * 优先使用公共 SDK 的 protect.guardDomain（统一防护）；
 * SDK 缺失时用这里的本地实现兜底。
 */
import { DOMAINS_CONFIG } from '../../config/domains.config.js';

function hostMatches(host, pattern) {
  if (!pattern) return false;
  if (pattern === host) return true;
  // 允许 *.example.com 与不带 www 的主域互相匹配
  const strip = (h) => h.replace(/^www\./, '');
  return strip(host) === strip(pattern);
}

class DomainLock {
  constructor() {
    this.cfg = DOMAINS_CONFIG;
  }

  isAllowed() {
    const { protocol, hostname } = window.location;
    if (protocol === 'file:' && this.cfg.allowFileProtocol) return true;
    const host = (hostname || '').toLowerCase();
    if (!host) return true;
    return this.cfg.allowedHosts.some((p) => hostMatches(host, p.toLowerCase()));
  }

  /**
   * 启动校验。
   * @param {{onLock:(delay:number)=>void, onTick:(left:number)=>void}} cb
   * @returns {boolean} 是否允许运行
   */
  guard(cb = {}) {
    if (!this.cfg.enabled || this.isAllowed()) return true;

    const sdk = window.GameSDK;
    if (sdk && sdk.protect && typeof sdk.protect.guardDomain === 'function') {
      // SDK 的 onLock / onTick 单位是毫秒，这里统一转成秒再交给 UI
      const locked = sdk.protect.guardDomain({
        onLock: (ms) => cb.onLock && cb.onLock(Math.ceil((ms || 0) / 1000)),
        onTick: (ms) => cb.onTick && cb.onTick(Math.ceil((ms || 0) / 1000)),
      });
      return !locked;
    }

    // 本地兜底：倒计时 + 跳转
    const delay = this.cfg.redirectDelay;
    if (cb.onLock) cb.onLock(delay);
    let left = delay;
    const timer = setInterval(() => {
      left -= 1;
      if (cb.onTick) cb.onTick(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        window.location.replace(this.cfg.redirectUrl);
      }
    }, 1000);
    return false;
  }
}

export const domainLock = new DomainLock();
export default domainLock;
