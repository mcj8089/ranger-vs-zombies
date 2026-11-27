/**
 * 新手教学（逻辑）
 * ------------------------------------------------------------------
 * 七步渐进式教学：开火 → 走位 → 跳跃 → 捡补给 → 魔法 → 空中敌人 → 头目。
 * 每步有「动作门槛」，完成后自动进入下一步；也支持跳过与重播。
 * 教学期间关卡计时冻结，只生成陪练敌人。
 */
export const TUTORIAL_STEPS = [
  { id: 1, titleKey: 'tutorial.step1.title', textKey: 'tutorial.step1.text', gateKey: 'tutorial.step1.gate', keyKey: 'tutorial.step1.key', gate: { event: 'shot', count: 5 } },
  { id: 2, titleKey: 'tutorial.step2.title', textKey: 'tutorial.step2.text', gateKey: 'tutorial.step2.gate', keyKey: 'tutorial.step2.key', gate: { event: 'move', count: 1 } },
  { id: 3, titleKey: 'tutorial.step3.title', textKey: 'tutorial.step3.text', gateKey: 'tutorial.step3.gate', keyKey: 'tutorial.step3.key', gate: { event: 'jump', count: 1 } },
  { id: 4, titleKey: 'tutorial.step4.title', textKey: 'tutorial.step4.text', gateKey: 'tutorial.step4.gate', gate: { event: 'pickup', count: 1 } },
  { id: 5, titleKey: 'tutorial.step5.title', textKey: 'tutorial.step5.text', gateKey: 'tutorial.step5.gate', keyKey: 'tutorial.step5.key', gate: { event: 'skill', count: 1 } },
  { id: 6, titleKey: 'tutorial.step6.title', textKey: 'tutorial.step6.text', gateKey: 'tutorial.step6.gate', gate: { event: 'time', count: 7 } },
  { id: 7, titleKey: 'tutorial.step7.title', textKey: 'tutorial.step7.text', gateKey: 'tutorial.step7.gate', gate: { event: 'boss', count: 999 } },
];

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.stepIndex = 0;
    this.completed = true;
    this.replay = false;
    this.counters = {};
    this.stepElapsed = 0;
    this.total = TUTORIAL_STEPS.length;
    this.delay = 0;
    this.hint = null;
    this.tipTimer = 0;
    this.onChange = null;
  }

  requestReplay() {
    this.replay = true;
  }

  shouldPlay(saveData) {
    return this.replay || !saveData.tutorialDone;
  }

  begin(saveData) {
    if (!this.shouldPlay(saveData)) {
      this.active = false;
      this.completed = true;
      return false;
    }
    this.active = true;
    this.completed = false;
    this.replay = false;
    this.stepIndex = 0;
    this.counters = {};
    this.stepElapsed = 0;
    this.delay = 0;
    this._enterStep(0);
    return true;
  }

  _enterStep(i) {
    this.stepIndex = i;
    this.stepElapsed = 0;
    this.delay = 0;
    this.counters = {};
    this.game.director.onTutorialStep(TUTORIAL_STEPS[i].id);
    this._emit();
    if (TUTORIAL_STEPS[i].id === 7) {
      // 头目步骤只做提示，不再冻结关卡时间
      this.active = false;
      this.tipTimer = 5;
      this.game.save.patch({ tutorialDone: true });
    }
  }

  _emit() {
    if (this.onChange) this.onChange(this);
  }

  get step() {
    return TUTORIAL_STEPS[this.stepIndex];
  }

  get visible() {
    return !this.completed && this.stepIndex >= 0 && this.stepIndex < this.total;
  }

  get isTipOnly() {
    return this.step && this.step.id === 7 && this.active === false;
  }

  event(name, n = 1) {
    if (!this.active) return;
    this.counters[name] = (this.counters[name] || 0) + n;
    this._checkGate();
  }

  setHint(key) {
    if (this.hint !== key) {
      this.hint = key;
      this._emit();
    }
  }

  update(dt) {
    if (this.tipTimer > 0) {
      this.tipTimer -= dt;
      if (this.tipTimer <= 0) {
        this.completed = true;
        this._emit();
      }
    }
    if (!this.active) return;
    this.stepElapsed += dt;

    if (this.step.gate.event === 'time') {
      this.counters.time = this.stepElapsed;
      this._checkGate();
    }

    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay <= 0) this._next();
    }
  }

  _checkGate() {
    if (!this.active || this.delay > 0) return;
    const g = this.step.gate;
    if ((this.counters[g.event] || 0) >= g.count) {
      this.delay = 1.1;
      this._emit();
    }
  }

  _next() {
    if (this.stepIndex + 1 >= this.total) {
      this.finish();
      return;
    }
    this._enterStep(this.stepIndex + 1);
  }

  skip() {
    this.finish();
  }

  finish() {
    this.active = false;
    this.completed = true;
    this.hint = null;
    this.game.save.patch({ tutorialDone: true });
    this._emit();
    this.game.toast('tutorial.done');
  }

  /** 供 UI 进度条使用：0..1 */
  get progress() {
    return (this.stepIndex + (this.delay > 0 ? 1 : 0)) / this.total;
  }
}

export default Tutorial;
