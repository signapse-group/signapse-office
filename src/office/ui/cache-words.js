// How a session's prompt cache reads on screen ("Đồng hồ bộ nhớ đệm", src/shared/cache-clock.js; the cups on the desks
// are world/props/cups.js): the line under the session drawer's folder, the one under the chat's "Gửi tới" and in its
// list of conversations, and the switch in Settings → More for the "about to go cold" notification.
import { $, nowMs } from '../core/env.js';
import { state } from '../core/state.js';
import { sessions } from '../people/workers.js';
import { cacheClock } from '../../shared/cache-clock.js';
import { t as tr, num } from '../../i18n/index.js';

const mins = (ms) => Math.max(1, Math.round(ms / 60e3));
const tok = (n) => (n >= 1e6 ? `${num(n / 1e6, 1)}M` : `${Math.max(1, Math.round(n / 1000))}k`);
/** cache (a session's, from the server) -> { state: 'warm' | 'cold' | 'none', text } in the words of `kind`: 'drawer'
    ("Bộ nhớ đệm còn ấm ~23 phút"), 'chat' ("còn ấm ~23 phút · nhắn tiếp rẻ"), or 'chatShort' (a phone's: "☕ còn ấm 23 phút"). */
export function cacheWords(cache, kind = 'drawer') {
  const k = cacheClock(cache, nowMs());
  if (k.state === 'none') return { state: 'none', text: '' };
  const tokens = tok(k.tokens);
  let text;
  if (kind === 'chatShort') text = k.state === 'warm' ? tr('chat.to.cacheWarmShort', { n: mins(k.left) }) : tr('chat.to.cacheColdShort', { tokens });
  else if (kind === 'chat') text = k.state === 'warm' ? tr('chat.to.cacheWarm', { n: mins(k.left) }) : tr(k.tokens ? 'chat.to.cacheCold' : 'chat.to.cacheColdNoSize', { tokens });
  else text = `${k.state === 'warm' ? tr('drawer.cache.warm', { n: mins(k.left) }) : tr(k.tokens ? 'drawer.cache.cold' : 'drawer.cache.coldNoSize', { tokens })}${k.guessed ? ` ${tr('drawer.cache.guessed')}` : ''}`;
  return { state: k.state, text };
}
/** The session drawer's line (session-drawer.js draws the rest of its head). */
export function drawDrawerCache() {
  const p = $('ds-cache'); if (!p) return;
  const s = sessions.get(state.selectedId), w = s ? cacheWords(s.cache) : { state: 'none', text: '' };
  p.hidden = !w.text; p.dataset.state = w.state;
  if (p.textContent !== w.text) p.textContent = w.text;
}

export function setup() {
  setInterval(() => { if (!$('dr-session').hidden) drawDrawerCache(); }, 20_000);
}
