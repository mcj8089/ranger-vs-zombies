/**
 * 关卡推进 / 刷怪导演
 * ------------------------------------------------------------------
 * 三章时间轴、刷怪节奏、空投补给与 BOSS 触发都在这里。
 * 新手教学期间冻结计时，只生成教学需要的“陪练”，不会用真实难度劝退。
 */
import { STAGES } from '../../config/levels.js';
import { GAME_CONFIG } from '../../config/game.config.js';
import { rand, choice } from './physics.js';

const SPAWN = GAME_CONFIG.spawn;
const SPECIAL = GAME_CONFIG.specialAmmo;

export class LevelDirector {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.elapsed = 0;
    this.stageIndex = 0;
    this.stageTime = 0;
    this.spawnTimer = SPAWN.startDelay;
    this.pickupTimer = 6;
    this.bossSpawned = false;
    this.finished = false;
    this.tutorialStep = 0;
    this.tutorialSpawned = {};
    this.ammoDropTimer = 10;
    this.specialTimer = SPECIAL.firstCrate;
    this.specialDropped = 0;
    this.mechanicTimer = 0;
    this.mechanicCount = 0;
    this._resetMechanic(STAGES[0]);
  }

  get stage() {
    return STAGES[this.stageIndex];
  }

  get remaining() {
    return Math.max(0, GAME_CONFIG.meta.runTime - this.elapsed);
  }

  update(dt) {
    if (this.finished) return;
    const game = this.game;
    const tut = game.tutorial;

    if (!tut.active) this.elapsed += dt;

    // 章节推进（教学期间锁在第一关，不计时）
    if (!tut.active) {
      let idx = 0;
      for (let i = 0; i < STAGES.length; i++) {
        if (this.elapsed >= STAGES[i].from) idx = i;
      }
      if (idx !== this.stageIndex) {
        this.stageIndex = idx;
        this.stageTime = 0;
        game.enterStage(idx, false);
        this._resetMechanic();
      } else {
        this.stageTime += dt;
      }
    }

    if (tut.active) {
      this._updateTutorial();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && game.enemies.length + game.flyers.length < SPAWN.maxGround + SPAWN.maxAir) {
      this._spawnWave();
      const [a, b] = this.stage.spawn.interval;
      const k = Math.min(1, this.stageTime / Math.max(1, this.stage.to - this.stage.from));
      this.spawnTimer = rand(a + (b - a) * k, a + (b - a) * k + 0.3);
    }

    // 空投补给
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = rand(5.5, 8.5);
      this._dropPickup();
    }

    // 弹药兜底：快打空时送一箱，避免“站着没子弹”的死局
    this.ammoDropTimer -= dt;
    if (this.ammoDropTimer <= 0) {
      this.ammoDropTimer = 13;
      if (game.player.ammo < 55) {
        game.spawnPickup('ammo', 1150 + rand(0, 500), GAME_CONFIG.meta.groundY - 90);
        game.toast('toast.noShells', 'warn');
      }
    }

    // 章节专属机关
    this._updateMechanic(dt);

    // 特殊子弹宝箱：场上同时只留一个，捡完才继续计时
    if (!game.pickups.some((p) => p.type === 'special')) {
      this.specialTimer -= dt;
      if (this.specialTimer <= 0) {
        game.spawnSpecialCrate();
        if (this.specialDropped === 0) game.toast('toast.crateDrop');
        this.specialDropped += 1;
        this.specialTimer = rand(SPECIAL.interval[0], SPECIAL.interval[1]);
      }
    }

    // 第三章 BOSS
    const bossAt = this.stage.bossAt;
    if (bossAt !== undefined && !this.bossSpawned && this.elapsed >= this.stage.from + bossAt) {
      this.bossSpawned = true;
      game.spawnBoss();
    }
  }

  _resetMechanic(stage = this.stage) {
    const m = stage.mechanic;
    this.mechanicTimer = m ? m.first : Infinity;
    this.mechanicCount = 0;
  }

  _updateMechanic(dt) {
    const m = this.stage.mechanic;
    if (!m) return;
    this.mechanicTimer -= dt;
    if (this.mechanicTimer > 0) return;
    const game = this.game;
    const live = game.hazards.filter((h) => h.alive && h.type === m.type).length;
    if (live < (m.max || 2)) {
      game.spawnHazard(m.type);
      if (this.mechanicCount === 0) game.toast(m.toastKey, 'info');
      this.mechanicCount += 1;
    }
    this.mechanicTimer = rand(m.interval[0], m.interval[1]);
  }

  onTutorialStep(step) {
    this.tutorialStep = step;
    const game = this.game;
    const GY = GAME_CONFIG.meta.groundY;
    // 进入下一步时收掉上一步的陪练，避免一堆僵尸挤在玩家身边
    if (step >= 2) {
      game.enemies.length = 0;
      game.flyers.length = 0;
    }
    if (step === 1) {
      game.spawnEnemy('walker', { x: 1720, hpScale: 0.55, speedScale: 0.8 });
    } else if (step === 2) {
      // 走位练习：远处放一只慢速陪练，玩家可以放心前后移动
      game.spawnEnemy('walker', { x: 1780, hpScale: 0.5, speedScale: 0.55 });
    } else if (step === 3) {
      game.spawnEnemy('walker', { x: 1080, hpScale: 0.6, speedScale: 0.85 });
    } else if (step === 4) {
      game.spawnPickup('ammo', 1000, GY - 90);
    } else if (step === 5) {
      game.spawnEnemy('walker', { x: 1560, hpScale: 0.7 });
      game.spawnEnemy('cone', { x: 1760, hpScale: 0.7 });
      game.spawnEnemy('f_bucket', { x: 1660, y: 520, hpScale: 0.7 });
    } else if (step === 6) {
      game.spawnEnemy('f_cone', { x: 1580, y: 470, hpScale: 0.8 });
      game.spawnEnemy('f_cowgirl', { x: 1800, y: 430, hpScale: 0.8 });
    }
  }

  _updateTutorial() {
    const game = this.game;
    // 教学期间不推进关卡，但保留轻量空投，保证弹药
    if (this.tutorialStep >= 4 && game.player.ammo < 40) {
      this.ammoTutTimer = (this.ammoTutTimer || 4) - 1 / 60;
      if (this.ammoTutTimer <= 0) {
        this.ammoTutTimer = 4;
        game.spawnPickup('ammo', 1080, GAME_CONFIG.meta.groundY - 90);
      }
    }
  }

  _spawnWave() {
    const game = this.game;
    const stage = this.stage;
    const scale = 1 + this.stageIndex * 0.18 + Math.min(0.5, this.stageTime / 120);
    const airChance = stage.spawn.airChance + (this.stageIndex === 2 ? 0.08 : 0);
    const groundTypes = stage.spawn.ground;
    const airTypes = stage.spawn.air;

    if (Math.random() < airChance && game.flyers.length < SPAWN.maxAir) {
      const type = choice(airTypes);
      game.spawnEnemy(type, { hpScale: scale, speedScale: 1 + this.stageIndex * 0.06, y: rand(330, 600) });
    } else if (game.enemies.length < SPAWN.maxGround) {
      const type = choice(groundTypes);
      game.spawnEnemy(type, { hpScale: scale, speedScale: 1 + this.stageIndex * 0.06 });
    }

    // 中后期偶尔成对刷，制造压迫感
    if (this.elapsed > 75 && Math.random() < 0.32 && game.enemies.length < SPAWN.maxGround - 1) {
      game.spawnEnemy(choice(groundTypes), { hpScale: scale, x: game.spawnEdge + 200 + rand(0, 160) });
    }
  }

  _dropPickup() {
    const game = this.game;
    const d = game.player.lives < GAME_CONFIG.player.maxLives ? 0.1 : 0;
    const roll = Math.random();
    let type = 'ammo';
    if (roll < 0.16 + d) type = 'heart';
    else if (roll < 0.42) type = 'star';
    else if (roll < 0.56) type = 'shield';
    game.spawnPickup(type, 1900 + rand(0, 300), GAME_CONFIG.meta.groundY - rand(80, 170));
  }
}

export default LevelDirector;
