/**
 * 全局玩法配置
 * ------------------------------------------------------------------
 * 手感、数值、画质全部集中在这里，逻辑层不写死数字。
 * 逻辑分辨率固定 1920x1080，渲染时按容器等比缩放（letterbox）。
 */

export const GAME_CONFIG = {
  meta: {
    name: 'Ranger vs Zombies',
    version: '1.0.0',
    width: 1920,
    height: 1080,
    groundY: 900,          // 地面顶部
    runTime: 180,          // 一局 3 分钟（与原作一致的压迫感）
  },

  player: {
    x: 470,
    xMin: 260,             // 桌面：可后退到画面左侧，但不能退出战场
    xMax: 700,             // 桌面：前压上限，留在头目冲锋终点之内
    xMinPortrait: 430,     // 竖屏可见世界从 x=300 开始，留出角色宽度
    xMaxPortrait: 740,
    moveSpeed: 640,
    moveAccel: 5200,
    height: 330,
    hitW: 92,
    hitH: 268,
    lives: 3,
    maxLives: 3,
    startAmmo: 200,
    maxAmmo: 300,
    jumpVel: -1520,
    gravity: 4200,
    coyote: 0.10,          // 离开地面后仍可起跳的宽容时间
    jumpBuffer: 0.12,
    invulnAfterHit: 1.6,
    runAnimFps: 11,
  },

  weapon: {
    id: 'shotgun',
    damage: 22,            // 单颗弹丸基础伤害
    pellets: 3,
    spread: 0.045,         // 三颗弹丸的纵向散布（弧度）
    speed: 2300,
    fireDelay: 0.235,
    life: 0.9,
    autoAim: 0.62,         // 自动瞄准最大仰角（约 35°）
    autoAimRange: 1250,
    aimUp: 1.24,           // 手动瞄准最大仰角（约 71°）
    aimDown: 0.92,         // 手动瞄准最大俯角（约 53°）
    kick: 9,
    shake: 3.4,
    // 原作里霰弹对僵尸有倍率；这里按部位和冰冻状态给加成
    headshotMul: 1.5,
    frozenMul: 1.6,
  },

  skills: {
    freeze: {
      id: 'freeze',
      cooldown: 15,
      duration: 3.6,
      bossDuration: 1.4,
      sfx: 'freeze',
      color: '#7fd8ff',
    },
    fire: {
      id: 'fire',
      cooldown: 12,
      damage: 130,
      speed: 1180,
      life: 1.35,
      sfx: 'fire',
      color: '#ff9b3d',
    },
    lightning: {
      id: 'lightning',
      cooldown: 17,
      damage: 165,
      targets: 6,
      sfx: 'lightning',
      color: '#ffe66b',
    },
  },

  enemies: {
    walker:   { hp: 180, speed: 150, damage: 1, score: 30, height: 310, w: 120, h: 280, kind: 'ground', drop: 0.20 },
    cone:     { hp: 200, speed: 142, damage: 1, score: 35, height: 310, w: 118, h: 280, kind: 'ground', drop: 0.22 },
    barrel:   { hp: 265, speed: 120, damage: 1, score: 45, height: 340, w: 150, h: 305, kind: 'ground', drop: 0.26 },
    brute:    { hp: 400, speed: 96,  damage: 1, score: 100, height: 395, w: 200, h: 355, kind: 'ground', drop: 0.42 },
    cowgirl:  { hp: 235, speed: 134, damage: 1, score: 60, height: 330, w: 134, h: 300, kind: 'ground', drop: 0.30 },
    crawler:  { hp: 155, speed: 212, damage: 1, score: 40, height: 235, w: 190, h: 210, kind: 'ground', drop: 0.18 },

    f_bucket:  { hp: 180, speed: 172, damage: 1, score: 50, height: 186, w: 126, h: 130, kind: 'flyer', drop: 0.28 },
    f_cone:    { hp: 145, speed: 196, damage: 1, score: 45, height: 182, w: 116, h: 130, kind: 'flyer', drop: 0.22, dives: true },
    f_cowgirl: { hp: 225, speed: 162, damage: 1, score: 60, height: 205, w: 148, h: 136, kind: 'flyer', drop: 0.30, spits: true },
    f_crawler: { hp: 165, speed: 205, damage: 1, score: 55, height: 178, w: 146, h: 124, kind: 'flyer', drop: 0.24, dives: true },
    f_brute:   { hp: 310, speed: 132, damage: 1, score: 80, height: 214, w: 132, h: 140, kind: 'flyer', drop: 0.40 },
  },

  boss: {
    id: 'crowned_brute',
    nameKey: 'bestiary.crowned.name',
    hp: 2600,
    height: 660,
    w: 330,
    h: 560,
    damage: 1,
    score: 1500,
    enterFrom: 1980,
    standX: 1420,
    chargeX: 760,
    slam: { telegraph: 0.85, cooldown: 5.4, waveSpeed: 760, waveW: 120 },
    summon: { cooldown: 7.5, count: 3 },
    charge: { telegraph: 1.0, cooldown: 9.5, speed: 1700, stun: 1.5 },
    phase2At: 0.5,
  },

  pickups: {
    ammo:   { amount: 60, score: 0,   weight: 40 },
    star:   { score: 250,  weight: 22 },
    heart:  { heal: 1,     weight: 10 },
    shield: { duration: 8, weight: 12 },
  },

  // 特殊子弹宝箱：定时从右侧滚入，捡到后短时间强化霰弹
  specialAmmo: {
    duration: 12,
    crateAmmo: 30,
    firstCrate: 11,
    interval: [20, 29],
    types: {
      scatter: {
        nameKey: 'special.scatter',
        icon: 'ui_gun_shotgun',
        tint: '#ffd27a',
        glow: 'rgba(255, 196, 96, 0.40)',
        pellets: 5,
        spread: 0.082,
        damageMul: 0.82,
      },
      pierce: {
        nameKey: 'special.pierce',
        icon: 'fx_bullet',
        tint: '#9fe6ff',
        glow: 'rgba(120, 214, 255, 0.40)',
        pierce: 2,
        damageMul: 1.15,
      },
      blast: {
        nameKey: 'special.blast',
        icon: 'fx_boom',
        tint: '#ffab5e',
        glow: 'rgba(255, 132, 64, 0.40)',
        damageMul: 0.95,
        splashR: 190,
        splashMul: 1.5,     // 溅射比单发还疼，专门用来清扎堆的尸群
      },
    },
  },

  spawn: {
    startDelay: 2.4,
    flyerChance: 0.28,
    maxGround: 7,
    maxAir: 4,
    margin: 160,            // 屏幕右侧外多远处生成
  },

  score: {
    perSecond: 8,
    comboWindow: 2.6,
    comboMax: 10,
  },

  camera: {
    shakeDecay: 7.5,
    maxShake: 26,
    zoomPunch: 0.012,
  },

  // 移动端 / 低端机降配
  quality: {
    desktop: { dpr: 2, particles: 1.0, clouds: 5, props: 10, shadows: true, glow: true },
    mobile:  { dpr: 1.5, particles: 0.55, clouds: 3, props: 6, shadows: true, glow: false },
    low:     { dpr: 1.0, particles: 0.3, clouds: 2, props: 4, shadows: false, glow: false },
  },
};

export default GAME_CONFIG;
