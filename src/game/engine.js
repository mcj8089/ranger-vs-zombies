/**
 * 游戏主循环
 * ------------------------------------------------------------------
 * 逻辑分辨率 1920x1080；不依赖任何引擎，纯 Canvas 2D。
 * 一局：3 个章节 → 第三章 BOSS；教学期间冻结关卡计时。
 * 所有手感数值来自 config/game.config.js 与 config/levels.js。
 */
import { GAME_CONFIG } from '../../config/game.config.js';
import { STAGES, PALETTES } from '../../config/levels.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { save } from '../core/save.js';
import { t } from '../core/i18n.js';
import { Scene } from '../art/scene.js';
import { FX } from '../art/fx.js';
import { Player } from './player.js';
import { Enemy, Boss } from './enemies.js';
import { LevelDirector } from './level.js';
import { Tutorial } from './tutorial.js';
import { clamp, lerp, rand, choice, aabb } from './physics.js';
import { drawPickup, drawGuideRing } from '../art/characters.js';
import { drawHazard } from '../art/hazards.js';

const W = GAME_CONFIG.meta.width;
const H = GAME_CONFIG.meta.height;
const GY = GAME_CONFIG.meta.groundY;
const P = GAME_CONFIG.player;
const WPN = GAME_CONFIG.weapon;
const SK = GAME_CONFIG.skills;
const SPECIAL = GAME_CONFIG.specialAmmo;
const SPECIAL_IDS = Object.keys(SPECIAL.types);

const PICKUP_SPRITES = {
  ammo: 'pick_ammo',
  star: 'pick_score',
  heart: 'pick_life',
  shield: 'pick_shield',
  special: 'pick_ammo',
};
const PICKUP_GLOW = {
  ammo: 'rgba(255, 210, 120, 0.55)',
  star: 'rgba(255, 236, 120, 0.7)',
  heart: 'rgba(255, 120, 140, 0.55)',
  shield: 'rgba(120, 210, 255, 0.55)',
  special: 'rgba(255, 196, 96, 0.62)',
};

export class Game {
  constructor({ canvas, hooks, quality }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hooks = hooks || {};
    this.quality = quality;
    this.portrait = window.innerHeight > window.innerWidth * 1.16;
    this.spawnEdge = this.portrait ? 1680 : 2060;
    this.audio = audio;
    this.save = save;
    this.fx = new FX(quality);
    this.scene = new Scene(quality);
    this.player = new Player(this);
    this.director = new LevelDirector(this);
    this.tutorial = new Tutorial(this);

    this.enemies = [];
    this.flyers = [];
    this.bullets = [];
    this.pickups = [];
    this.acid = [];
    this.waves = [];
    this.fireWaves = [];
    this.hazards = [];
    this.boss = null;

    this.state = 'menu';
    this.time = 0;
    this.scrollSpeed = 0;
    this.score = 0;
    this.scoreFloat = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.best = save.get('best');
    this.stageIndex = 0;
    this.skills = [];
    this.bossDeathTimer = 0;
    this.overTimer = 0;
    this.hudTimer = 0;
    this.hintKey = null;
    this.shotCount = 0;
    this.loop = this.loop.bind(this);
    this.running = false;
    this.last = 0;
    this.paused = false;
    this.input = { fire: false, jumpQueued: false, left: false, right: false };
    this.aim = null;

    this.tutorial.onChange = () => {
      if (this.hooks.tutorial) this.hooks.tutorial(this.tutorial);
    };
  }

  /* ------------------------------------------------------------ 生命周期 */
  newRun() {
    this.clearInput();
    this.clearAim();
    this.enemies.length = 0;
    this.flyers.length = 0;
    this.bullets.length = 0;
    this.pickups.length = 0;
    this.acid.length = 0;
    this.waves.length = 0;
    this.fireWaves.length = 0;
    this.hazards.length = 0;
    this.boss = null;
    this.fx.clear();
    this.player.reset();
    this.director.reset();
    this.tutorial.onChange = () => {
      if (this.hooks.tutorial) this.hooks.tutorial(this.tutorial);
    };
    this.tutorial.begin(save.get());
    this.score = 0;
    this.scoreFloat = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this._runCommit = null;
    this.bossDeathTimer = 0;
    this.overTimer = 0;
    this.stageIndex = 0;
    this.scrollSpeed = STAGES[0].scrollSpeed[0];
    this.state = 'playing';
    this.paused = false;
    this.time = 0;
    this.hintKey = null;
    this.shotCount = 0;
    if (this.hooks.hint) this.hooks.hint(null);
    this.skills = ['freeze', 'fire', 'lightning'].map((id) => ({ id, cd: 0, total: SK[id].cooldown }));
    this.enterStage(0, true);
    this.audio.playMusic('run', { fade: 1.0 });
    if (this.hooks.tutorial) this.hooks.tutorial(this.tutorial);
    this.pushHud();
  }

  enterStage(index, initial = false) {
    this.stageIndex = index;
    const stage = STAGES[index];
    this.scene.setPalette(stage.palette, PALETTES);
    this.scrollSpeed = stage.scrollSpeed[0];
    if (!initial) this.hazards.length = 0;
    if (this.hooks.banner) {
      this.hooks.banner({
        kind: 'stage',
        n: index + 1,
        nameKey: stage.nameKey,
        subKey: stage.subKey,
        initial,
      });
    }
    if (!initial) this.audio.play('wave');
  }

  spawnBoss() {
    if (this.boss) return;
    this.boss = new Boss(this, { hpScale: 1 });
    this.audio.playMusic('boss', { fade: 1.2 });
    this.tutorialEvent('boss');
    this.pushHud();
  }

  bossStarted() {
    // 只在头目真正踏入战场时播一次横幅与提示
    if (this.hooks.bossStart) this.hooks.bossStart();
    this.toast('stage.boss', 'danger');
  }

  setPortrait(v) {
    this.portrait = v;
    this.spawnEdge = v ? 1680 : 2060;
    if (this.player) this.player.setBounds();
  }

  onBossDeath() {
    if (this.bossDeathTimer > 0) return;
    this.bossDeathTimer = 2.2;
    this.addScore(GAME_CONFIG.boss.score, this.boss.x, GY - 380, true);
    this.director.finished = true;
    this.player.invuln = 9;
    this.fx.flash('#fff3c8', 0.45, 0.6);
    this.fx.shake(24);
    this.audio.play('boom');
    this.audio.stopMusic(1.4);
    // 清场：剩余小怪也一起炸掉
    for (const e of [...this.enemies, ...this.flyers]) {
      if (e.alive) {
        e.alive = false;
        this.fx.death(e.x, GY, 1);
      }
    }
    this.enemies.length = 0;
    this.flyers.length = 0;
    this.hazards.length = 0;
  }

  finishVictory() {
    if (this.state !== 'playing') return;
    this.state = 'victory';
    this.audio.playMusic('menu', { fade: 1.4 });
    this.audio.play('victory');
    if (this.boss) this.boss.dead = true;
    const result = this._result(true);
    if (this.hooks.victory) this.hooks.victory(result);
  }

  gameOver() {
    if (this.state === 'over' || this.state === 'victory') return;
    this.state = 'over';
    this.audio.playMusic('menu', { fade: 1.2 });
    this.audio.play('lose');
    const result = this._result(false);
    if (this.hooks.gameOver) this.hooks.gameOver(result);
  }

  _result(win) {
    const time = this.director.elapsed;
    const score = Math.round(this.score + this.scoreFloat);
    const before = save.get('best');
    const prev = this._runCommit;
    const commit = save.commitRun({
      score,
      kills: this.kills,
      time,
      win,
      stage: this.stageIndex + 1,
      resume: !!prev,
      prevKills: prev ? prev.kills : 0,
    });
    this._runCommit = { kills: this.kills };
    this.best = commit.data.best;
    return {
      win,
      score,
      kills: this.kills,
      time,
      stage: this.stageIndex + 1,
      best: this.best,
      newBest: score > before,
      combo: this.combo,
    };
  }

  revive() {
    if (this.state !== 'dying' && this.state !== 'over') return;
    this.player.lives = 1;
    this.player.invuln = 3.2;
    this.player.alive = true;
    this.player.feetY = GY;
    this.state = 'playing';
    this.overTimer = 0;
    this.enemies.length = 0;
    this.flyers.length = 0;
    this.acid.length = 0;
    this.hazards.length = 0;
    this.fx.flash('#ffe6a8', 0.5, 0.4);
    this.audio.playMusic(this.boss ? 'boss' : 'run', { fade: 0.6 });
    this.pushHud();
  }

  setPaused(v) {
    if (v && this.state === 'playing') {
      this.state = 'paused';
      this.clearInput();
      this.audio.suspend();
      if (this.hooks.paused) this.hooks.paused(true);
    } else if (!v && this.state === 'paused') {
      this.state = 'playing';
      this.audio.resume();
      if (this.hooks.paused) this.hooks.paused(false);
    }
  }

  toMenu() {
    this.state = 'menu';
    this.audio.playMusic('menu', { fade: 0.8 });
    if (this.hooks.menu) this.hooks.menu();
  }

  /* ------------------------------------------------------------ 输入 */
  setFire(v) {
    this.input.fire = !!v;
  }

  setMove(dir, v) {
    if (dir === 'left') this.input.left = !!v;
    else if (dir === 'right') this.input.right = !!v;
  }

  clearInput() {
    this.input.fire = false;
    this.input.left = false;
    this.input.right = false;
  }

  /** 手动瞄准点（世界坐标）；一旦设置就不再走自动瞄准 */
  setAim(x, y) {
    if (this.state !== 'playing') return;
    this.aim = { x, y };
  }

  clearAim() {
    this.aim = null;
  }

  requestJump() {
    if (this.state === 'playing') this.input.jumpQueued = true;
  }

  castSkill(index) {
    if (this.state !== 'playing') return;
    const slot = this.skills[index];
    if (!slot || slot.cd > 0) return;
    const id = slot.id;
    if (id === 'freeze') this._castFreeze();
    else if (id === 'fire') this._castFire();
    else if (id === 'lightning') this._castLightning();
    slot.cd = slot.total;
    this.tutorialEvent('skill');
    this.audio.play(id);
    this.pushHud();
  }

  _castFreeze() {
    const dur = SK.freeze.duration;
    for (const e of this.enemies) if (e.alive) { e.frozen = dur; e.hitFlash = 0; }
    for (const e of this.flyers) if (e.alive) e.frozen = Math.min(dur, 2.2);
    if (this.boss && this.boss.vulnerable) this.boss.frozen = SK.freeze.bossDuration;
    this.fx.flash('#a9e6ff', 0.34, 0.5);
    for (const e of [...this.enemies, ...this.flyers]) {
      this.fx.burst('fx_ice', e.x, e.kind === 'flyer' ? e.y : GY - e.height * 0.5, 7, {
        speed: 300, size: 44, life: 0.7, additive: true,
      });
    }
    this.fx.shake(5);
    this.toast('toast.frozen');
  }

  _castFire() {
    this.fireWaves.push({
      x: this.player.x + 70,
      y: GY - 130,
      w: 160,
      h: 240,
      vx: SK.fire.speed,
      life: SK.fire.life,
      damage: SK.fire.damage,
      hits: new Set(),
    });
    this.fx.flash('#ffb15a', 0.18, 0.25);
    this.fx.shake(8);
    this.audio.play('fire');
  }

  _castLightning() {
    const targets = [];
    const pool = [];
    for (const e of this.enemies) if (e.alive) pool.push({ ref: e, x: e.x, y: GY - e.height * 0.5 });
    for (const e of this.flyers) if (e.alive) pool.push({ ref: e, x: e.x, y: e.y });
    if (this.boss && this.boss.vulnerable) pool.push({ ref: this.boss, x: this.boss.x, y: GY - 300 });
    pool.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x));
    for (let i = 0; i < Math.min(SK.lightning.targets, pool.length); i++) targets.push(pool[i]);

    if (!targets.length) {
      // 没有目标也放一道天雷，至少给一个反馈
      targets.push({ ref: null, x: this.player.x + 620, y: GY - 60 });
    }
    for (const tg of targets) {
      const points = [];
      const startX = tg.x + rand(-160, 160);
      const segs = 6;
      for (let i = 0; i <= segs; i++) {
        const k = i / segs;
        points.push({
          x: lerp(startX, tg.x, k) + (i > 0 && i < segs ? rand(-46, 46) : 0),
          y: lerp(-40, tg.y, k),
        });
      }
      this.fx.bolt(points);
      if (tg.ref) {
        if (tg.ref === this.boss) {
          this.boss.takeDamage(SK.lightning.damage, { x: tg.x, y: tg.y });
        } else {
          tg.ref.takeDamage(SK.lightning.damage * (tg.ref.frozen > 0 ? 1.3 : 1), { x: tg.x, y: tg.y });
          this.fx.damage(tg.x, tg.y - 30, SK.lightning.damage, { color: '#fff3a8' });
        }
      }
      this.fx.flash('#fffbe0', 0.14, 0.16);
      this.fx.shake(7);
    }
  }

  /* ------------------------------------------------------------ 生成 */
  spawnEnemy(type, opt = {}) {
    const e = new Enemy(this, type, opt);
    if (e.kind === 'flyer') {
      if (this.flyers.length >= GAME_CONFIG.spawn.maxAir + 3) return;
      this.flyers.push(e);
    } else {
      if (this.enemies.length >= GAME_CONFIG.spawn.maxGround + 3) return;
      this.enemies.push(e);
    }
  }

  spawnPickup(type, x, y, opt = {}) {
    const specialId = type === 'special' ? (opt.special || choice(SPECIAL_IDS)) : null;
    const cfg = specialId ? SPECIAL.types[specialId] : null;
    this.pickups.push({
      type,
      special: specialId,
      icon: cfg ? cfg.icon : null,
      tint: cfg ? cfg.tint : null,
      x,
      y: Math.min(GY - 60, y),
      size: type === 'special' ? 106 : type === 'star' ? 72 : 68,
      sprite: PICKUP_SPRITES[type],
      glow: cfg ? cfg.glow : PICKUP_GLOW[type],
      seed: rand(0, 10),
      bob: 0,
      vx: -this.scrollSpeed * 0.95,
      alive: true,
    });
  }

  spawnSpecialCrate(x, y) {
    this.spawnPickup(
      'special',
      x !== undefined ? x : this.spawnEdge + rand(0, 220),
      y !== undefined ? y : GY - rand(90, 150)
    );
  }

  spawnAcid(x, y) {
    this.acid.push({ x, y, vx: -460, vy: -210, life: 4, rot: 0, alive: true });
  }

  spawnShockwave(x, dir) {
    this.waves.push({ x, dir, speed: GAME_CONFIG.boss.slam.waveSpeed, life: 2.2, hit: false, alive: true });
    this.fx.shockwave(x, GY, dir, 120, 90);
  }

  /* ------------------------------------------------------------ 章节机关 */
  get totemBuff() {
    return this.hazards.some((h) => h.alive && h.type === 'totem');
  }

  spawnHazard(type) {
    if (type === 'tumbleweed') {
      if (this.hazards.filter((h) => h.alive && h.type === 'tumbleweed').length >= 2) return;
      this.hazards.push({
        type, x: this.spawnEdge + 120, y: GY, size: 150,
        hp: 2, maxHp: 2, rot: rand(0, Math.PI * 2),
        vx: -(300 + this.scrollSpeed * 0.22),
        hitFlash: 0, dustT: 0, seed: rand(0, 10), alive: true,
      });
    } else if (type === 'keg') {
      if (this.hazards.filter((h) => h.alive && h.type === 'keg').length >= 2) return;
      this.hazards.push({
        type, x: rand(1120, this.portrait ? 1500 : 1760), y: GY, size: 176,
        hp: 30, maxHp: 30, vx: -this.scrollSpeed * 0.32,
        fuse: 0, seed: rand(0, 10), alive: true,
      });
    } else if (type === 'totem') {
      if (this.hazards.filter((h) => h.alive && h.type === 'totem').length >= 2) return;
      this.hazards.push({
        type, x: this.portrait ? 1400 : 1520, y: GY, size: 340,
        hp: 520, maxHp: 520, vx: -this.scrollSpeed * 0.16,
        soulT: 0, seed: rand(0, 10), alive: true,
      });
      this.audio.play('wave', { volume: 0.45 });
    }
  }

  _hazardBox(hz) {
    if (hz.type === 'tumbleweed') {
      return { x: hz.x, y: GY - hz.size * 0.42, w: hz.size * 0.86, h: hz.size * 0.86 };
    }
    if (hz.type === 'keg') {
      return { x: hz.x, y: GY - hz.size * 0.5, w: hz.size * 0.66, h: hz.size * 0.94 };
    }
    return { x: hz.x, y: GY - hz.size * 0.5, w: hz.size * 0.42, h: hz.size * 0.96 };
  }

  _hitHazard(hz, dmg, x, y) {
    if (!hz.alive) return;
    if (hz.type === 'tumbleweed') {
      hz.hp -= 1;
      hz.hitFlash = 0.12;
      this.fx.burst('fx_dust', x, y, 3, { speed: 200, size: 34, life: 0.35, alpha: 0.6 });
      if (hz.hp <= 0) this._popTumbleweed(hz);
      return;
    }
    if (hz.type === 'keg') {
      if (hz.fuse > 0) return;
      hz.hp -= dmg;
      if (hz.hp <= 0) hz.fuse = 0.18;
      else this.fx.impact(x, y, 'fire');
      return;
    }
    hz.hp -= dmg;
    this.fx.impact(x, y, 'ice');
    this.audio.play('hit');
    if (hz.hp <= 0) this._destroyTotem(hz);
  }

  _popTumbleweed(hz) {
    if (!hz.alive) return;
    hz.alive = false;
    this.fx.dust(hz.x, GY - 30, 1.2);
    this.fx.burst('fx_dust', hz.x, GY - 90, 10, { speed: 300, size: 46, life: 0.6, alpha: 0.7 });
    this.audio.play('kill');
    this.addScore(120, hz.x, GY - 160, false, 120);
    this.spawnPickup('star', hz.x, GY - rand(100, 160));
  }

  _explodeKeg(hz) {
    if (!hz.alive) return;
    hz.alive = false;
    hz.fuse = 0;
    this.fx.explosion(hz.x, GY - 80, 1.35);
    this.fx.flash('#ffcf8a', 0.2, 0.22);
    this.audio.play('boom');
    const R = 300;
    for (const e of [...this.enemies, ...this.flyers]) {
      if (!e.alive) continue;
      const ey = e.kind === 'flyer' ? e.y : GY - e.height * 0.5;
      if (Math.hypot(e.x - hz.x, ey - (GY - 80)) < R) {
        e.takeDamage(260, { x: e.x, y: ey });
        this.fx.damage(e.x, ey - 20, 260, { color: '#ffcf7a' });
      }
    }
    if (this.boss && this.boss.vulnerable && Math.abs(this.boss.x - hz.x) < R + 90) {
      this.boss.takeDamage(180, { x: this.boss.x, y: GY - 260 });
    }
    // 连锁引爆
    for (const other of this.hazards) {
      if (other !== hz && other.alive && other.type === 'keg' && other.fuse <= 0
        && Math.abs(other.x - hz.x) < 340) {
        other.fuse = 0.16;
      }
    }
    this.addScore(40, hz.x, GY - 170, false, 40);
  }

  _destroyTotem(hz) {
    if (!hz.alive) return;
    hz.alive = false;
    this.fx.explosion(hz.x, GY - 190, 1.15);
    this.fx.flash('#a8ffcf', 0.22, 0.3);
    this.audio.play('boom');
    this.addScore(300, hz.x, GY - 300, false, 300);
    this.spawnPickup('ammo', hz.x, GY - 120);
    for (const e of [...this.enemies, ...this.flyers]) {
      if (!e.alive) continue;
      if (Math.abs(e.x - hz.x) < 260) e.takeDamage(140, { x: e.x, y: e.kind === 'flyer' ? e.y : GY - e.height * 0.5 });
    }
    this.toast('toast.totemDown');
  }

  _updateHazards(dt) {
    const p = this.player;
    for (const hz of this.hazards) {
      if (!hz.alive) continue;
      if (hz.type === 'tumbleweed') {
        hz.rot += dt * 3.4;
        hz.x += hz.vx * dt;
        hz.hitFlash = Math.max(0, hz.hitFlash - dt);
        hz.dustT -= dt;
        if (hz.dustT <= 0) {
          hz.dustT = 0.07;
          this.fx.add('fx_dust', hz.x + rand(-16, 16), GY - 8, {
            size: rand(30, 52), life: 0.4, alpha: 0.45, vx: -80, vy: -20, grow: 20,
          });
        }
        if (hz.x < p.x + 78) {
          p.damage('tumbleweed');
          this._popTumbleweed(hz);
          continue;
        }
        if (hz.x < -160) hz.alive = false;
      } else if (hz.type === 'keg') {
        hz.x += hz.vx * dt;
        if (hz.fuse > 0) {
          hz.fuse -= dt;
          if (hz.fuse <= 0) this._explodeKeg(hz);
        }
        if (hz.x < -180) hz.alive = false;
      } else if (hz.type === 'totem') {
        hz.x += hz.vx * dt;
        // 只有方尖碑仍在玩家前方才维持回血；前压越过它可切断光环
        hz.dormant = hz.x <= p.x - 120;
        if (!hz.dormant) {
          for (const e of this.enemies) {
            if (e.alive) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.035 * dt);
          }
          for (const e of this.flyers) {
            if (e.alive) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
          }
        }
        hz.soulT -= dt;
        if (hz.soulT <= 0) {
          hz.soulT = 0.16;
          this.fx.add('fx_acid', hz.x + rand(-70, 70), GY - rand(60, 300), {
            size: rand(20, 42), life: 1.1, vy: -70, alpha: 0.45, additive: true,
          });
        }
        if (hz.x < -220) hz.alive = false;
      }
    }
    if (this.hazards.some((h) => !h.alive)) {
      this.hazards = this.hazards.filter((h) => h.alive);
    }
  }

  /* ------------------------------------------------------------ 开火与命中 */
  fireShot() {
    const p = this.player;
    if (this.state !== 'playing') return;
    if (p.ammo <= 0) {
      if (p.emptyTimer <= 0) {
        p.emptyTimer = 0.5;
        this.audio.play('empty');
        this.toast('toast.noShells', 'warn');
      }
      p.fireTimer = 0.32;
      return;
    }
    const m = p.muzzle();
    let angle = 0;
    if (this.aim) {
      // 手动瞄准：鼠标 / 触屏拖拽决定射线方向，允许抬头打飞行单位与低头压地面
      const dx = this.aim.x - m.x;
      const dy = this.aim.y - m.y;
      angle = Math.abs(dx) < 8
        ? (dy < 0 ? -WPN.aimUp : WPN.aimDown)
        : clamp(Math.atan2(dy, dx), -WPN.aimUp, WPN.aimDown);
    } else {
      const target = this._nearestTarget();
      if (target) {
        const dx = target.x - m.x;
        const dy = target.y - m.y;
        angle = clamp(Math.atan2(dy, dx), -WPN.autoAim, WPN.autoAim);
      }
    }
    const sp = p.specialTime > 0 ? p.special : null;
    const cfg = sp ? SPECIAL.types[sp] : null;
    const pellets = cfg && cfg.pellets ? cfg.pellets : WPN.pellets;
    const spread = cfg && cfg.spread != null ? cfg.spread : WPN.spread;
    const damage = WPN.damage * (cfg && cfg.damageMul ? cfg.damageMul : 1);

    p.muzzleAngle = angle;
    p.muzzleFlash = 1;
    p.recoil = 1;
    p.ammo -= 1;
    p.fireTimer = WPN.fireDelay;
    this.shotCount += 1;

    for (let i = 0; i < pellets; i++) {
      const a = angle + (i - (pellets - 1) / 2) * spread + rand(-0.006, 0.006);
      this.bullets.push({
        x: m.x, y: m.y,
        vx: Math.cos(a) * WPN.speed,
        vy: Math.sin(a) * WPN.speed,
        damage,
        life: WPN.life,
        special: sp,
        pierce: cfg && cfg.pierce ? cfg.pierce : 0,
        hits: null,
        alive: true,
        seed: rand(0, 10),
        trail: [],
      });
    }
    this.fx.muzzle(m.x, m.y, angle);
    this.audio.play('shoot', { volume: 0.85 });
    this.fx.shake(WPN.shake);
    this.tutorialEvent('shot');
    this.pushHud();
  }

  _nearestTarget() {
    let best = null;
    let bestD = WPN.autoAimRange;
    for (const e of this.enemies) {
      if (!e.alive || e.x < this.player.x) continue;
      const d = e.x - this.player.x;
      if (d < bestD) { bestD = d; best = { x: e.x, y: GY - e.height * 0.5, ref: e }; }
    }
    for (const e of this.flyers) {
      if (!e.alive || e.x < this.player.x) continue;
      const d = e.x - this.player.x;
      if (d < bestD) { bestD = d; best = { x: e.x, y: e.y, ref: e }; }
    }
    // 机关也是可瞄准目标：贴近玩家的风滚草优先，否则它会碾过来却打不到
    for (const hz of this.hazards) {
      if (!hz.alive) continue;
      const dx = hz.x - this.player.x;
      if (dx < 0) continue;
      const close = hz.type === 'tumbleweed' && dx < 640;
      const d = dx * (close ? 0.45 : 1);
      if (d < bestD) {
        bestD = d;
        best = { x: hz.x, y: GY - hz.size * (hz.type === 'totem' ? 0.5 : 0.42), ref: hz };
      }
    }
    if (this.boss && this.boss.vulnerable) {
      const dx = this.boss.x - this.player.x;
      if (dx > 0 && dx < bestD) best = { x: this.boss.x, y: GY - 300, ref: this.boss };
    }
    return best;
  }

  registerKill(enemy, opt = {}) {
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = GAME_CONFIG.score.comboWindow;
    const mul = 1 + Math.min(GAME_CONFIG.score.comboMax, this.combo) * 0.1;
    if (!opt.contact) {
      this.addScore(enemy.score * mul, enemy.x, (enemy.kind === 'flyer' ? enemy.y : GY - enemy.height * 0.6), false, enemy.score);
      if (Math.random() < (enemy.drop || 0)) {
        const roll = Math.random();
        let type = 'ammo';
        if (roll < 0.18) type = 'star';
        else if (roll < 0.28) type = 'heart';
        else if (roll < 0.4) type = 'shield';
        this.spawnPickup(type, enemy.x, enemy.kind === 'flyer' ? Math.min(enemy.y + 40, GY - 80) : GY - rand(80, 150));
      }
    }
    if (this.combo >= 3) {
      this.fx.floatText(enemy.x, (enemy.kind === 'flyer' ? enemy.y : GY - enemy.height) - 40,
        `x${(1 + Math.min(10, this.combo) * 0.1).toFixed(1)}`, '#ffe28a', 38);
    }
  }

  addScore(n, x, y, silent = false, base = 0) {
    this.scoreFloat += n;
    if (!silent) {
      this.fx.floatText(x, y, `+${Math.round(base || n)}`, '#ffe9a8', 40);
    }
  }

  onPlayerHurt() {
    this.combo = 0;
    this.comboTimer = 0;
    this.fx.flash('#ff4b36', 0.3, 0.32);
    this.fx.shake(18);
    this.fx.burst('fx_blood', this.player.x, this.player.feetY - 150, 10, { speed: 360, size: 50, life: 0.7, gravity: 900 });
    this.audio.play('hurt');
    if (this.player.lives <= 0) {
      this.player.alive = false;
      this.state = 'dying';
      this.overTimer = 1.5;
      this.audio.stopMusic(0.8);
      this.audio.play('lose');
    }
    this.pushHud();
  }

  /* ------------------------------------------------------------ 教程 */
  tutorialEvent(name) {
    if (this.tutorial.active) this.tutorial.event(name);
  }

  toast(key, tone = 'info') {
    if (this.hooks.toast) this.hooks.toast(key, tone);
  }

  /* ------------------------------------------------------------ 主更新 */
  update(dt) {
    this.time += dt;
    if (this.state === 'paused' || this.state === 'menu' || this.state === 'over') {
      this.fx.update(dt * 0.35);
      return;
    }
    if (this.state === 'dying') {
      this.overTimer -= dt;
      this.fx.update(dt);
      this.scene.update(dt * 0.25, this.scrollSpeed * dt * 0.25, this.scrollSpeed * 0.25);
      if (this.overTimer <= 0) this.gameOver();
      return;
    }
    if (this.state === 'victory') {
      this.fx.update(dt);
      this.scene.update(dt * 0.4, this.scrollSpeed * dt * 0.4, this.scrollSpeed * 0.4);
      this._updateBossDeath(dt);
      return;
    }

    // 正常游玩
    const stage = STAGES[this.stageIndex];
    const duration = Math.max(1, stage.to - stage.from);
    const k = clamp((this.director.elapsed - stage.from) / duration, 0, 1);
    const targetSpeed = lerp(stage.scrollSpeed[0], stage.scrollSpeed[1], k) * (this.tutorial.active ? 0.72 : 1);
    this.scrollSpeed = lerp(this.scrollSpeed, targetSpeed, Math.min(1, dt * 2.2));
    const scrollDelta = this.scrollSpeed * dt;
    this.scene.update(dt, scrollDelta, this.scrollSpeed);

    this.player.update(dt, this.input, this.time);
    this.tutorial.update(dt);
    this.director.update(dt);
    this._updateSkills(dt);
    this._updateHazards(dt);

    // 击杀后清理 + 更新
    for (const arr of [this.enemies, this.flyers]) {
      for (const e of arr) e.update(dt);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
    this.flyers = this.flyers.filter((e) => e.alive);

    if (this.boss) {
      this.boss.update(dt);
      if (this.boss.dead) this.boss = null;
    }
    this._updateBossDeath(dt);

    this._updateBullets(dt);
    this._updatePickups(dt);
    this._updateAcid(dt);
    this._updateWaves(dt);
    this._updateFireWaves(dt);

    // 连击衰减
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // 生存分
    if (!this.tutorial.active) {
      this.scoreFloat += GAME_CONFIG.score.perSecond * dt;
    }
    if (this.scoreFloat >= 1) {
      const add = Math.floor(this.scoreFloat);
      this.score += add;
      this.scoreFloat -= add;
    }

    this.fx.update(dt);

    // 教程实时提示
    this._updateHint();

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.pushHud();
    }
  }

  _updateSkills(dt) {
    for (const s of this.skills) {
      if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    }
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 4) b.trail.shift();
      if (b.life <= 0 || b.x > W + 80 || b.y < -60 || b.y > H + 60) {
        this.bullets.splice(i, 1);
        continue;
      }

      let hit = false;
      const bb = { x: b.x, y: b.y, w: 44, h: 30 };
      const touched = b.hits || (b.hits = []);
      // 先判定章节机关：火药桶 / 图腾 / 风滚草都能被打中
      for (const hz of this.hazards) {
        if (!hz.alive) continue;
        if (aabb(bb, this._hazardBox(hz))) {
          this._hitHazard(hz, b.damage, b.x, b.y);
          this.fx.hitSpark(b.x, b.y);
          hit = true;
          break;
        }
      }

      // 普通僵尸：穿甲弹可以继续往前打，已命中过的目标不会重复结算
      if (!hit) {
        for (const e of this.enemies) {
          if (!e.alive || touched.indexOf(e) >= 0) continue;
          if (!aabb(bb, e.hitbox)) continue;
          const crit = Math.random() < 0.14;
          const dmg = b.damage * (crit ? WPN.headshotMul : 1) * (e.frozen > 0 ? WPN.frozenMul : 1);
          e.takeDamage(dmg, { x: b.x, y: b.y });
          if (crit) this.fx.damage(b.x, b.y - 26, Math.round(dmg), { crit: true });
          this.fx.hitSpark(b.x, b.y);
          touched.push(e);
          if (b.special === 'blast') this._blastAt(b.x, b.y, b.damage * SPECIAL.types.blast.splashMul, e);
          if (b.pierce > 0) b.pierce -= 1;
          else { hit = true; break; }
        }
      }
      if (!hit || b.pierce > 0) {
        for (const e of this.flyers) {
          if (!e.alive || touched.indexOf(e) >= 0) continue;
          if (!aabb(bb, e.hitbox)) continue;
          const crit = Math.random() < 0.16;
          const dmg = b.damage * (crit ? WPN.headshotMul : 1) * (e.frozen > 0 ? WPN.frozenMul : 1) * 1.1;
          e.takeDamage(dmg, { x: b.x, y: b.y });
          if (crit) this.fx.damage(b.x, b.y - 20, Math.round(dmg), { crit: true });
          this.fx.hitSpark(b.x, b.y);
          touched.push(e);
          if (b.special === 'blast') this._blastAt(b.x, b.y, b.damage * SPECIAL.types.blast.splashMul, e);
          if (b.pierce > 0) b.pierce -= 1;
          else { hit = true; break; }
        }
      }
      if (!hit && this.boss && this.boss.vulnerable) {
        if (aabb(bb, this.boss.hitbox)) {
          const crit = Math.random() < 0.1;
          const dmg = b.damage * (crit ? WPN.headshotMul : 1) * (this.boss.frozen > 0 ? WPN.frozenMul : 1);
          this.boss.takeDamage(dmg, { x: b.x, y: b.y });
          if (b.special === 'blast') this._blastAt(b.x, b.y, b.damage * SPECIAL.types.blast.splashMul, null);
          this.fx.hitSpark(b.x, b.y);
          hit = true;
        }
      }
      if (hit) this.bullets.splice(i, 1);
    }
  }

  /** 爆裂弹的着弹范围伤害；同一时刻的多次爆炸只播一次特效，避免糊成一片 */
  _blastAt(x, y, damage, exclude) {
    const cf = SPECIAL.types.blast;
    const r2 = cf.splashR * cf.splashR;
    for (const e of this.enemies) {
      if (!e.alive || e === exclude) continue;
      const dx = e.x - x;
      const dy = GY - e.height * 0.45 - y;
      if (dx * dx + dy * dy <= r2) e.takeDamage(damage, { x, y });
    }
    for (const e of this.flyers) {
      if (!e.alive || e === exclude) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2) e.takeDamage(damage, { x, y });
    }
    if (this.boss && this.boss.vulnerable) {
      const dx = this.boss.x - x;
      const dy = GY - 330 - y;
      if (dx * dx + dy * dy <= r2) this.boss.takeDamage(damage, { x, y });
    }
    if (this.time - (this._blastFxAt || 0) > 0.06) {
      this._blastFxAt = this.time;
      this.fx.explosion(x, y, 0.42);
      this.audio.play('boom', { volume: 0.4 });
    }
  }

  _updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.x -= this.scrollSpeed * 0.9 * dt;
      if (p.x < -100) {
        this.pickups.splice(i, 1);
        continue;
      }
      const dx = p.x - this.player.x;
      const dy = p.y - (this.player.feetY - 150);
      if (Math.hypot(dx, dy) < 120) {
        this._collect(p);
        this.pickups.splice(i, 1);
      }
    }
  }

  _collect(p) {
    const pl = this.player;
    this.audio.play('pickup');
    if (p.type === 'ammo') {
      const ok = pl.addAmmo(GAME_CONFIG.pickups.ammo.amount);
      if (ok) {
        this.audio.play('ammo');
        this.fx.floatText(p.x, p.y - 40, `+${GAME_CONFIG.pickups.ammo.amount}`, '#ffe2a0', 36);
      } else {
        this.toast('toast.ammoFull');
        this.addScore(50, p.x, p.y, false, 50);
      }
    } else if (p.type === 'heart') {
      const ok = pl.heal();
      if (ok) {
        this.audio.play('heart');
        this.fx.floatText(p.x, p.y - 40, '+1', '#ff9fb0', 40);
      } else {
        this.addScore(150, p.x, p.y, false, 150);
      }
    } else if (p.type === 'shield') {
      pl.shield = GAME_CONFIG.pickups.shield.duration;
      this.audio.play('shield');
      this.toast('toast.shield');
      this.fx.floatText(p.x, p.y - 40, 'SHIELD', '#8fe0ff', 38);
    } else if (p.type === 'special') {
      const cfg = SPECIAL.types[p.special];
      pl.grantSpecial(p.special, SPECIAL.duration);
      pl.addAmmo(SPECIAL.crateAmmo);
      this.audio.play('star');
      this.audio.play('shield');
      this.toast(`toast.special${p.special[0].toUpperCase()}${p.special.slice(1)}`);
      this.fx.floatText(p.x, p.y - 52, t(cfg.nameKey), cfg.tint, 34);
      this.fx.burst('fx_muzzle', p.x, p.y, 8, { speed: 300, size: 46, life: 0.5, additive: true });
    } else {
      const gain = GAME_CONFIG.pickups.star.score;
      this.addScore(gain, p.x, p.y - 40, false, gain);
      this.audio.play('star');
    }
    this.fx.burst('fx_muzzle', p.x, p.y, 5, { speed: 260, size: 40, life: 0.35, additive: true });
    this.tutorialEvent('pickup');
    this.pushHud();
  }

  _updateAcid(dt) {
    for (let i = this.acid.length - 1; i >= 0; i--) {
      const a = this.acid[i];
      a.life -= dt;
      a.vy += 820 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += dt * 6;
      if (a.y >= GY - 10) {
        this.fx.burst('fx_acid', a.x, GY - 20, 8, { speed: 240, size: 46, life: 0.55, gravity: 500 });
        this.acid.splice(i, 1);
        continue;
      }
      if (a.life <= 0 || a.x < -100) {
        this.acid.splice(i, 1);
        continue;
      }
      const dx = a.x - this.player.x;
      const dy = a.y - (this.player.feetY - 150);
      if (Math.hypot(dx, dy) < 100) {
        this.player.damage('acid');
        this.fx.burst('fx_acid', a.x, a.y, 10, { speed: 260, size: 42, life: 0.5, gravity: 400 });
        this.acid.splice(i, 1);
      }
    }
  }

  _updateWaves(dt) {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.life -= dt;
      w.x += w.dir * w.speed * dt;
      if (Math.random() < 0.5) this.fx.add('fx_dust', w.x, GY + rand(-4, 10), { size: 90, life: 0.5, grow: 70, alpha: 0.55 });
      if (!w.hit) {
        const near = Math.abs(w.x - this.player.x) < 95;
        const onGround = this.player.feetY > GY - 80;
        if (near && onGround) {
          w.hit = true;
          this.player.damage('shockwave');
        }
      }
      if (w.life <= 0 || w.x < -140 || w.x > W + 140) this.waves.splice(i, 1);
    }
  }

  _updateFireWaves(dt) {
    for (let i = this.fireWaves.length - 1; i >= 0; i--) {
      const f = this.fireWaves[i];
      f.life -= dt;
      f.x += f.vx * dt;
      this.fx.add('fx_fire', f.x + rand(-40, 40), f.y + rand(-90, 90), {
        size: rand(120, 190), life: 0.28, additive: true, alpha: 0.75,
      });
      const box = { x: f.x, y: f.y, w: f.w, h: f.h };
      for (const hz of this.hazards) {
        if (!hz.alive || f.hits.has(hz)) continue;
        if (aabb(box, this._hazardBox(hz))) {
          f.hits.add(hz);
          this._hitHazard(hz, 120, hz.x, GY - 100);
        }
      }
      for (const e of this.enemies) {
        if (!e.alive || f.hits.has(e)) continue;
        if (aabb(box, e.hitbox)) {
          f.hits.add(e);
          e.takeDamage(f.damage, { x: e.x, y: GY - e.height * 0.5 });
          this.fx.damage(e.x, GY - e.height * 0.7, f.damage, { color: '#ffcf7a' });
        }
      }
      for (const e of this.flyers) {
        if (!e.alive || f.hits.has(e)) continue;
        if (aabb(box, e.hitbox)) {
          f.hits.add(e);
          e.takeDamage(f.damage, { x: e.x, y: e.y });
          this.fx.damage(e.x, e.y - 20, f.damage, { color: '#ffcf7a' });
        }
      }
      if (this.boss && this.boss.vulnerable && !f.hits.has(this.boss)) {
        if (aabb(box, this.boss.hitbox)) {
          f.hits.add(this.boss);
          this.boss.takeDamage(f.damage, { x: this.boss.x, y: GY - 300 });
        }
      }
      if (f.life <= 0 || f.x > W + 200) this.fireWaves.splice(i, 1);
    }
  }

  _updateBossDeath(dt) {
    if (this.bossDeathTimer <= 0) return;
    this.bossDeathTimer -= dt;
    if (this.boss && Math.random() < 0.55) {
      const bx = this.boss.x + rand(-220, 220);
      const by = GY - rand(60, 560);
      this.fx.explosion(bx, by, rand(0.5, 1.1));
    }
    if (this.bossDeathTimer <= 0 && this.state === 'playing') {
      this.finishVictory();
    }
  }

  _updateHint() {
    let key = null;
    if (this.tutorial.active) {
      const step = this.tutorial.step;
      if (step && step.id === 4) {
        const near = this.pickups.find((p) => p.x > this.player.x && p.x < W - 20);
        if (near) key = near.type === 'heart' ? 'tutorial.hint.life' : 'tutorial.hint.ammo';
      } else if (step && step.id === 5) {
        key = 'tutorial.hint.skill';
      } else if (step && step.id === 6) {
        key = 'tutorial.hint.flyer';
      }
    }
    if (this.boss && this.boss.state === 'telegraph' && this.boss.pending === 'slam') {
      key = 'tutorial.hint.boss';
    }
    if (key !== this.hintKey) {
      this.hintKey = key;
      if (this.hooks.hint) this.hooks.hint(key);
    }
  }

  /* ------------------------------------------------------------ HUD */
  pushHud() {
    if (!this.hooks.hud) return;
    const stage = STAGES[this.stageIndex];
    this.hooks.hud({
      score: Math.round(this.score + this.scoreFloat),
      best: this.best,
      lives: this.player.lives,
      maxLives: P.maxLives,
      ammo: this.player.ammo,
      maxAmmo: P.maxAmmo,
      shield: this.player.shield,
      special: this.player.special ? {
        id: this.player.special,
        time: this.player.specialTime,
        nameKey: SPECIAL.types[this.player.special].nameKey,
        icon: SPECIAL.types[this.player.special].icon,
        tint: SPECIAL.types[this.player.special].tint,
      } : null,
      stage: this.stageIndex + 1,
      stageNameKey: stage.nameKey,
      stageSubKey: stage.subKey,
      remaining: this.director.remaining,
      elapsed: this.director.elapsed,
      combo: this.combo,
      comboMul: 1 + Math.min(GAME_CONFIG.score.comboMax, this.combo) * 0.1,
      skills: this.skills.map((s) => ({ id: s.id, cd: s.cd, total: s.total, ready: s.cd <= 0 })),
      boss: this.boss ? {
        hp: Math.max(0, this.boss.hp),
        maxHp: this.boss.maxHp,
        phase2: this.boss.phase2,
        state: this.boss.state,
        nameKey: GAME_CONFIG.boss.nameKey,
      } : null,
      tutorial: this.tutorial.active,
      paused: this.state === 'paused',
    });
  }

  /* ------------------------------------------------------------ 渲染 */
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const shakeX = this.fx.shakeX;
    const shakeY = this.fx.shakeY;
    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(1.03, 1.03);
    ctx.translate(-W / 2, -H / 2);

    this.scene.draw(ctx, { shakeX, shakeY });

    if (this.state !== 'menu') {
      // 章节机关在僵尸后方
      for (const hz of this.hazards) drawHazard(ctx, hz, this.time);

      // 头目在僵尸后方
      if (this.boss) this.boss.draw(ctx);

      for (const e of this.enemies) e.draw(ctx);
      for (const e of this.flyers) e.draw(ctx);
      for (const p of this.pickups) drawPickup(ctx, p, this.time);

      // 火墙
      const fire = assets.get('fx_fire');
      for (const f of this.fireWaves) {
        if (!fire) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.92;
        const fh = f.h * 1.5;
        const fw = f.w * 1.9;
        ctx.drawImage(fire, f.x - fw / 2, f.y - fh / 2, fw, fh);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(fire, f.x - fw * 0.85, f.y - fh * 0.36, fw * 0.9, fh * 0.72);
        ctx.restore();
      }

      // 子弹
      const bullet = assets.get('fx_bullet');
      for (const b of this.bullets) {
        const ang = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55;
        for (let i = 0; i < b.trail.length; i++) {
          const tr = b.trail[i];
          ctx.globalAlpha = 0.12 + i * 0.06;
          if (bullet) ctx.drawImage(bullet, tr.x - 26, tr.y - 12, 52, 24);
        }
        if (b.special) {
          const tint = SPECIAL.types[b.special].tint;
          const halo = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 44);
          halo.addColorStop(0, tint);
          halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 44, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        if (bullet) ctx.drawImage(bullet, -34, -17, 68, 34);
        ctx.restore();
      }

      // 酸液
      const acid = assets.get('fx_acid');
      for (const a of this.acid) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.rot);
        if (acid) ctx.drawImage(acid, -30, -30, 60, 60);
        ctx.restore();
      }

      // 震地波
      const dust = assets.get('fx_dust');
      for (const w of this.waves) {
        if (!dust) break;
        ctx.save();
        const k = 1 - w.life / 2.2;
        ctx.globalAlpha = 0.9 - k * 0.4;
        const dw = 260 + k * 120;
        const dh = 150 + k * 40;
        ctx.translate(w.x, GY + 10);
        if (w.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(dust, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      }

      this.player.draw(ctx, this.time, this.quality);

      this.fx.draw(ctx);
      if (this.aim) this._drawAim(ctx);

      if (this.tutorial.visible) this._drawGuide(ctx);
      this._drawBossWarning(ctx);
    }

    ctx.restore();
  }

  _drawAim(ctx) {
    const reticle = assets.get('ui_reticle');
    if (!reticle) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5.2);
    const s = 94 + pulse * 8;
    ctx.save();
    ctx.translate(this.aim.x, this.aim.y);
    ctx.rotate(this.time * 0.55);
    ctx.globalAlpha = 0.72 + pulse * 0.2;
    ctx.drawImage(reticle, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  _drawGuide(ctx) {
    const step = this.tutorial.step;
    const t = this.time;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    const arrow = assets.get('ui_arrow');
    const reticle = assets.get('ui_reticle');

    // 最近的补给：下方箭头 + 呼吸光环
    const nearPickup = this.pickups
      .filter((p) => p.x > this.player.x - 60 && p.x < W)
      .sort((a, b) => a.x - b.x)[0];
    if (nearPickup && (step.id === 4 || step.id === 1)) {
      drawGuideRing(ctx, nearPickup.x, nearPickup.y, 90 + pulse * 18, `rgba(255,232,150,${0.34 * pulse})`, 0.5);
      if (arrow) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(nearPickup.x, nearPickup.y - 105 - pulse * 12);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(arrow, -55, -37, 110, 74);
        ctx.restore();
      }
    }

    // 目标：呼吸瞄准镜
    let target = null;
    if (step.id === 1 || step.id === 6) {
      target = step.id === 6 ? this.flyers.find((e) => e.alive) : this.enemies.find((e) => e.alive);
    } else if (step.id === 7 && this.boss) {
      target = this.boss;
    }
    if (target && reticle) {
      const tx = target.x;
      const ty = target.kind === 'flyer' ? target.y : (target === this.boss ? GY - 330 : GY - target.height * 0.55);
      const s = 150 + pulse * 24;
      ctx.save();
      ctx.globalAlpha = 0.55 + pulse * 0.35;
      ctx.translate(tx, ty);
      ctx.rotate(t * 0.6);
      ctx.drawImage(reticle, -s / 2, -s / 2, s, s);
      ctx.restore();
    }
  }

  _drawBossWarning(ctx) {
    if (!this.boss || this.boss.state !== 'telegraph' || this.boss.pending !== 'slam') return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 16);
    const g = ctx.createLinearGradient(0, GY - 10, 0, GY + 130);
    g.addColorStop(0, `rgba(255, 90, 40, ${0.28 * pulse})`);
    g.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, GY - 10, W, 140);
  }

  /* ------------------------------------------------------------ 循环 */
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }

  snapshot() {
    return this.canvas;
  }
}

export default Game;
