/**
 * 社媒分享
 * ------------------------------------------------------------------
 * ① 移动端：navigator.share 系统面板（可带分享卡图片）；
 * ② 桌面端：打开各平台官方分享 URL；
 * ③ TikTok / Instagram / YouTube 没有网页分享接口：生成分享卡 PNG
 *    （实时画面 + 昵称 + Logo + pipygames.com + 二维码）+ 复制链接。
 * 每次分享通过 SDK 打点（平台 + 结果）。
 */
import { t } from './i18n.js';
import { assets } from './assets.js';
import { drawQR } from './qrcode.js';

export const SITE_HOST = 'pipygames.com';
export const SITE_URL = 'https://pipygames.com/';

export const PLATFORMS = [
  { id: 'facebook', nameKey: 'share.platform.facebook', color: '#1877f2' },
  { id: 'x', nameKey: 'share.platform.x', color: '#101014' },
  { id: 'reddit', nameKey: 'share.platform.reddit', color: '#ff4500' },
  { id: 'whatsapp', nameKey: 'share.platform.whatsapp', color: '#25d366' },
  { id: 'telegram', nameKey: 'share.platform.telegram', color: '#229ed9' },
  { id: 'linkedin', nameKey: 'share.platform.linkedin', color: '#0a66c2' },
  { id: 'tiktok', nameKey: 'share.platform.tiktok', color: '#0b0b0f' },
  { id: 'instagram', nameKey: 'share.platform.instagram', color: '#e1306c' },
  { id: 'youtube', nameKey: 'share.platform.youtube', color: '#ff2d2d' },
];

const CARD_ONLY = new Set(['tiktok', 'instagram', 'youtube']);

function track(payload) {
  const sdk = window.GameSDK;
  if (sdk && sdk.trackCustom) sdk.trackCustom('share', payload);
}

export function shareUrlFor(id, url, text) {
  const u = encodeURIComponent(url);
  const x = encodeURIComponent(text);
  switch (id) {
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'x': return `https://twitter.com/intent/tweet?url=${u}&text=${x}`;
    case 'reddit': return `https://www.reddit.com/submit?url=${u}&title=${x}`;
    case 'whatsapp': return `https://api.whatsapp.com/send?text=${x}%20${u}`;
    case 'telegram': return `https://t.me/share/url?url=${u}&text=${x}`;
    case 'linkedin': return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    default: return null;
  }
}

export function sharePageUrl() {
  // 本地调试时也只分享正式站点地址，避免把 localhost 发到社交平台
  return SITE_URL;
}

function inviteName(nickname) {
  return (nickname || '').trim() || t('share.anon');
}

function buildText(nickname, score) {
  const name = `@${inviteName(nickname)}`;
  const base = t('share.inviteText', { name });
  return score > 0 ? `${base} — ${t('share.scoreLine', { score: Math.round(score) })}` : base;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

class ShareManager {
  isMobile() {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  async share({ platform = 'native', target = '', snapshot = null, file = null, score = 0, nickname = '' } = {}) {
    const text = buildText(nickname, score);
    const url = sharePageUrl();
    const tag = target || platform;
    track({ platform: tag, mode: platform, score, result: 'start' });

    // ① 移动端系统分享
    if (this.isMobile() && navigator.share && platform === 'native') {
      try {
        const payload = { title: t('meta.title'), text, url };
        const ready = file || (snapshot ? await this.fileFromCanvas(await this.buildCard(snapshot, score, nickname)) : null);
        if (ready && navigator.canShare && navigator.canShare({ files: [ready] })) payload.files = [ready];
        await navigator.share(payload);
        track({ platform: tag, mode: 'native', score, result: 'ok' });
        return { ok: true, mode: 'native' };
      } catch (e) {
        if (e && e.name === 'AbortError') {
          track({ platform: tag, mode: 'native', result: 'cancel' });
          return { ok: false, cancel: true, mode: 'native' };
        }
      }
    }

    // ② 只能发图的平台：生成卡片 + 复制链接
    if (CARD_ONLY.has(platform)) {
      const saved = await this.downloadCard(await this.buildCard(snapshot, score, nickname), platform);
      const copied = await this.copyLink();
      track({ platform: tag, mode: 'card', score, result: saved ? 'card' : 'card-fail' });
      return { ok: saved, mode: 'card', copied };
    }

    // ③ 桌面端官方分享 URL
    const href = shareUrlFor(platform, url, text);
    if (href) {
      window.open(href, '_blank', 'noopener,width=720,height=620');
      track({ platform: tag, mode: 'intent', score, result: 'intent' });
      return { ok: true, mode: 'intent' };
    }
    track({ platform: tag, mode: 'none', score, result: 'none' });
    return { ok: false, mode: 'none' };
  }

  canvasToBlob(canvas) {
    if (!canvas) return Promise.resolve(null);
    return new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
  }

  async fileFromCanvas(canvas) {
    if (typeof File === 'undefined') return null;
    const blob = await this.canvasToBlob(canvas);
    return blob ? new File([blob], 'ranger-vs-zombies.png', { type: 'image/png' }) : null;
  }

  /** 1080x1080 分享卡：荒漠背景 + 实机截图 + 分数 + Logo + 站点 + 二维码 */
  async buildCard(snapshot, score = 0, nickname = '') {
    const W = 1080, H = 1080;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    const bg = assets.get('bg_share');
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      const dw = bg.width * s, dh = bg.height * s;
      g.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#f0a24e');
      grad.addColorStop(1, '#7c3f1f');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    // 暖色渐层 + 暗角，保证文字与按钮清晰
    const wash = g.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(30, 16, 6, 0.38)');
    wash.addColorStop(0.42, 'rgba(30, 16, 6, 0.10)');
    wash.addColorStop(1, 'rgba(24, 12, 4, 0.78)');
    g.fillStyle = wash;
    g.fillRect(0, 0, W, H);

    // Logo
    const logo = assets.get('logo');
    if (logo) {
      const lw = 560;
      const lh = lw * logo.height / logo.width;
      g.drawImage(logo, (W - lw) / 2, 30, lw, lh);
    }

    // 截图框
    const sx = 76, sy = 330, sw = W - 152, sh = sw * 9 / 16;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.55)';
    g.shadowBlur = 34;
    g.shadowOffsetY = 14;
    g.fillStyle = '#2a160a';
    roundRect(g, sx - 12, sy - 12, sw + 24, sh + 24, 26);
    g.fill();
    g.restore();

    g.save();
    roundRect(g, sx, sy, sw, sh, 18);
    g.clip();
    if (snapshot) {
      const sc = Math.max(sw / snapshot.width, sh / snapshot.height);
      const dw = snapshot.width * sc, dh = snapshot.height * sc;
      g.drawImage(snapshot, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
    } else {
      g.fillStyle = '#2b1a0e';
      g.fillRect(sx, sy, sw, sh);
    }
    g.restore();

    // 木质描边的截图框
    g.strokeStyle = 'rgba(255, 226, 168, 0.9)';
    g.lineWidth = 5;
    roundRect(g, sx - 6, sy - 6, sw + 12, sh + 12, 22);
    g.stroke();

    // 分数
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 12;
    g.shadowOffsetY = 5;
    g.fillStyle = '#ffe9a8';
    g.font = '900 96px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.fillText(String(Math.round(score || 0)), W / 2, sy + sh + 118);
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;

    g.fillStyle = 'rgba(255,247,225,0.92)';
    g.font = '700 30px "Arial Rounded MT Bold", "Trebuchet MS", "Microsoft YaHei", sans-serif';
    const name = inviteName(nickname);
    g.fillText(t('share.inviteText', { name: `@${name}` }).slice(0, 68), W / 2, sy + sh + 172);

    // 左下：站点 + 二维码；右下：小字
    const qs = 168;
    drawQR(g, sharePageUrl(), 84, H - qs - 74, 5, { fg: '#2a160a', bg: '#fff8ea', quiet: 2 });
    g.textAlign = 'left';
    g.fillStyle = '#fff8ea';
    g.font = '900 44px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.fillText(SITE_HOST, 84, H - 34);

    g.textAlign = 'right';
    g.fillStyle = 'rgba(255,248,234,0.72)';
    g.font = '700 24px "Arial Rounded MT Bold", "Trebuchet MS", sans-serif';
    g.fillText(t('meta.tagline'), W - 84, H - 34);

    return c;
  }

  async downloadCard(canvas, platform = 'share') {
    try {
      const a = document.createElement('a');
      a.download = `ranger-vs-zombies-${platform}.png`;
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      return true;
    } catch (e) {
      console.warn('[share] 卡片导出失败', e && e.message);
      return false;
    }
  }

  async copyLink() {
    const url = sharePageUrl();
    try {
      await navigator.clipboard.writeText(url);
      track({ result: 'copy', url });
      return true;
    } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        track({ result: 'copy-fallback', url });
        return true;
      } catch (e2) {
        return false;
      }
    }
  }
}

export const share = new ShareManager();
export default share;
