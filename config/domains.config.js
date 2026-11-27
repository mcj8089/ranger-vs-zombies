/**
 * 域名锁配置
 * ------------------------------------------------------------------
 * 仅允许本地调试域名与 pipygames.com 运行；其他域名在首屏资源加载完成后，
 * 倒计时 3 秒自动跳转到官网。实现见 src/core/domain-lock.js。
 */

export const DOMAINS_CONFIG = {
  enabled: true,
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    '::1',
    'pipygames.com',
    'www.pipygames.com',
  ],
  redirectUrl: 'https://pipygames.com',
  redirectDelay: 3,
  allowFileProtocol: true,
  messageKey: 'domain.lock',
  redirectKey: 'domain.redirect',
};

export default DOMAINS_CONFIG;
