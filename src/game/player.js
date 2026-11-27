/**
 * 玩家：左右走位 + 原地跑射手感
 * ------------------------------------------------------------------
 * 原作是「左右移动 + 跳跃 + 连续霰弹」：升级方向始终朝右，
 * 按 A/D、←/→ 或触屏左右键前后走位。移动端由 UI 注入同样的输入状态。
 */
import { GAME_CONFIG } from '../../config/game.config.js';
import { clamp, lerp } from './physics.js';
import { drawHero, heroMuzzle } from '../art/characters.js';

const P = GAME_CONFIG.player;

export class Player {
  constructor(game) {
    this.game = game;
    this.setBounds();
    this.reset();
  }

  setBounds() {
    this.xMin = this.game.portrait ? P.xMinPortrait : P.xMin;
    this.xMax = this.game.portrait ? P.xMaxPortrait : P.xMax;
    if (this.x !== undefined) this.x = clamp(this.x, this.xMin, this.xMax);
  }

  reset() {
    this.setBounds();
    this.x = clamp(this.game.portrait ? P.x + 90 : P.x, this.xMin, this.xMax);
    this.feetY = GAME_CONFIG.meta.groundY;
    this.vy = 0;
    this.vx = 0;
    this.onGround = true;
    this.frame = 0;
    this.runPhase = 0;
    this.lean = 0;
    this.stepTimer = 0;
    this.recoil = 0;
    this.landSquash = 0;
    this.jumpStretch = 0;
    this.invuln = 0;
    this.shield = 0;
    this.lives = P.lives;
    this.ammo = P.startAmmo;
    this.special = null;
    this.specialTime = 0;
    this.fireTimer = 0;
    this.emptyTimer = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.alive = true;
    this.muzzleAngle = 0;
    this.muzzleFlash = 0;
  }

  get hitbox() {
    return { x: this.x, y: this.feetY - P.hitH * 0.52, w: P.hitW, h: P.hitH };
  }

  update(dt, input, time) {
    if (!this.alive) return;
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shield = Math.max(0, this.shield - dt);
    this.recoil = Math.max(0, this.recoil - dt * 6);
    this.landSquash = Math.max(0, this.landSquash - dt * 6);
    this.jumpStretch = Math.max(0, this.jumpStretch - dt * 7);
    this.emptyTimer = Math.max(0, this.emptyTimer - dt);
    if (this.specialTime > 0) {
      this.specialTime = Math.max(0, this.specialTime - dt);
      if (this.specialTime === 0) this.special = null;
    }

    // 左右走位：带加速度，手感不飘；越界立刻夹住
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const targetVx = dir * P.moveSpeed;
    const dv = targetVx - this.vx;
    const accel = (dir === 0 ? P.moveAccel * 1.35 : P.moveAccel) * dt;
    this.vx += clamp(dv, -accel, accel);
    if (dir === 0 && Math.abs(this.vx) < 6) this.vx = 0;
    this.x += this.vx * dt;
    if (this.x <= this.xMin || this.x >= this.xMax) {
      this.x = clamp(this.x, this.xMin, this.xMax);
      this.vx = 0;
    }
    this.lean = lerp(this.lean, (this.vx / P.moveSpeed) * 0.075, Math.min(1, dt * 10));

    // 走动扬尘：给前后移动一个明确的地面反馈
    if (dir !== 0) {
      this.game.tutorialEvent('move');
      if (this.onGround) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.stepTimer = 0.19;
          this.game.fx.dust(this.x - Math.sign(this.vx) * 74, GAME_CONFIG.meta.groundY, 0.22);
        }
      }
    } else {
      this.stepTimer = 0;
    }

    // 跳跃缓存 & 土狼时间
    if (input.jumpQueued) {
      this.jumpBuffer = P.jumpBuffer;
      input.jumpQueued = false;
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? P.coyote : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = P.jumpVel;
      this.onGround = false;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumpStretch = 1;
      this.game.audio.play('jump');
      this.game.fx.dust(this.x - 10, GAME_CONFIG.meta.groundY, 0.5);
      this.game.tutorialEvent('jump');
    }

    // 重力 / 落地
    if (!this.onGround) {
      this.vy += P.gravity * dt;
      this.feetY += this.vy * dt;
      if (this.feetY >= GAME_CONFIG.meta.groundY) {
        this.feetY = GAME_CONFIG.meta.groundY;
        this.vy = 0;
        this.onGround = true;
        this.landSquash = 1;
        this.game.audio.play('land');
        this.game.fx.dust(this.x, GAME_CONFIG.meta.groundY, 0.8);
        this.game.fx.shake(3);
      }
    }

    // 跑动帧：走位时步频更快
    this.runPhase += dt * (this.onGround ? 13 + Math.min(6, Math.abs(this.vx) / P.moveSpeed * 7) : 4);
    this.frame = Math.floor(this.runPhase) % 4;

    // 开火
    if (input.fire && this.fireTimer <= 0) {
      this.game.fireShot();
    }
  }

  muzzle() {
    return heroMuzzle(this);
  }

  damage(source = 'zombie') {
    if (!this.alive || this.invuln > 0) return false;
    // 新手教学期间不掉血：玩家还在读卡片/找按键，敌人只做陪练
    if (this.game.tutorial && this.game.tutorial.active) {
      this.invuln = 0.6;
      this.game.fx.burst('fx_ice', this.x, this.feetY - 150, 6, { speed: 260, size: 34, life: 0.4, additive: true });
      return false;
    }
    if (this.shield > 0) {
      this.shield = 0;
      this.invuln = 0.7;
      this.game.audio.play('shield');
      this.game.fx.flash('#8fe0ff', 0.24, 0.2);
      this.game.fx.burst('fx_ice', this.x, this.feetY - 150, 12, { speed: 360, size: 46, life: 0.6, additive: true });
      this.game.toast('toast.shield');
      return false;
    }
    this.lives -= 1;
    this.invuln = P.invulnAfterHit;
    this.game.onPlayerHurt(source);
    return true;
  }

  grantSpecial(id, duration) {
    this.special = id;
    this.specialTime = duration;
  }

  addAmmo(amount) {
    const before = this.ammo;
    this.ammo = Math.min(P.maxAmmo, this.ammo + amount);
    return this.ammo > before;
  }

  heal() {
    if (this.lives >= P.maxLives) return false;
    this.lives += 1;
    return true;
  }

  draw(ctx, time, quality) {
    drawHero(ctx, this, time, quality);
  }
}

export default Player;
