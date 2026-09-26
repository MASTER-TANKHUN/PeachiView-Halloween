// Everyone who speaks goes through here: a subtitle with the speaker's name + their babble voice.
// Before Night 1 is won, Peachi's stream is broken: her lines come through garbled.
import { UI } from '../ui.js';
import { voice } from '../audio.js';

const NAMES = { peachi: 'พีชชี่', bot: 'PeachiBot', her: 'เธอ', me: 'มอด (คุณ)', krasue: 'กระสือ_Official' };
const VOICE = { peachi: 'peachi', bot: 'bot', her: 'whisper', krasue: 'krasue' };
const NOISE = ['▒', '░', '▓', '_', '…'];

/** Break a line like a dropping stream: some clusters turn into noise, some stutter. Stays mostly readable. */
export function garble(text, amount = 0.22) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text)].map((x) => x.segment) : Array.from(text);
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    const r = Math.random();
    if (c === ' ' || /[!?.…]/.test(c)) out += c;
    else if (r < amount * 0.55) out += NOISE[Math.floor(Math.random() * NOISE.length)];
    else if (r < amount * 0.8 && i < seg.length - 1) out += c + '-' + c;
    else out += c;
  }
  return out;
}

const _d = { x: 0, z: 0 };
export const Talk = {
  /** Peachi can't be heard clearly until she gets her headphones back. */
  brokenPeachi: false,
  /** listener: () => ({ x, z, yaw }) for panning voices by where the speaker is */
  listener: null,

  /**
   * who: 'peachi' | 'bot' | 'her' | 'me'. opts: { at: {x, z} speaker position, ms, clean }
   * Returns how long the line stays up (ms).
   */
  say(who, text, opts = {}) {
    if (!text) return 0;
    const broken = who === 'peachi' && this.brokenPeachi && !opts.clean;
    const shown = broken ? garble(text) : text;
    const ms = opts.ms ?? Math.max(2200, 1300 + Array.from(text).length * 60);
    const cls = [who, broken ? 'broken' : ''].filter(Boolean).join(' ');
    UI.subtitle(shown, ms, { name: NAMES[who] ?? who, cls });
    let pan = 0, vol = 1;
    if (opts.at && this.listener) {
      const L = this.listener();
      _d.x = opts.at.x - L.x; _d.z = opts.at.z - L.z;
      const d = Math.hypot(_d.x, _d.z) || 1;
      pan = Math.max(-0.85, Math.min(0.85, (_d.x * Math.cos(L.yaw) - _d.z * Math.sin(L.yaw)) / d));
      vol = Math.max(0.35, 1 / (1 + d * 0.12));
    }
    if (VOICE[who]) voice.speak(text, broken ? 'peachiBroken' : VOICE[who], { pan, vol });
    return ms;
  },
  stop() { voice.stop(); UI.subtitle(null); },
};
