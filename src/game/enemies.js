/**
 * 敌人与头目
 * ------------------------------------------------------------------
 * 地面僵尸：铁桶、路障、木桶、蛮汉、女牛仔、骨爬者。
 * 诅咒首级：悬浮首级，俯冲或吐酸液。
 * 头目：王冠蛮兽，砸地（震地波）、召唤、冲锋、半血狂暴。
 */
import { GAME_CONFIG } from '../../config/game.config.js';
import { assets } from '../core/assets.js';
import { drawZombie, drawBoss } from '../art/characters.js';
import { rand } from './physics.js';

const EC = GAME_CONFIG.enemies;
const B = GAME_CONFIG.boss;
const GY = GAME_CONFIG.meta.groundY;

const SPRITES = {
  walker: 'zombie_bucket',
  cone: 'zombie_cone',
  barrel: 'zombie_barrel',
  brute: 'zombie_brute',
  cowgirl: 'zombie_cowgirl',
  crawler: 'zombie_crawler',
  f_bucket: 'flyer_bucket',
  f_cone: 'flyer_cone',
  f_cowgirl: 'flyer_cowgirl',
  f_crawler: 'flyer_crawler',
  f_brute: 'flyer_brute',
};

export class Enemy {
  constructor(game, type, opt = {}) {
    const cfg = EC[type];
    this.game = game;
    this.type = type;
    this.cfg = cfg;
    this.kind = cfg.kind;
    this.sprite = SPRITES[type];
    this.height = cfg.height;
    const sprite = assets.get(this.sprite);
    this.aspect = sprite ? sprite.width / sprite.height : cfg.w / cfg.h;
    const scaleHp = opt.hpScale || 1;
    this.maxHp = Math.round(cfg.hp * scaleHp);
    this.hp = this.maxHp;
    this.speed = cfg.speed * (opt.speedScale || 1);
    this.score = cfg.score;
    this.drop = cfg.drop;
    this.x = opt.x !== undefined ? opt.x : game.spawnEdge + rand(0, 220);
    this.groundY = GY;
    this.y = this.kind === 'flyer' ? (opt.y || rand(330, 610)) : GY;
    this.baseY = this.y;
    this.phase = rand(0, Math.PI * 2);
    this.seed = rand(0, 10);
    this.frozen = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.dead = false;
    this.vx = 0;
    this.vy = 0;
    this.dive = false;
    this.diveTimer = 0;
    this.spitTimer = rand(1.4, 3.2);
    this.spat = false;
    this.spitsLeft = 3;
    this.contactCd = 0;
    this.hover = 0;
    this.age = 0;
    this.slowed = 0;
  }

  get hitbox() {
    if (this.kind === 'flyer') {
      // 命中盒贴合立绘：底部在 e.y，脸和躯干集中在上半段
      return {
        x: this.x,
        y: this.y - this.height * 0.44,
        w: Math.max(76, this.height * this.aspect * 0.9),
        h: this.height * 0.78,
      };
    }
    return { x: this.x, y: GY - this.height * 0.44, w: this.cfg.w, h: this.height * 0.8 };
  }

  takeDamage(dmg, opt = {}) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.hitFlash = 0.09;
    const hpRatio = Math.max(0, this.hp / this.maxHp);
    if (this.hp <= 0) {
      this.die(opt);
    } else {
      this.game.fx.impact(opt.x ?? this.x, opt.y ?? (this.kind === 'flyer' ? this.y : GY - this.height * 0.55), this.frozen > 0 ? 'ice' : 'blood');
      this.game.audio.play('hit');
      if (hpRatio < 0.5) this.slowed = 0.12;
    }
  }

  die(opt = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.dead = true;
    const y = this.kind === 'flyer' ? this.y : GY - this.height * 0.5;
    this.game.fx.death(this.x, this.kind === 'flyer' ? this.y : GY, this.height / 300);
    this.game.audio.play('kill');
    this.game.registerKill(this, opt);
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    this.frozen = Math.max(0, this.frozen - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.slowed = Math.max(0, this.slowed - dt);
    this.phase += dt * (this.kind === 'flyer' ? 4.6 : 6.2) * (this.frozen > 0 ? 0 : 1);

    const scroll = this.game.scrollSpeed;
    const freezeMul = this.frozen > 0 ? 0.06 : 1;
    // 灵魂图腾：全场僵尸移速提升
    const buff = this.game.totemBuff ? 1.28 : 1;

    if (this.kind === 'ground') {
      const tut = this.game.tutorial && this.game.tutorial.active;
      this.x -= (this.speed * buff * freezeMul + scroll * 0.46) * dt;
      // 教学陪练停在安全距离外，玩家读完卡片再开火
      if (tut && this.x < this.game.player.x + 240) {
        this.x = this.game.player.x + 240;
        return;
      }
      if (this.x < this.game.player.x + 46) {
        // 摸到玩家：造成伤害后自己也被撞散
        this.game.player.damage(this.type);
        this.die({ contact: true, silent: true });
      }
      return;
    }

    // 飞行
    if (this.frozen > 0) {
      this.y += 160 * dt;
      if (this.y >= GY - 40) {
        this.game.fx.burst('fx_ice', this.x, GY - 20, 16, { speed: 380, size: 56, life: 0.7, additive: true });
        this.game.audio.play('freeze');
        this.die({ frozenShatter: true });
      }
      return;
    }

    if (this.cfg.spits && !this.dive && this.spitsLeft > 0) {
      this.spitTimer -= dt;
      if (this.x < 1500 && this.x > this.game.player.x + 260) {
        this.x -= this.speed * buff * 0.2 * dt;
        this.hover += dt;
        if (this.spitTimer <= 0) {
          this.spitTimer = rand(2.6, 4.2);
          this.game.spawnAcid(this.x - 30, this.y + 20);
          this.game.audio.play('spit');
          this.spitsLeft -= 1;
        }
        this.y = this.baseY + Math.sin(this.age * 2.2 + this.phase) * 18;
        return;
      }
      this.x -= (this.speed * buff + scroll * 0.14) * dt;
      this.y = this.baseY + Math.sin(this.age * 2.2 + this.phase) * 18;
      return;
    }

    if (this.cfg.dives) {
      if (!this.dive && this.x < this.game.player.x + 760) {
        this.dive = true;
        this.diveTimer = 0;
      }
      if (this.dive) {
        this.diveTimer += dt;
        const px = this.game.player.x;
        const py = this.game.player.feetY - 150;
        const dx = px - this.x;
        const dy = py - this.y;
        const len = Math.hypot(dx, dy) || 1;
        this.x += (dx / len) * 620 * buff * dt;
        this.y += (dy / len) * 620 * buff * dt;
        if (this.x < px + 60 && Math.abs(this.y - py) < 140) {
          this.game.player.damage(this.type);
          this.die({ contact: true });
        }
        if (this.x < -160) this.alive = false;
        return;
      }
    }

    this.x -= (this.speed * buff + scroll * 0.2) * dt;
    this.y = this.baseY + Math.sin(this.age * 2.2 + this.phase) * 20;
    this.contactCd = Math.max(0, this.contactCd - dt);
    const px = this.game.player.x;
    const py = this.game.player.feetY - 150;
    if (this.contactCd <= 0 && this.x < px + 70 && Math.abs(this.y - py) < 150) {
      this.contactCd = 1;
      this.game.player.damage(this.type);
      this.die({ contact: true });
    }
    if (this.x < -200) this.alive = false;
  }

  draw(ctx) {
    drawZombie(ctx, this, this.game.time);
  }
}

export class Boss {
  constructor(game, opt = {}) {
    this.game = game;
    this.maxHp = Math.round(B.hp * (opt.hpScale || 1));
    this.hp = this.maxHp;
    this.x = B.enterFrom;
    this.groundY = GY;
    this.state = 'enter';
    this.timer = 0;
    this.actionTimer = 2.4;
    this.hitFlash = 0;
    this.frozen = 0;
    this.phase2 = false;
    this.alive = true;
    this.dead = false;
    this.slamCd = 0;
    this.summonCd = 0;
    this.chargeCd = 0;
    this.contactCd = 0;
    this.roared = false;
    this.seed = Math.random() * 10;
    this.aura = 0;
  }

  get hitbox() {
    return { x: this.x, y: GY - B.h * 0.5, w: B.w, h: B.h * 0.92 };
  }

  get vulnerable() {
    return this.state !== 'enter' && this.state !== 'dying';
  }

  takeDamage(dmg, opt = {}) {
    if (!this.vulnerable) return;
    const mul = this.state === 'stun' ? 1.35 : 1;
    const real = Math.round(dmg * mul);
    this.hp -= real;
    this.hitFlash = 0.08;
    this.game.fx.impact(opt.x ?? this.x, opt.y ?? GY - B.h * 0.55, 'blood');
    this.game.fx.damage(opt.x ?? this.x + rand(-40, 40), (opt.y ?? GY - B.h * 0.6) - 20, real, { crit: this.state === 'stun' });
    this.game.audio.play('hit');
    if (!this.phase2 && this.hp <= this.maxHp * B.phase2At) {
      this.phase2 = true;
      this.game.fx.flash('#ff5a3c', 0.34, 0.4);
      this.game.fx.shake(18);
      this.game.audio.play('roar');
      this.game.toast('stage.bossRage', 'danger');
      this.actionTimer = 0.9;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.timer = 0;
      this.alive = false;
      this.dead = true;
      this.game.onBossDeath();
    }
  }

  update(dt) {
    if (this.dead) return;
    this.timer += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.slamCd = Math.max(0, this.slamCd - dt);
    this.summonCd = Math.max(0, this.summonCd - dt);
    this.chargeCd = Math.max(0, this.chargeCd - dt);
    this.contactCd = Math.max(0, this.contactCd - dt);
    this.aura += dt;

    const p = this.game.player;
    const spd = this.frozen > 0 ? 0.18 : 1;

    switch (this.state) {
      case 'enter': {
        this.x -= 620 * dt * spd;
        if (this.x <= B.standX) {
          this.x = B.standX;
          this.state = 'idle';
          this.timer = 0;
          this.actionTimer = 1.3;
          this.game.audio.play('roar');
          this.game.fx.shake(12);
          this.game.bossStarted();
        }
        break;
      }
      case 'idle': {
        if (this.frozen > 0) break;
        // 慢慢向前压，给玩家压力
        this.x -= 16 * dt;
        if (this.x < B.standX - 120) this.x = B.standX - 120;
        this.actionTimer -= dt;
        if (this.actionTimer <= 0) this._chooseAction();
        break;
      }
      case 'telegraph': {
        if (this.timer >= this.pendingTime) {
          if (this.pending === 'slam') this._slam();
          else if (this.pending === 'charge') {
            this.state = 'charge';
            this.timer = 0;
            this.game.audio.play('charge');
          } else if (this.pending === 'summon') this._summon();
        }
        break;
      }
      case 'charge': {
        this.x -= 1650 * dt * spd;
        if (this.contactCd <= 0 && Math.abs(this.x - p.x) < 260) {
          this.contactCd = 1.2;
          p.damage('boss_charge');
        }
        if (this.x <= B.chargeX) {
          this.x = B.chargeX;
          this.state = 'stun';
          this.timer = 0;
          this.game.fx.dust(this.x - 120, GY, 2.2);
          this.game.fx.shake(16);
        }
        break;
      }
      case 'stun': {
        if (this.timer >= B.charge.stun) {
          this.state = 'return';
          this.timer = 0;
        }
        break;
      }
      case 'return': {
        this.x += 700 * dt * spd;
        if (this.x >= B.standX) {
          this.x = B.standX;
          this.state = 'idle';
          this.timer = 0;
          this.actionTimer = this.phase2 ? 0.7 : 1.4;
        }
        break;
      }
      case 'slam': {
        if (this.timer >= 0.42) {
          this.state = 'idle';
          this.timer = 0;
          this.actionTimer = this.phase2 ? 0.9 : 1.5;
        }
        break;
      }
      case 'summon': {
        if (this.timer >= 0.6) {
          this.state = 'idle';
          this.actionTimer = 1.6;
        }
        break;
      }
      case 'dying': {
        if (this.timer > 2.0) this.game.finishVictory();
        break;
      }
      default:
        break;
    }
  }

  _chooseAction() {
    const opts = [];
    if (this.slamCd <= 0) opts.push('slam', 'slam');
    if (this.chargeCd <= 0) opts.push('charge');
    if (this.summonCd <= 0) opts.push('summon');
    const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : 'slam';
    this.pending = pick;
    this.state = 'telegraph';
    this.timer = 0;
    if (pick === 'slam') {
      this.pendingTime = B.slam.telegraph;
      this.slamCd = B.slam.cooldown * (this.phase2 ? 0.62 : 1);
      this.game.audio.play('slam');
    } else if (pick === 'charge') {
      this.pendingTime = B.charge.telegraph;
      this.chargeCd = B.charge.cooldown * (this.phase2 ? 0.66 : 1);
      this.game.audio.play('charge');
    } else {
      this.pendingTime = 0.55;
      this.summonCd = B.summon.cooldown * (this.phase2 ? 0.7 : 1);
      this.game.audio.play('roar');
    }
  }

  _slam() {
    this.state = 'slam';
    this.timer = 0;
    this.game.fx.dust(this.x, GY, 2.4);
    this.game.fx.shake(20);
    this.game.audio.play('boom');
    this.game.spawnShockwave(this.x - 120, -1);
    this.game.spawnShockwave(this.x + 120, 1);
  }

  _summon() {
    this.state = 'summon';
    this.timer = 0;
    this.game.audio.play('roar');
    this.game.fx.dust(this.x - 60, GY, 1.8);
    const count = this.phase2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.game.spawnEnemy(this.phase2 && i === 2 ? 'f_brute' : 'walker', {
        x: this.x - 60 + rand(-90, 90),
      });
    }
    if (this.phase2) this.game.spawnEnemy('f_cone', { x: this.x - 100 });
  }

  draw(ctx) {
    drawBoss(ctx, this, this.game.time);
  }
}
