/**
 * UI 层
 * ------------------------------------------------------------------
 * 纯 DOM 覆盖层：开屏之后的菜单、HUD、暂停/设置/图鉴/分享/结算、
 * 新手教学卡片、关卡横幅、提示与 toast。
 * 与逻辑层只通过 game.hooks + game 的公开方法交互；文案全部走 i18n。
 */
import { t, i18n } from '../core/i18n.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { save } from '../core/save.js';
import { ads } from '../core/ads.js';
import { share, PLATFORMS } from '../core/share.js';
import { GAME_CONFIG } from '../../config/game.config.js';

const SKILL_ICON = { freeze: 'fx_ice', fire: 'fx_fire', lightning: 'icon_bolt' };
const SKILL_KEY = { freeze: '1', fire: '2', lightning: '3' };

const PLATFORM_LOOK = {
  facebook: ['#4b8bf5', '#1450b8'],
  x: ['#2a2a33', '#08080b'],
  reddit: ['#ff6a3d', '#d92b0d'],
  whatsapp: ['#4ade80', '#128c4a'],
  telegram: ['#52b7f0', '#1769a8'],
  linkedin: ['#2f8bd8', '#0a4d8f'],
  tiktok: ['#33333d', '#08080b'],
  instagram: ['#ff6a9e', '#a82a9e'],
  youtube: ['#ff5a4a', '#b3120a'],
};

const PLATFORM_PATH = {
  facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  reddit: 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.99 4.87-3.858 0-6.99-2.176-6.99-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z',
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  telegram: 'M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.1.56-.72 0-.6-.27-.84-.95L6.3 13.7l-5.45-1.7c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.43 1.9.24 1.54 1.74Z',
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  instagram: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
};

function src(key) {
  const im = assets.get(key);
  return im ? im.src : '';
}

function icon(key, cls = '') {
  return `<img src="${src(key)}" alt=""${cls ? ` class="${cls}"` : ''}>`;
}

function node(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

function svgIcon(id) {
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${PLATFORM_PATH[id]}"/></svg>`;
}

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    document.body.classList.toggle('touch', this.isTouch);

    this.nickname = '';
    this.nicknameTimer = 0;
    this.hintKey = null;
    this.tutorialVisible = false;
    this.tutorialStep = 0;
    this.reviveUsed = false;
    this.reviving = false;
    this.lastCombo = 0;
    this.lastResult = null;
    this.shareReturn = null;
    this.shareSnapshot = null;
    this.shareCard = null;
    this.shareFile = null;
    this.shareScore = 0;
    this.shareBuilding = false;
    this.shareDirty = false;
    this.settingsReturn = 'menu';
    this.bannerTimer = 0;
    this.tipTimer = 0;
    this.pausedByUI = false;

    this.buildMenu();
    this.buildHud();
    this.buildBanner();
    this.buildTutorial();
    this.buildToasts();
    this.buildPause();
    this.buildSettings();
    this.buildBestiary();
    this.buildShare();
    this.buildConfirm();
    this.buildResult();
    this.wireKeyboard();
    this.wirePointer();
    this.wireAim();
    this.applySettings();
    this.showMenu(false);
    this.refreshBest();
  }

  hooks() {
    return {
      hud: (p) => this.onHud(p),
      banner: (b) => this.showBanner(b),
      gameOver: (r) => this.showResult(r, false),
      victory: (r) => this.showResult(r, true),
      toast: (key, tone) => this.toast(key, tone),
      tutorial: (tut) => this.syncTutorial(tut),
      hint: (key) => this.setHint(key),
      paused: (v) => this.onPaused(v),
      menu: () => this.showMenu(true),
      bossStart: () => this.onBossStart(),
    };
  }

  /* ============================================================ 菜单 */
  buildMenu() {
    const bestiaryIcon = this.isTouch ? 'zombie_walker' : 'zombie_walker';
    this.menu = node('div', 'screen show');
    this.menu.id = 'screenMenu';
    this.menu.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-shade"></div>
      <div class="menu-dust"></div>
      <div class="menu-top">
        <div class="url-chip"><span class="url-dot"></span>pipygames.com</div>
        <div class="best-chip">${icon('hud_ranger')}<span>${t('menu.best')}</span><b data-best>0</b></div>
      </div>
      <div class="menu-inner">
        <img class="menu-logo" src="${src('logo')}" alt="${t('meta.title')}">
        <p class="menu-tagline">${t('meta.tagline')}</p>
        <div class="menu-actions">
          <button class="play-orb" data-act="play" aria-label="${t('menu.play')}">
            ${icon('icon_play')}<span>${t('menu.play')}</span>
          </button>
          <div class="menu-row">
            <button class="chip-btn" data-act="bestiary">${icon(bestiaryIcon)}${t('menu.bestiary')}</button>
            <button class="chip-btn" data-act="settings">${icon('icon_settings')}${t('menu.settings')}</button>
            <button class="chip-btn" data-act="share">${icon('ico_ui_3')}${t('menu.share')}</button>
          </div>
        </div>
        <div class="menu-hint">${t(this.isTouch ? 'menu.hintMobile' : 'menu.hint')}</div>
      </div>
      <div class="menu-footer">${t('menu.footer')}</div>
    `;
    this.root.appendChild(this.menu);
    this.bestChip = this.menu.querySelector('[data-best]');
    this.menu.querySelector('[data-act="play"]').addEventListener('click', () => this.startRun());
    this.menu.querySelector('[data-act="bestiary"]').addEventListener('click', () => this.openBestiary());
    this.menu.querySelector('[data-act="settings"]').addEventListener('click', () => this.openSettings('menu'));
    this.menu.querySelector('[data-act="share"]').addEventListener('click', () => this.openShare('menu'));
  }

  refreshBest() {
    const best = save.get('best') || 0;
    if (this.bestChip) this.bestChip.textContent = i18n.num(best);
  }

  showMenu(animated = true) {
    this.menu.classList.add('show');
    this.hud.classList.add('hidden');
    this.closeAllModals();
    this.hideTutorial();
    this.hideBanner();
    this.setHint(null);
    this.refreshBest();
    this.lastResult = null;
    this.reviveUsed = false;
    this.shareSnapshot = null;
    this.shareCard = null;
    this.shareFile = null;
    this.tips.classList.remove('fade');
    if (!animated) this.menu.style.opacity = '';
  }

  /* ============================================================ HUD */
  buildHud() {
    this.hud = node('div', 'hud hidden');
    this.hud.innerHTML = `
      <div class="hud-top">
        <div class="hud-left">
          <div class="portrait">${icon('hud_ranger')}</div>
          <div class="hud-stack">
            <div class="hearts" data-hearts></div>
            <div class="chip score">${icon('ico_hud_0')}<span data-score>0</span></div>
          </div>
        </div>
        <div class="hud-mid">
          <div class="stage-chip"><span class="dot"></span><b data-stage>${t('common.level', { n: 1 })}</b><span data-stage-name></span></div>
          <div class="boss-bar hidden" data-boss>
            <div class="boss-name" data-boss-name></div>
            <div class="boss-frame">
              <div class="boss-fill-wrap"><div class="boss-fill" data-boss-fill></div></div>
            </div>
          </div>
        </div>
        <div class="hud-right">
          <div class="chip ammo" data-ammo>${icon('pick_ammo')}<span data-ammo-val>200</span></div>
          <div class="chip buff hidden" data-buff><img data-buff-icon alt=""><span data-buff-val>12</span></div>
          <div class="chip time">${icon('ico_hud_5')}<span data-time>3:00</span></div>
          <div class="chip shield hidden" data-shield>${icon('pick_shield')}<span data-shield-val>8</span></div>
          <button class="hud-btn" data-act="pause" aria-label="${t('hud.tipPause')}">${icon('icon_pause')}</button>
        </div>
      </div>
      <div class="hint-chip hidden" data-hint><span></span></div>
      <div class="skill-bar" data-skills></div>
      <div class="combo-badge hidden" data-combo>${`<span>1.0</span><small>COMBO</small>`}</div>
      <div class="desktop-tips" data-tips>
        <span class="kbd">Mouse</span><span>${t('hud.tipAim')}</span>
        <span class="tips-sep">·</span>
        <span class="kbd">A D</span><span>${t('hud.tipMove')}</span>
        <span class="tips-sep">·</span>
        <span class="kbd">W</span><span>${t('hud.tipJump')}</span>
        <span class="tips-sep">·</span>
        <span class="kbd">Space</span><span>${t('hud.tipFire')}</span>
        <span class="tips-sep">·</span>
        <span class="kbd">1 2 3</span><span>${t('hud.tipSkills')}</span>
        <span class="tips-sep">·</span>
        <span class="kbd">P</span><span>${t('hud.tipPause')}</span>
      </div>
      <div class="touch-controls">
        <div class="move-pad">
          <button class="touch-btn move" data-act="moveLeft" aria-label="${t('hud.tapLeft')}">
            <img src="${src('ui_arrow')}" alt="" style="transform:rotate(180deg)">
          </button>
          <button class="touch-btn move" data-act="moveRight" aria-label="${t('hud.tapRight')}">
            <img src="${src('ui_arrow')}" alt="">
          </button>
        </div>
        <button class="touch-btn jump" data-act="jump" aria-label="${t('hud.tapJump')}">
          <img src="${src('ui_arrow')}" alt="" style="transform:rotate(-90deg)"><span>${t('hud.tapJump')}</span>
        </button>
        <button class="touch-btn fire" data-act="fire" aria-label="${t('hud.tapShoot')}">
          ${icon('ui_gun_shotgun')}<span>${t('hud.tapShoot')}</span>
        </button>
      </div>
    `;
    this.root.appendChild(this.hud);

    this.heartRow = this.hud.querySelector('[data-hearts]');
    this.scoreVal = this.hud.querySelector('[data-score]');
    this.ammoChip = this.hud.querySelector('[data-ammo]');
    this.ammoVal = this.hud.querySelector('[data-ammo-val]');
    this.buffChip = this.hud.querySelector('[data-buff]');
    this.buffIcon = this.hud.querySelector('[data-buff-icon]');
    this.buffVal = this.hud.querySelector('[data-buff-val]');
    this.timeVal = this.hud.querySelector('[data-time]');
    this.shieldChip = this.hud.querySelector('[data-shield]');
    this.shieldVal = this.hud.querySelector('[data-shield-val]');
    this.stageEl = this.hud.querySelector('[data-stage]');
    this.stageName = this.hud.querySelector('[data-stage-name]');
    this.bossBar = this.hud.querySelector('[data-boss]');
    this.bossName = this.hud.querySelector('[data-boss-name]');
    this.bossFill = this.hud.querySelector('[data-boss-fill]');
    this.skillBar = this.hud.querySelector('[data-skills]');
    this.comboBadge = this.hud.querySelector('[data-combo]');
    this.comboVal = this.comboBadge.querySelector('span');
    this.hintChip = this.hud.querySelector('[data-hint]');
    this.hintText = this.hintChip.querySelector('span');
    this.tips = this.hud.querySelector('[data-tips]');
    this.fireBtn = this.hud.querySelector('[data-act="fire"]');
    this.jumpBtn = this.hud.querySelector('[data-act="jump"]');
    this.moveLeftBtn = this.hud.querySelector('[data-act="moveLeft"]');
    this.moveRightBtn = this.hud.querySelector('[data-act="moveRight"]');

    this.hud.querySelector('[data-act="pause"]').addEventListener('click', () => this.pause());
    const ids = ['freeze', 'fire', 'lightning'];
    ids.forEach((id, i) => {
      const b = node('button', 'skill');
      b.dataset.skill = id;
      b.setAttribute('aria-label', t(`skill.${id}`));
      b.innerHTML = `${icon(SKILL_ICON[id])}<div class="cd"><span>0</span></div><span class="key">${SKILL_KEY[id]}</span>`;
      b.addEventListener('click', () => this.game.castSkill(i));
      this.skillBar.appendChild(b);
    });
    this.skillBtns = [...this.skillBar.querySelectorAll('.skill')];
  }

  onHud(p) {
    this.scoreVal.textContent = i18n.num(p.score);
    this.ammoVal.textContent = `${p.ammo}`;
    this.ammoChip.classList.toggle('low', p.ammo <= 30);
    this.timeVal.textContent = i18n.clock(p.remaining);
    this.stageEl.textContent = t('common.level', { n: p.stage });
    this.stageName.textContent = t(p.stageNameKey);

    if (this.heartRow.children.length !== p.maxLives) {
      this.heartRow.innerHTML = Array.from({ length: p.maxLives }, () => icon('ico_hud_1')).join('');
    }
    [...this.heartRow.children].forEach((im, i) => im.classList.toggle('lost', i >= p.lives));

    const shield = p.shield || 0;
    this.shieldChip.classList.toggle('hidden', shield <= 0);
    if (shield > 0) this.shieldVal.textContent = `${Math.ceil(shield)}`;

    const sp = p.special;
    this.buffChip.classList.toggle('hidden', !sp);
    if (sp) {
      if (this.buffIcon.dataset.key !== sp.id) {
        this.buffIcon.dataset.key = sp.id;
        this.buffIcon.src = src(sp.icon);
      }
      this.buffChip.style.setProperty('--buff-tint', sp.tint);
      this.buffChip.title = t(sp.nameKey);
      this.buffChip.setAttribute('aria-label', t(sp.nameKey));
      this.buffVal.textContent = `${Math.ceil(sp.time)}`;
    }

    if (p.boss) {
      this.bossBar.classList.remove('hidden');
      this.bossBar.classList.toggle('phase2', !!p.boss.phase2);
      this.bossName.textContent = t(p.boss.nameKey);
      this.bossFill.style.width = `${Math.max(0, Math.min(100, (p.boss.hp / p.boss.maxHp) * 100))}%`;
    } else {
      this.bossBar.classList.add('hidden');
    }
    this.hud.classList.toggle('boss-active', !!p.boss);

    for (const slot of p.skills) {
      const btn = this.skillBtns.find((b) => b.dataset.skill === slot.id);
      if (!btn) continue;
      const cooling = !slot.ready;
      btn.classList.toggle('cooling', cooling);
      btn.classList.toggle('ready', !cooling);
      const cdEl = btn.querySelector('.cd span');
      btn.style.setProperty('--cd', cooling ? (slot.cd / Math.max(0.001, slot.total)).toFixed(3) : '0');
      cdEl.textContent = cooling ? `${Math.ceil(slot.cd)}` : '';
    }

    const showCombo = p.combo >= 2;
    this.comboBadge.classList.toggle('hidden', !showCombo);
    if (showCombo) {
      this.comboVal.textContent = `x${p.comboMul.toFixed(1)}`;
      if (this.lastCombo !== p.combo) {
        this.comboBadge.style.animation = 'none';
        void this.comboBadge.offsetWidth;
        this.comboBadge.style.animation = '';
      }
    }
    this.lastCombo = p.combo;
  }

  /* ============================================================ 开始 / 暂停 */
  startRun() {
    this.closeAllModals();
    this.menu.classList.remove('show');
    this.hud.classList.remove('hidden');
    this.hideTutorial();
    this.hideBanner();
    this.setHint(null);
    this.reviveUsed = false;
    this.lastResult = null;
    this.shareSnapshot = null;
    this.shareCard = null;
    this.shareFile = null;
    this.game.setFire(false);
    this.game.setPaused(false);
    ads.startRun();
    this.game.newRun();

    this.tips.classList.remove('fade');
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.tips.classList.add('fade'), 12000);

    const sdk = window.GameSDK;
    if (sdk && sdk.trackStart) sdk.trackStart({ stage: 1 });
  }

  pause() {
    if (this.game.state === 'playing') this.game.setPaused(true);
  }

  onPaused(v) {
    if (v) {
      this.game.setFire(false);
      this.hideHintOnly();
      this.pauseModal.classList.remove('hidden');
    } else {
      this.pauseModal.classList.add('hidden');
      this.settingsModal.classList.add('hidden');
      this.pausedByUI = false;
      if (this.hintKey) this.setHint(this.hintKey);
    }
  }

  resume() {
    if (this.game.state === 'paused') {
      this.settingsModal.classList.add('hidden');
      this.game.setPaused(false);
    }
  }

  /* ============================================================ 暂停弹窗 */
  makeModal(id, frameCls = '') {
    const m = node('div', 'modal hidden');
    m.id = id;
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-frame ${frameCls}">
        <div class="panel"><div class="panel-inner"></div></div>
      </div>
    `;
    this.root.appendChild(m);
    m.querySelector('.modal-backdrop').addEventListener('click', () => this.dismissModal(id));
    return m;
  }

  dismissModal(id) {
    if (id === 'modalPause') this.resume();
    else if (id === 'modalSettings') this.closeSettings();
    else if (id === 'modalBestiary') this.bestiaryModal.classList.add('hidden');
    else if (id === 'modalShare') this.closeShare();
    else if (id === 'modalConfirm') this.confirmModal.classList.add('hidden');
  }

  headHtml(title, sub = '') {
    return `
      <div class="modal-head">
        <div>
          <h2 class="modal-title">${title}</h2>
          ${sub ? `<p class="modal-sub">${sub}</p>` : ''}
        </div>
        <button class="modal-close" data-close aria-label="${t('common.close')}">${icon('ico_ui_4')}</button>
      </div>
    `;
  }

  buildPause() {
    const m = this.makeModal('modalPause', 'narrow');
    m.querySelector('.panel-inner').innerHTML = `
      ${this.headHtml(t('pause.title'))}
      <div class="modal-body">
        <div class="pause-body">
          <div class="pause-badge">${icon('icon_pause')}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-act="resume">${icon('icon_play')}${t('pause.resume')}</button>
        <button class="btn wood" data-act="restart">${icon('ico_ui_2')}${t('pause.restart')}</button>
        <button class="btn wood" data-act="settings">${icon('icon_settings')}${t('pause.settings')}</button>
        <button class="btn red" data-act="quit">${icon('ico_ui_1')}${t('pause.quit')}</button>
      </div>
    `;
    m.querySelector('[data-close]').addEventListener('click', () => this.resume());
    m.querySelector('[data-act="resume"]').addEventListener('click', () => this.resume());
    m.querySelector('[data-act="restart"]').addEventListener('click', () => this.startRun());
    m.querySelector('[data-act="settings"]').addEventListener('click', () => this.openSettings('pause'));
    m.querySelector('[data-act="quit"]').addEventListener('click', () => {
      if (this.game.state === 'paused') this.game.setPaused(false);
      this.game.toMenu();
    });
    this.pauseModal = m;
  }

  /* ============================================================ 设置 */
  buildSettings() {
    const m = this.makeModal('modalSettings', 'narrow');
    const close = `<button class="modal-close" data-close aria-label="${t('common.close')}">${icon('ico_ui_4')}</button>`;
    m.querySelector('.panel-inner').innerHTML = `
      <div class="modal-head">
        <div>
          <h2 class="modal-title">${t('settings.title')}</h2>
          <p class="modal-sub">${t('settings.sub')}</p>
        </div>
        ${close}
      </div>
      <div class="modal-body">
        <div class="settings-list">
          <div class="setting-row">
            <div class="setting-text"><span class="setting-label">${t('settings.music')}</span></div>
            <button class="switch" data-toggle="music" role="switch" aria-checked="true"><span class="knob"></span></button>
          </div>
          <div class="setting-row">
            <div class="setting-text"><span class="setting-label">${t('settings.sfx')}</span></div>
            <button class="switch" data-toggle="sfx" role="switch" aria-checked="true"><span class="knob"></span></button>
          </div>
          <div class="setting-row">
            <div class="setting-text"><span class="setting-label">${t('settings.shake')}</span></div>
            <button class="switch" data-toggle="shake" role="switch" aria-checked="true"><span class="knob"></span></button>
          </div>
          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-label">${t('settings.tutorial')}</span>
              <span class="setting-desc">${t('settings.tutorialDesc')}</span>
            </div>
            <button class="btn wood small" data-act="replay">${t('settings.replay')}</button>
          </div>
          <div class="setting-row">
            <div class="setting-text">
              <span class="setting-label">${t('settings.reset')}</span>
              <span class="setting-desc">${t('settings.resetDesc')}</span>
            </div>
            <button class="btn red small" data-act="reset">${t('settings.reset')}</button>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn wood single" data-close>${t('settings.close')}</button>
      </div>
    `;
    m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeSettings()));
    m.querySelectorAll('[data-toggle]').forEach((b) => {
      b.addEventListener('click', () => this.toggleSetting(b.dataset.toggle));
    });
    m.querySelector('[data-act="replay"]').addEventListener('click', () => {
      this.game.tutorial.requestReplay();
      this.toast('settings.replaying');
    });
    m.querySelector('[data-act="reset"]').addEventListener('click', () => this.openConfirm());
    this.settingsModal = m;
    this.switches = [...m.querySelectorAll('[data-toggle]')];
  }

  toggleSetting(key) {
    const s = save.get('settings');
    save.setSetting(key, !s[key]);
    audio.play('ui');
    this.applySettings();
  }

  applySettings() {
    const s = save.get('settings');
    audio.setMusicVolume(s.music ? 0.36 : 0);
    audio.setSfxVolume(s.sfx ? 0.62 : 0);
    if (this.game && this.game.fx) this.game.fx.enabled = !!s.shake;
    if (this.switches) {
      for (const b of this.switches) {
        const on = !!s[b.dataset.toggle];
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      }
    }
  }

  openSettings(from) {
    this.settingsReturn = from;
    if (from === 'pause') {
      this.pauseModal.classList.add('hidden');
      audio.resume();
    }
    this.syncSettings();
    this.settingsModal.classList.remove('hidden');
  }

  syncSettings() {
    const s = save.get('settings');
    for (const b of this.switches) {
      const on = !!s[b.dataset.toggle];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
    if (this.settingsReturn === 'pause' && this.game.state === 'paused') {
      this.pauseModal.classList.remove('hidden');
      audio.suspend();
    }
  }

  /* ============================================================ 确认弹窗 */
  buildConfirm() {
    const m = this.makeModal('modalConfirm', 'narrow');
    m.querySelector('.panel-inner').innerHTML = `
      ${this.headHtml(t('settings.resetConfirm'))}
      <div class="modal-body"></div>
      <div class="modal-actions">
        <button class="btn wood" data-act="no">${t('settings.resetNo')}</button>
        <button class="btn red" data-act="yes">${t('settings.resetYes')}</button>
      </div>
    `;
    m.querySelector('[data-close]').addEventListener('click', () => m.classList.add('hidden'));
    m.querySelector('[data-act="no"]').addEventListener('click', () => m.classList.add('hidden'));
    m.querySelector('[data-act="yes"]').addEventListener('click', () => {
      save.reset();
      this.applySettings();
      this.syncSettings();
      this.refreshBest();
      m.classList.add('hidden');
      this.toast('settings.resetDone');
    });
    this.confirmModal = m;
  }

  openConfirm() {
    this.confirmModal.classList.remove('hidden');
  }

  /* ============================================================ 图鉴 */
  buildBestiary() {
    const m = this.makeModal('modalBestiary', 'wide');
    const list = [
      { id: 'walker', art: 'zombie_walker', tag: 'ground' },
      { id: 'cone', art: 'zombie_cone', tag: 'ground' },
      { id: 'barrel', art: 'zombie_barrel', tag: 'ground' },
      { id: 'brute', art: 'zombie_brute', tag: 'ground' },
      { id: 'cowgirl', art: 'zombie_cowgirl', tag: 'ground' },
      { id: 'crawler', art: 'zombie_crawler', tag: 'ground' },
      { id: 'flyer', art: 'flyer_bucket', tag: 'flyer' },
      { id: 'crowned', art: 'boss_crowned', tag: 'boss' },
    ];
    const cards = list.map((b) => {
      let stats;
      if (b.id === 'flyer') {
        stats = { hp: '145–310', spd: '162–205', score: '45–80' };
      } else if (b.id === 'crowned') {
        stats = { hp: GAME_CONFIG.boss.hp, spd: GAME_CONFIG.boss.charge.speed, score: GAME_CONFIG.boss.score };
      } else {
        const c = GAME_CONFIG.enemies[b.id];
        stats = { hp: c.hp, spd: c.speed, score: c.score };
      }
      return `
        <div class="beast-card">
          <div class="beast-art">${icon(b.art)}</div>
          <div class="beast-info">
            <div class="beast-name">${t(`bestiary.${b.id}.name`)}
              <span class="beast-tag ${b.tag === 'boss' ? 'boss' : ''}">${t(`bestiary.tag.${b.tag}`)}</span>
            </div>
            <div class="beast-stats">
              <span>${t('bestiary.hp')} <b>${stats.hp}</b></span>
              <span>${t('bestiary.speed')} <b>${stats.spd}</b></span>
              <span>${t('bestiary.score')} <b>${stats.score}</b></span>
            </div>
            <div class="beast-lore">${t(`bestiary.${b.id}.lore`)}</div>
          </div>
        </div>`;
    }).join('');

    m.querySelector('.panel-inner').innerHTML = `
      ${this.headHtml(t('bestiary.title'), t('bestiary.sub'))}
      <div class="modal-body"><div class="bestiary-grid">${cards}</div></div>
      <div class="modal-actions">
        <button class="btn wood single" data-close>${t('bestiary.close')}</button>
      </div>
    `;
    m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => m.classList.add('hidden')));
    this.bestiaryModal = m;
  }

  openBestiary() {
    this.bestiaryModal.classList.remove('hidden');
  }

  /* ============================================================ 分享 */
  buildShare() {
    const m = this.makeModal('modalShare');
    const buttons = PLATFORMS.map((p, i) => {
      const [p1, p2] = PLATFORM_LOOK[p.id];
      return `
        <button class="share-platform" data-platform="${p.id}" style="--p1:${p1};--p2:${p2};animation-delay:${i * 35}ms">
          <span class="share-icon">${svgIcon(p.id)}</span>
          <span>${t(p.nameKey)}</span>
        </button>`;
    }).join('');

    m.querySelector('.panel-inner').innerHTML = `
      ${this.headHtml(t('share.title'), t('share.sub'))}
      <div class="modal-body">
        <div class="share-body">
          <div class="share-name-row">
            <label class="share-label" for="shareNickname">${t('share.nickname')}</label>
            <input class="share-input" id="shareNickname" maxlength="20" autocomplete="off"
              placeholder="${t('share.nicknamePh')}">
          </div>
          <div class="share-grid">${buttons}</div>
          <div class="share-pre">
            <img data-preview src="${src('bg_share')}" alt="${t('share.title')}">
            <div class="share-tip">${t('share.cardHint')}</div>
          </div>
          <div class="share-status" data-status aria-live="polite"></div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn gold" data-act="download">${icon('ico_ui_3')}${t('share.download')}</button>
        <button class="btn wood" data-act="copy">${icon('ico_ui_3')}${t('share.copy')}</button>
      </div>
    `;
    m.querySelector('[data-close]').addEventListener('click', () => this.closeShare());
    m.querySelectorAll('[data-platform]').forEach((b) => {
      b.addEventListener('click', () => this.shareTo(b.dataset.platform));
    });
    m.querySelector('[data-act="download"]').addEventListener('click', () => this.downloadCard());
    m.querySelector('[data-act="copy"]').addEventListener('click', () => this.copyLink());
    this.shareModal = m;
    this.shareInput = m.querySelector('#shareNickname');
    this.sharePreview = m.querySelector('[data-preview]');
    this.shareStatus = m.querySelector('[data-status]');
    this.shareInput.addEventListener('input', () => {
      this.nickname = this.shareInput.value.slice(0, 20);
      clearTimeout(this.nicknameTimer);
      this.nicknameTimer = setTimeout(() => this.buildShareCard(), 280);
    });
  }

  async openShare(from) {
    this.shareReturn = from;
    this.shareStatus.textContent = '';
    this.shareStatus.classList.remove('warn');
    this.shareInput.value = this.nickname;
    if (from === 'result') {
      if (this.lastResult) this.shareScore = this.lastResult.score;
      this.resultModal.classList.add('hidden');
    } else {
      this.shareScore = save.get('best') || 0;
      this.shareSnapshot = this.captureSnapshot();
    }
    this.shareCard = null;
    this.shareFile = null;
    this.sharePreview.src = src('bg_share');
    this.shareModal.classList.remove('hidden');
    await this.buildShareCard();
  }

  closeShare() {
    this.shareModal.classList.add('hidden');
    if (this.shareReturn === 'result' && this.lastResult) {
      this.resultModal.classList.remove('hidden');
    }
    this.shareReturn = null;
  }

  async buildShareCard() {
    if (!this.shareModal || this.shareModal.classList.contains('hidden')) return;
    if (this.shareBuilding) { this.shareDirty = true; return; }
    this.shareBuilding = true;
    try {
      const canvas = await share.buildCard(this.shareSnapshot, this.shareScore, this.nickname);
      this.shareCard = canvas;
      this.sharePreview.src = canvas.toDataURL('image/jpeg', 0.84);
      this.shareFile = await share.fileFromCanvas(canvas);
    } catch (e) {
      console.warn('[ui] 分享卡生成失败', e && e.message);
    }
    this.shareBuilding = false;
    if (this.shareDirty) { this.shareDirty = false; this.buildShareCard(); }
  }

  async shareTo(id) {
    const mobileNative = this.isTouch && typeof navigator.share === 'function';
    const platform = mobileNative ? 'native' : id;
    let file = null;
    if (mobileNative) {
      if (!this.shareFile) await this.buildShareCard();
      file = this.shareFile;
    }
    const res = await share.share({
      platform,
      target: id,
      snapshot: this.shareSnapshot,
      file,
      score: this.shareScore,
      nickname: this.nickname,
    });

    if (res.cancel) {
      this.setShareStatus(t('share.result.cancel'), true);
    } else if (!res.ok) {
      const copied = await share.copyLink();
      this.setShareStatus(copied ? t('share.result.fail') : t('share.result.fail'), true);
    } else if (res.mode === 'card') {
      this.setShareStatus(res.copied ? t('share.result.copiedReady') : t('share.result.fail'), !res.copied);
    } else if (res.mode === 'native') {
      this.setShareStatus('');
    } else {
      this.setShareStatus(t('share.result.opened'));
    }
  }

  setShareStatus(text, warn = false) {
    this.shareStatus.textContent = text || '';
    this.shareStatus.classList.toggle('warn', !!warn);
  }

  async downloadCard() {
    if (!this.shareCard) await this.buildShareCard();
    if (!this.shareCard) { this.setShareStatus(t('share.result.fail'), true); return; }
    const ok = await share.downloadCard(this.shareCard, 'card');
    this.setShareStatus(ok ? t('share.downloaded') : t('share.result.fail'), !ok);
  }

  async copyLink() {
    const ok = await share.copyLink();
    this.setShareStatus(ok ? t('share.copied') : t('share.result.fail'), !ok);
  }

  /* ============================================================ 结算 */
  buildResult() {
    const m = this.makeModal('modalResult', 'narrow');
    m.querySelector('.panel-inner').innerHTML = `
      <div class="result-head">
        <h2 class="result-title" data-title></h2>
        <p class="result-sub" data-sub></p>
        <div class="newbest hidden" data-newbest>${icon('pick_score')}<span>${t('gameover.newBest')}</span></div>
      </div>
      <div class="result-stats" data-stats></div>
      <div class="revive-hint hidden" data-revive-hint>${t('gameover.reviveHint')}</div>
      <div class="modal-actions" data-actions></div>
    `;
    this.resultModal = m;
    this.resultTitle = m.querySelector('[data-title]');
    this.resultSub = m.querySelector('[data-sub]');
    this.resultNew = m.querySelector('[data-newbest]');
    this.resultStats = m.querySelector('[data-stats]');
    this.reviveHint = m.querySelector('[data-revive-hint]');
    this.resultActions = m.querySelector('[data-actions]');
  }

  showResult(result, win) {
    this.lastResult = result;
    this.shareSnapshot = this.captureSnapshot();
    this.shareScore = result.score;
    this.resultTitle.textContent = t(win ? 'victory.title' : 'gameover.title');
    this.resultTitle.classList.toggle('lose', !win);
    this.resultSub.textContent = t(win ? 'victory.sub' : 'gameover.sub');
    this.resultNew.classList.toggle('hidden', !result.newBest);

    this.resultStats.innerHTML = `
      <div class="stat big">
        <div class="stat-label">${t('gameover.score')}</div>
        <div class="stat-value">${i18n.num(result.score)}</div>
      </div>
      <div class="stat"><div class="stat-label">${t('gameover.kills')}</div><div class="stat-value">${i18n.num(result.kills)}</div></div>
      <div class="stat"><div class="stat-label">${t('gameover.time')}</div><div class="stat-value">${i18n.clock(result.time)}</div></div>
      <div class="stat"><div class="stat-label">${t('gameover.stage')}</div><div class="stat-value">${result.stage}</div></div>
      <div class="stat"><div class="stat-label">${t('gameover.best')}</div><div class="stat-value">${i18n.num(result.best)}</div></div>
    `;

    const canRevive = !win && !this.reviveUsed;
    this.reviveHint.classList.toggle('hidden', !canRevive);
    const actions = [];
    if (canRevive) {
      actions.push({
        label: ads.enabled ? t('gameover.revive') : t('gameover.reviveFree'),
        cls: 'red',
        icon: 'pick_life',
        act: () => this.revive(),
      });
    }
    actions.push({
      label: t(win ? 'victory.retry' : 'gameover.retry'),
      cls: 'gold',
      icon: 'ico_ui_2',
      act: () => this.startRun(),
    });
    actions.push({
      label: t(win ? 'victory.menu' : 'gameover.menu'),
      cls: 'wood',
      icon: 'ico_ui_1',
      act: () => this.game.toMenu(),
    });
    actions.push({
      label: t(win ? 'victory.share' : 'gameover.share'),
      cls: '',
      icon: 'ico_ui_3',
      act: () => this.openShare('result'),
    });

    const odd = actions.length % 2 === 1;
    this.resultActions.innerHTML = actions.map((a, i) => {
      const wide = odd && i === actions.length - 1 ? ' wide' : '';
      return `<button class="btn ${a.cls}${wide}" data-i="${i}">${icon(a.icon)}${a.label}</button>`;
    }).join('');
    this.resultActions.querySelectorAll('[data-i]').forEach((b) => {
      b.addEventListener('click', () => actions[Number(b.dataset.i)].act());
    });

    this.hideTutorial();
    this.setHint(null);
    this.hideBanner();
    this.tips.classList.add('fade');
    this.resultModal.classList.remove('hidden');

    const sdk = window.GameSDK;
    if (sdk) {
      if (win && sdk.trackWin) sdk.trackWin({ score: result.score, kills: result.kills, time: Math.round(result.time) });
      if (!win && sdk.trackFail) sdk.trackFail({ score: result.score, kills: result.kills, time: Math.round(result.time) });
    }
  }

  async revive() {
    if (this.reviving) return;
    this.reviving = true;
    let ok = true;
    if (ads.enabled) {
      const res = await ads.showRewarded('revive');
      ok = !!(res && res.ok);
      if (!ok) this.toast('toast.adsOff', 'warn');
    }
    if (ok) {
      this.reviveUsed = true;
      this.resultModal.classList.add('hidden');
      this.game.revive();
      this.syncTutorial(this.game.tutorial);
      this.tips.classList.remove('fade');
      const sdk = window.GameSDK;
      if (sdk && sdk.trackCustom) sdk.trackCustom('revive', { via: ads.enabled ? 'ad' : 'free' });
    }
    this.reviving = false;
  }

  /* ============================================================ 教学 */
  buildTutorial() {
    this.tut = node('div', 'tut hidden');
    this.tut.innerHTML = `
      <div class="tut-card">
        <div class="tut-demo" data-demo></div>
        <div class="tut-info">
          <div class="tut-kicker" data-kicker></div>
          <div class="tut-title" data-title></div>
          <div class="tut-text" data-text></div>
          <div class="tut-gate" data-gate></div>
          <div class="tut-foot">
            <div class="tut-progress" data-dots></div>
            <button class="tut-btn" data-skip>${t('tutorial.skip')}</button>
          </div>
        </div>
      </div>
    `;
    this.root.appendChild(this.tut);
    this.tutDemo = this.tut.querySelector('[data-demo]');
    this.tutKicker = this.tut.querySelector('[data-kicker]');
    this.tutTitle = this.tut.querySelector('[data-title]');
    this.tutText = this.tut.querySelector('[data-text]');
    this.tutGate = this.tut.querySelector('[data-gate]');
    this.tutDots = this.tut.querySelector('[data-dots]');
    this.tutSkip = this.tut.querySelector('[data-skip]');
    this.tutDots.innerHTML = Array.from({ length: this.game.tutorial.total }, () => '<span class="tut-dot"></span>').join('');
    this.tutSkip.addEventListener('click', () => {
      this.game.tutorial.skip();
      this.syncTutorial(this.game.tutorial);
    });
  }

  syncTutorial(tut) {
    if (!tut || !tut.visible) { this.hideTutorial(); return; }
    this.tutorialVisible = true;
    this.tut.classList.remove('hidden');
    if (!this.banner.classList.contains('danger')) this.hideBanner();
    const step = tut.step;
    if (this.tutorialStep !== step.id) {
      this.tutorialStep = step.id;
      this.renderTutorialDemo(step.id);
    }
    this.tutKicker.textContent = `${t('tutorial.title')} · ${t('tutorial.progress', { n: tut.stepIndex + 1, total: tut.total })}`;
    this.tutTitle.textContent = t(step.titleKey);
    this.tutText.textContent = t(step.textKey);
    this.tutGate.textContent = t(step.gateKey);
    this.tutGate.style.visibility = tut.isTipOnly ? 'hidden' : 'visible';
    this.tutSkip.style.visibility = tut.isTipOnly ? 'hidden' : 'visible';
    const dots = [...this.tutDots.children];
    dots.forEach((d, i) => d.classList.toggle('on', i <= tut.stepIndex));
    if (this.hintKey) this.setHint(this.hintKey);
  }

  hideTutorial() {
    this.tutorialVisible = false;
    if (this.tut) this.tut.classList.add('hidden');
  }

  renderTutorialDemo(id) {
    const touch = this.isTouch;
    let html = '';
    if (id === 1) {
      html = touch
        ? `<img class="demo-hand" src="${src('ui_hand')}" alt=""><div class="demo-flash"></div>`
        : `<img class="demo-key" src="${src('ui_key')}" alt=""><div class="demo-flash"></div>`;
      html += `<img class="demo-aim" src="${src('ui_reticle')}" alt="">`;
      html += `<div class="demo-label">${t('tutorial.demo.aim')} · ${t('tutorial.demo.hold')}</div>`;
    } else if (id === 2) {
      html = `
        <div class="demo-move">
          <img class="mv left" src="${src('ui_arrow')}" alt="" style="transform:rotate(180deg)">
          <img class="mv right" src="${src('ui_arrow')}" alt="">
        </div>
        <div class="demo-label">${t('tutorial.demo.move')}</div>`;
    } else if (id === 3) {
      html = touch
        ? `<img class="demo-hand swipe" src="${src('ui_hand')}" alt="">`
        : `<img class="demo-key" src="${src('ui_key')}" alt="">`;
      html += `<div style="position:absolute;left:34%;top:2%;width:32%;height:38%;opacity:.92">
        <img src="${src('ui_arrow')}" alt="" style="width:100%;height:100%;object-fit:contain;transform:rotate(-90deg);filter:drop-shadow(0 3px 4px rgba(0,0,0,.5))">
      </div><div class="demo-label">${t('tutorial.demo.tap')}</div>`;
    } else if (id === 4) {
      html = `
        <div class="demo-orb o1">${icon('pick_ammo')}</div>
        <div class="demo-orb o2">${icon('pick_life')}</div>
        <div class="demo-orb o3">${icon('pick_shield')}</div>
        <div class="demo-label">${t('tutorial.demo.grab')}</div>`;
    } else if (id === 5) {
      html = `
        <div class="demo-orb o1">${icon('fx_ice')}</div>
        <div class="demo-orb o2">${icon('fx_fire')}</div>
        <div class="demo-orb o3">${icon('icon_bolt')}</div>
        <div class="demo-label">${t('tutorial.demo.cast')}</div>`;
    } else if (id === 6) {
      html = `
        <img src="${src('flyer_cowgirl')}" alt="" style="position:absolute;left:8%;top:4%;width:76%;height:68%;object-fit:contain">
        <div class="demo-reticle">${icon('ui_reticle')}</div>
        <div class="demo-label">${t('tutorial.demo.aim')}</div>`;
    } else {
      html = `
        <img src="${src('boss_crowned')}" alt="" style="position:absolute;left:0;top:-2%;width:100%;height:80%;object-fit:contain">
        <div class="demo-reticle">${icon('ui_reticle')}</div>
        <div class="demo-label">${t('tutorial.demo.aim')}</div>`;
    }
    this.tutDemo.innerHTML = html;
  }

  /* ============================================================ 提示 / 横幅 / toast */
  setHint(key) {
    this.hintKey = key;
    let show = !!key;
    if (key && this.tutorialVisible && key !== 'tutorial.hint.boss') show = false;
    if (this.game.state === 'menu' || this.game.state === 'over' || this.game.state === 'victory') show = false;
    this.hintChip.classList.toggle('hidden', !show);
    if (show) this.hintText.textContent = t(key);
  }

  hideHintOnly() {
    this.hintChip.classList.add('hidden');
  }

  showBanner(info) {
    if (!this.hud || this.hud.classList.contains('hidden')) return;
    clearTimeout(this.bannerTimer);
    this.banner.innerHTML = `
      <div class="banner-kicker">${info.kicker || t('stage.banner', { n: info.n || 1 })}</div>
      <div class="banner-title">${info.title || t(info.nameKey)}</div>
      <div class="banner-sub">${info.sub || t(info.subKey || '')}</div>
    `;
    this.banner.classList.toggle('danger', !!info.danger || info.kind === 'boss');
    this.banner.classList.remove('hidden');
    this.banner.style.animation = 'none';
    void this.banner.offsetWidth;
    this.banner.style.animation = '';
    this.bannerTimer = setTimeout(() => this.banner.classList.add('hidden'), 2600);
  }

  hideBanner() {
    clearTimeout(this.bannerTimer);
    if (this.banner) this.banner.classList.add('hidden');
  }

  onBossStart() {
    this.showBanner({
      kicker: t('stage.danger'),
      title: t('stage.boss'),
      sub: t(GAME_CONFIG.boss.nameKey),
      danger: true,
    });
  }

  buildBanner() {
    this.banner = node('div', 'banner hidden');
    this.root.appendChild(this.banner);
  }

  buildToasts() {
    this.toasts = node('div', 'toasts');
    this.root.appendChild(this.toasts);
  }

  toast(key, tone = 'info') {
    const msg = t(key);
    if (!msg) return;
    const el = node('div', `toast ${tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : ''}`, msg);
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild.remove();
    setTimeout(() => el.remove(), 2200);
  }

  /* ============================================================ 通用弹窗 */
  closeAllModals() {
    for (const m of this.root.querySelectorAll('.modal')) m.classList.add('hidden');
    this.shareReturn = null;
  }

  isModalOpen(id) {
    const m = document.getElementById(id);
    return !!(m && !m.classList.contains('hidden'));
  }

  captureSnapshot() {
    const source = this.game.snapshot();
    const c = document.createElement('canvas');
    c.width = source.width;
    c.height = source.height;
    const g = c.getContext('2d');
    try { g.drawImage(source, 0, 0); } catch (e) { /* 忽略 */ }
    return c;
  }

  /* ============================================================ 输入 */
  wireKeyboard() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.code === 'Escape') {
        if (this.isModalOpen('modalConfirm')) { this.confirmModal.classList.add('hidden'); return; }
        if (this.isModalOpen('modalShare')) { this.closeShare(); return; }
        if (this.isModalOpen('modalBestiary')) { this.bestiaryModal.classList.add('hidden'); return; }
        if (this.isModalOpen('modalSettings')) { this.closeSettings(); return; }
        if (this.isModalOpen('modalPause')) { this.resume(); return; }
        if (this.game.state === 'playing') this.pause();
        return;
      }
      if (typing) return;
      if (e.code === 'KeyP') {
        if (!e.repeat) {
          if (this.isModalOpen('modalPause')) this.resume();
          else if (this.game.state === 'paused') this.resume();
          else this.pause();
        }
        return;
      }
      if (this.game.state !== 'playing') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.game.setFire(true);
        return;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) this.game.requestJump();
        return;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        this.game.setMove('left', true);
        return;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        this.game.setMove('right', true);
        return;
      }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        if (!e.repeat) this.game.castSkill(Number(e.code.slice(-1)) - 1);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.game.setFire(false);
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.game.setMove('left', false);
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.game.setMove('right', false);
    });

    window.addEventListener('blur', () => this.game.clearInput());
  }

  /** 鼠标 / 触屏直接瞄准战场；桌面左键按住也能开火 */
  wireAim() {
    const canvas = this.game.canvas;
    const toWorld = (e) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        x: ((e.clientX - r.left) / r.width) * GAME_CONFIG.meta.width,
        y: ((e.clientY - r.top) / r.height) * GAME_CONFIG.meta.height,
      };
    };
    let mouseFiring = false;
    const stopMouseFire = () => {
      if (!mouseFiring) return;
      mouseFiring = false;
      this.game.setFire(false);
    };

    canvas.addEventListener('pointermove', (e) => {
      if (this.game.state !== 'playing') return;
      const p = toWorld(e);
      if (p) this.game.setAim(p.x, p.y);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (this.game.state !== 'playing') return;
      const p = toWorld(e);
      if (!p) return;
      this.game.setAim(p.x, p.y);
      if (e.pointerType === 'mouse' && e.button === 0) {
        e.preventDefault();
        mouseFiring = true;
        this.game.setFire(true);
      }
    });
    window.addEventListener('pointerup', stopMouseFire);
    window.addEventListener('pointercancel', stopMouseFire);
    window.addEventListener('blur', stopMouseFire);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  wirePointer() {
    const stopFire = () => {
      this.game.setFire(false);
      this.fireBtn.classList.remove('held');
    };
    this.fireBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.fireBtn.classList.add('held');
      if (this.fireBtn.setPointerCapture) {
        try { this.fireBtn.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      }
      this.game.setFire(true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => {
      this.fireBtn.addEventListener(ev, stopFire);
    });
    this.jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.jumpBtn.classList.add('held');
      this.game.requestJump();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
      this.jumpBtn.addEventListener(ev, () => this.jumpBtn.classList.remove('held'));
    });

    const wireMove = (btn, dir) => {
      const stop = () => {
        this.game.setMove(dir, false);
        btn.classList.remove('held');
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.classList.add('held');
        if (btn.setPointerCapture) {
          try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
        }
        this.game.setMove(dir, true);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
    };
    wireMove(this.moveLeftBtn, 'left');
    wireMove(this.moveRightBtn, 'right');

    this.root.addEventListener('click', (e) => {
      if (e.target.closest('button')) audio.play('ui');
    });
    document.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#ui, #stage')) e.preventDefault();
    });
  }
}

export default UI;
