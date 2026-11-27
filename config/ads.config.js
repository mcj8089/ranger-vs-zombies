/**
 * 广告位配置
 * ------------------------------------------------------------------
 * 当前没有广告账号：enabled=false，界面里不会出现任何广告按钮，
 * 复活入口、结算插屏全部自动隐藏/降级。拿到账号后：
 *   1) 把 enabled 改为 true，provider 改成实际渠道；
 *   2) 填好对应 placement 的 id；
 *   3) 游戏逻辑无需改动（见 src/core/ads.js）。
 *
 * 渠道：none | mock | poki | crazygames | custom
 * 频控：maxPerRun（每局上限）、cooldownMs（冷却）、everyNPlays（每 N 局）
 */

export const ADS_CONFIG = {
  enabled: false,
  provider: 'none',
  testMode: true,

  global: {
    pauseGameDuringAd: true,
    muteAudioDuringAd: true,
    fillTimeoutMs: 9000,
  },

  placements: {
    // 复活：看完广告原地满血继续（每局 1 次）
    revive: {
      format: 'rewarded',
      id: '',
      enabled: true,
      maxPerRun: 1,
      cooldownMs: 0,
    },
    // 结算分数翻倍
    doubleScore: {
      format: 'rewarded',
      id: '',
      enabled: true,
      maxPerRun: 1,
      cooldownMs: 0,
    },
    // 结算插屏（默认关闭，避免打断节奏）
    resultInterstitial: {
      format: 'interstitial',
      id: '',
      enabled: false,
      everyNPlays: 3,
      cooldownMs: 60000,
    },
    // 开局插屏（默认关闭，首局体验优先）
    startInterstitial: {
      format: 'interstitial',
      id: '',
      enabled: false,
      everyNPlays: 4,
      cooldownMs: 90000,
    },
  },

  // 各渠道接入参数（占位，接入时填）
  channels: {
    poki: { sdkUrl: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js', gameId: '' },
    crazygames: { sdkUrl: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' },
    custom: { scriptUrl: '', adapterGlobal: 'GameAdAdapter' },
  },

  tracking: {
    enabled: true,
  },
};

export default ADS_CONFIG;
