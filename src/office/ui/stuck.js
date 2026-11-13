// Stuck sessions ("Ngắt vòng lặp kẹt", server/loops.mjs): the card in the group chat (what repeats, Stop, a hint for
// Claude) and the row in Settings → More (on or off, after how many failures, after how many minutes of spending with
// nothing edited). The person's red "kẹt" tag is people/workers.js (setStuck), the line in the list ui/activity.js.
import { el, short } from '../core/env.js';
import { sessions, dn } from '../people/workers.js';
import { t as tr } from '../../i18n/index.js';

/** The card for a 'loop' message: redraw() draws it again (the chat window's own). */
export function loopCard(m) {
  const L = m.loop || {}, s = sessions.get(L.sess), name = (s && dn(s)) || m.name || '';
  const live = L.state === 'on' || L.state === 'stopping';
  const box = el('div', `zc-loop is-${L.state || 'on'}`), head = el('div', 'zc-loop-h');
  head.append(el('i', 'zc-loop-ic', L.state === 'stopped' ? '⏹' : live ? '⛔' : '✓'), el('b', null, tr('chat.loop.title')));
  // the line, with the command that repeats set as code
  const usd = L.usd != null ? `$${Number(L.usd).toFixed(2)}` : '', line = el('p', 'zc-loop-t');
  const [before, after = ''] = tr(`chat.loop.${L.kind || 'repeat'}`, { name, label: '\u0000', n: L.n || 0, next: (L.n || 0) + (L.blocked || 0), mins: L.mins || 0, usd }).split('\u0000');
  line.append(before); if (L.kind === 'repeat') line.append(el('code', null, short(L.label || '', 60)), after);
  box.append(head, line);
  const note = L.state === 'stopping' ? tr('chat.loop.stopping') : L.state === 'stopped' ? tr('chat.loop.stopped') : L.state === 'over' ? tr(`chat.loop.over.${L.why || 'end'}`) : '';
  if (note) box.append(el('small', 'zc-loop-note', note));
  if (L.hint) box.append(el('small', `zc-loop-hint is-${L.hint}`, tr({ sent: 'chat.loop.hintSent', got: 'chat.loop.hintGot', lost: 'chat.loop.hintLost', rest: 'chat.loop.hintRest' }[L.hint] || 'chat.loop.hintSent')));
  return box;
}
/** One line for the chat's small preview while its window is shut. */
export function loopPeek(m) {
  const L = m.loop || {};
  return `⛔ ${tr(`chat.loop.${L.kind || 'repeat'}`, { name: m.name || '', label: `“${short(L.label || '', 40)}”`, n: L.n || 0, next: (L.n || 0) + (L.blocked || 0), mins: L.mins || 0, usd: L.usd != null ? `$${Number(L.usd).toFixed(2)}` : '' })}`;
}

