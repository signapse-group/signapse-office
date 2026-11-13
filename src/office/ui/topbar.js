// Phone modal, notifications, the night switch.
import { state } from '../core/state.js';
import { $, replay, small } from '../core/env.js';
import { dn } from '../people/workers.js';
import { night, setNight } from '../world/room-update.js';
import { toast } from './activity.js';
import { closeSession, drM, drS, openSession } from './session-drawer.js';
import { closeMac } from './mac-drawer.js';
import { closePlace, plcState } from '../interact/place-cards.js';
import { popLook, togglePlan, togglePop } from './settings.js';
import { exitFp, fp } from '../interact/first-person.js';
import { closeTimeline } from '../replay/timeline.js';
import { t as tr } from '../../i18n/index.js';

export let bellOn = false;
export function renderBell() { $('btn-bell').setAttribute('aria-pressed', String(bellOn)); }
export function notifyWait(s, e) {
  if (replay.on) return;
  if (!bellOn || document.visibilityState === 'visible' && document.hasFocus()) return;
  try { const n = new Notification(tr('topbar.waitTitle', { name: dn(s) }), { body: e.label || tr('topbar.waitBody'), tag: 'wait-' + s.id }); n.onclick = () => { window.focus(); openSession(s.id); n.close(); }; } catch { /* unsupported */ }
}

export function setup() {
  const app = $('app'), compact = matchMedia('(max-width: 1100px)');
  for (const button of document.querySelectorAll('[data-sidebar]')) {
    const side = button.dataset.sidebar, key = `office-sidebar-${side}`;
    let saved;
    try { saved = localStorage.getItem(key); } catch { /* storage blocked */ }
    const sync = () => {
      const open = saved ? saved === 'open' : side === 'activity' || !compact.matches;
      app.dataset[side] = open ? 'open' : 'closed';
      button.setAttribute('aria-expanded', String(open));
    };
    compact.addEventListener('change', sync);
    button.addEventListener('click', () => {
      saved = app.dataset[side] === 'open' ? 'closed' : 'open';
      try { localStorage.setItem(key, saved); } catch { /* storage blocked */ }
      sync();
    });
    sync();
  }
  /* ---------- phone modal, bell, night, closing ---------- */
  try { bellOn = localStorage.getItem('office-bell') === '1' && Notification.permission === 'granted'; } catch { /* storage blocked */ }
  $('btn-bell').addEventListener('click', async () => {
    if (!bellOn && Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') { toast(tr('topbar.bellBlocked')); return; } }
    bellOn = !bellOn; try { localStorage.setItem('office-bell', bellOn ? '1' : '0'); } catch { /* ignore */ }
    renderBell(); toast(tr(bellOn ? 'topbar.bellOn' : 'topbar.bellOff'));
  });
  $('btn-night').addEventListener('click', () => { state.nightManual = true; setNight(!night); });
  document.addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-close]'); if (!c) return;
    if (c.closest('#dr-session')) closeSession(); else if (c.closest('#dr-mac')) closeMac();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!$('tl').hidden) closeTimeline(); else if (plcState.id) closePlace(); else if (!popLook.hidden) togglePop(false); else if (!$('pop-plan').hidden) togglePlan(false); else if (!drS.hidden) closeSession(); else if (!drM.hidden) closeMac(); else if (fp.on) exitFp();
  });
  $('feed-toggle').addEventListener('click', () => { if (!small.matches) return; const open = $('feed').classList.toggle('feed--open'); $('feed-toggle').setAttribute('aria-expanded', String(open)); });
}
