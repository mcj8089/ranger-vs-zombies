/**
 * 图片资源清单
 * ------------------------------------------------------------------
 * 按张数汇报进度（开屏进度条）。音频不在这里加载，见 audio.js。
 * 单文件构建时图片以 data URI 内联（window.__ASSETS__）。
 */
const ROOT = 'assets/images/';

function resolveSrc(rel) {
  const map = typeof window !== 'undefined' ? window.__ASSETS__ : null;
  return (map && map[rel]) || rel;
}

export const IMAGE_MANIFEST = {
  // 背景 / 场景
  bg_boot: 'bg_boot.jpg',
  bg_game: 'bg_game.jpg',
  bg_menu: 'bg_menu.jpg',
  bg_share: 'bg_share.jpg',
  ground_tile: 'ground_tile.jpg',
  fg_grass: 'fg_grass.png',
  cloud_0: 'cloud_0.png',
  cloud_1: 'cloud_1.png',
  cloud_2: 'cloud_2.png',
  logo: 'logo.png',

  // 游侠
  hero_0: 'hero_0.png',
  hero_1: 'hero_1.png',
  hero_2: 'hero_2.png',
  hero_3: 'hero_3.png',
  hero_jump: 'hero_jump.png',
  hud_ranger: 'hud_ranger.png',

  // 地面僵尸
  zombie_walker: 'zombie_walker.png',
  zombie_bucket: 'zombie_bucket.png',
  zombie_cone: 'zombie_cone.png',
  zombie_barrel: 'zombie_barrel.png',
  zombie_brute: 'zombie_brute.png',
  zombie_cowgirl: 'zombie_cowgirl.png',
  zombie_crawler: 'zombie_crawler.png',

  // 诅咒首级
  flyer_bucket: 'flyer_bucket.png',
  flyer_cone: 'flyer_cone.png',
  flyer_cowgirl: 'flyer_cowgirl.png',
  flyer_crawler: 'flyer_crawler.png',
  flyer_brute: 'flyer_brute.png',

  // 头目
  boss_crowned: 'boss_crowned.png',

  // 拾取
  pick_ammo: 'pick_ammo.png',
  pick_health: 'pick_health.png',
  pick_life: 'pick_life.png',
  pick_score: 'pick_score.png',
  pick_shield: 'pick_shield.png',

  // 特效
  fx_muzzle: 'fx_muzzle.png',
  fx_bullet: 'fx_bullet.png',
  fx_blood: 'fx_blood.png',
  fx_acid: 'fx_acid.png',
  fx_fire: 'fx_fire.png',
  fx_ice: 'fx_ice.png',
  fx_dust: 'fx_dust.png',
  fx_boom: 'fx_boom.png',
  fx_explosion: 'fx_explosion.png',

  // 场景道具
  prop_rock: 'prop_rock.png',
  prop_bush: 'prop_bush.png',
  prop_tree: 'prop_tree.png',
  prop_ladder: 'prop_ladder.png',
  prop_pillar: 'prop_pillar.png',

  // 章节机关
  hazard_tumbleweed: 'hazard_tumbleweed.png',
  hazard_keg: 'hazard_keg.png',

  // UI
  ui_panel: 'ui_panel.png',
  ui_button: 'ui_button.png',
  ui_barframe: 'ui_barframe.png',
  ui_hand: 'ui_hand.png',
  ui_key: 'ui_key.png',
  ui_arrow: 'ui_arrow.png',
  ui_reticle: 'ui_reticle.png',
  ui_gun: 'ui_gun.png',
  ui_gun_shotgun: 'ui_gun_shotgun.png',

  // HUD / 功能图标
  ico_hud_0: 'ico_hud_0.png',
  ico_hud_1: 'ico_hud_1.png',
  ico_hud_2: 'ico_hud_2.png',
  ico_hud_3: 'ico_hud_3.png',
  ico_hud_4: 'ico_hud_4.png',
  ico_hud_5: 'ico_hud_5.png',
  ico_hud_6: 'ico_hud_6.png',
  ico_hud_7: 'ico_hud_7.png',
  ico_ui_0: 'ico_ui_0.png',
  ico_ui_1: 'ico_ui_1.png',
  ico_ui_2: 'ico_ui_2.png',
  ico_ui_3: 'ico_ui_3.png',
  ico_ui_4: 'ico_ui_4.png',
  ico_ui_5: 'ico_ui_5.png',
  ico_ui_6: 'ico_ui_6.png',
  ico_ui_7: 'ico_ui_7.png',
  icon_pause: 'icon_pause.png',
  icon_settings: 'icon_settings.png',
  icon_music: 'icon_music.png',
  icon_fullscreen: 'icon_fullscreen.png',
  icon_bolt: 'icon_bolt.png',
  icon_play: 'icon_play.png',
};

class AssetStore {
  constructor() {
    this.images = new Map();
    this.ready = false;
    this.progress = 0;
  }

  async loadAll(onProgress) {
    const entries = Object.entries(IMAGE_MANIFEST);
    const total = entries.length;
    let loaded = 0;

    const loadOne = ([key, file]) =>
      new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          this.images.set(key, img);
          loaded++;
          this.progress = loaded / total;
          if (onProgress) onProgress(this.progress, loaded, total);
          resolve();
        };
        img.onerror = () => {
          console.warn('[assets] 加载失败:', file);
          loaded++;
          this.progress = loaded / total;
          if (onProgress) onProgress(this.progress, loaded, total);
          resolve();
        };
        img.src = resolveSrc(ROOT + file);
      });

    // 并发 6 张，避免同源连接被一次占满导致进度条卡顿
    const queue = entries.slice();
    const workers = new Array(6).fill(0).map(async () => {
      while (queue.length) await loadOne(queue.shift());
    });
    await Promise.all(workers);
    this.ready = true;
    return this;
  }

  get(key) {
    return this.images.get(key) || null;
  }

  ratio(key) {
    const im = this.get(key);
    return im ? im.width / im.height : 1;
  }
}

export const assets = new AssetStore();
export default assets;
