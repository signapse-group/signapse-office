// The Mac drawer: memory, CPU, dev servers, plan limits, cleanup.
import { state } from '../core/state.js';
import { $, GB, SYMPHONY_DEMO, el, fmtAgo, fmtBytes, hhmm, pad2, replay, small } from '../core/env.js';
import { syncDevBoxes } from '../world/props/dev-servers.js';
import { setLedMood } from '../world/room-update.js';
import { queueUi, toast } from './activity.js';
import { closeSession, drM } from './session-drawer.js';
import { demoMac } from '../demo/demo.js';
import { strandedSection, strandedHolding } from './stranded.js';
import { t as tr, num, locale } from '../../i18n/index.js';

export let macSnap = null;
let confirmKey = null;
let confirmTimer = null;
const busyKeys = new Set();
export function openMac() { if (SYMPHONY_DEMO) return; if (state.selectedId) closeSession(); drM.hidden = false; if (small.matches) $('feed').classList.remove('feed--open'); loadMac(); clearInterval(state.macTimer); state.macTimer = setInterval(pollMac, 5000); }
export function closeMac() { if (SYMPHONY_DEMO) return; drM.hidden = true; clearInterval(state.macTimer); state.macTimer = setInterval(pollMac, 30000); }
// the readings by the clock: not while the tab is hidden (each one has the server list every process; a tab hidden for
// the evening would keep it at it all night); it reads again as soon as the tab shows
export const pollMac = () => { if (document.visibilityState === 'visible') loadMac(); };
// the drawer is rebuilt on every reading: not while a button in it is being pressed, or the click would land on a
// button that no longer exists (the next reading draws it)
let pressing = false;
export function loadMac() {
  if (SYMPHONY_DEMO) return;
  macSnap = demoMac(); renderMacButton(); syncDevBoxes(macSnap);
  if (!drM.hidden && !pressing && !strandedHolding()) renderMac();
}
function level(snap) { return snap.mem.pressure === 'critical' ? 'critical' : snap.tight ? 'warn' : 'normal'; }
export const limitWarned = new Set();
const limitLevel = (pct) => (pct >= 95 ? 'critical' : pct >= 80 ? 'warn' : 'normal');
// 5 hours first, then the week over all models (personal plans), then each model's week, then anything else
// (a model's week: the server labels it "Opus (week)" / "Opus (tuần)"; '7 ngày' is the label older servers saved)
const WIN_ORDER = (w) => (w.key === 'session' ? 0 : w.key === 'weekly' ? 1 : /tuần|week/i.test(w.label) ? 2 : 3);
export const liveWindows = () => (state.limits?.windows || [state.limits?.five && { ...state.limits.five, key: 'session', label: tr('mac.plan.fiveHour') }, state.limits?.seven && { ...state.limits.seven, key: 'weekly', label: tr('mac.plan.week') }].filter(Boolean))
  .filter((w) => !w.resetsAt || w.resetsAt > Date.now()).map((w) => (w.key === 'weekly' && w.label === '7 ngày' ? { ...w, label: tr('mac.plan.week') } : w))
  .sort((a, b) => WIN_ORDER(a) - WIN_ORDER(b));
const ORG_PLANS = new Set(['Team', 'Enterprise']);
export function resetText(ts) {
  const d = new Date(ts), now = new Date(), t = hhmm(ts);
  if (d.toDateString() === now.toDateString()) return tr('mac.plan.at', { time: t });
  const days = tr('mac.plan.weekdays', null, 'list');
  return tr('mac.plan.date', { day: days[d.getDay()], d: pad2(d.getDate()), m: pad2(d.getMonth() + 1), time: t });
}
const liveOf = (o) => (o.windows || []).filter((w) => !w.resetsAt || w.resetsAt > Date.now()).sort((a, b) => WIN_ORDER(a) - WIN_ORDER(b));
// the rows a card lists: a model's own week at 0% says nothing (every account has one, "Fable (tuần) 0%"), so it shows once used
const shownOf = (ws) => { const s = ws.filter((w) => WIN_ORDER(w) !== 2 || w.pct >= 1); return s.length ? s : ws; };
const tightest = (ws) => ws.reduce((a, w) => (!a || w.pct > a.pct ? w : a), null);
function limitRow(rows, w) {
  const m = el('span', 'hl-m'), bar = el('span', 'hl-bar'), fill = el('b', limitLevel(w.pct));
  fill.style.width = `${Math.min(100, Math.max(1, w.pct))}%`; bar.append(fill);
  m.append(el('span', null, w.label), bar, el('em', null, `${Math.round(w.pct)}%`));
  rows.append(m, el('small', 'plan-reset', w.resetsAt ? tr('mac.plan.resets', { when: resetText(w.resetsAt) }) : ''));
}
// the other accounts on this Mac (their own config folders): a heading each, then their limits
function renderOthers(rows) {
  for (const o of state.limits?.others || []) {
    const ws = liveOf(o), acc = [o.account?.plan, o.account?.org].filter(Boolean).join(' · ');
    const block = acctBlock(o.name, o.label, acc, o.until); rows.append(block);
    if (!ws.length) { block.append(el('small', 'plan-other-note', o.note || tr('mac.plan.loading'))); continue; }
    for (const w of shownOf(ws)) limitRow(block, w);
    // Anthropic not answering for now (it limits how often it's asked): the last reading stays, with when it was read
    if (o.note) block.append(el('small', 'plan-other-note', o.at ? tr('mac.plan.readAt', { time: hhmm(o.at), note: o.note }) : o.note));
  }

}

function acctBlock(slug, label, info, until) {
  const block = el('div', 'acct-block');
  const head = el('div', 'plan-other acct-head');
  const meta = el('span', 'acct-meta', info);
  head.append(el('b', 'acct-name', label || slug || tr('mac.plan.account')), meta);
  if (until > Date.now()) head.append(el('em', 'acct-badge acct-badge--out', tr('mac.plan.out', { when: resetText(until) })));
  block.append(head);
  return block;
}
export function renderLimits() {
  const ws = liveWindows(), box = $('plan-card'), others = state.limits?.others || [], none = !ws.length && !others.length;
  box.classList.toggle('is-empty', none);
  { // the pill shows the tightest limit (5 hours, the week, a model's week), coloured by how close it is
    const pill = $('btn-plan'), top = tightest(ws);
    pill.hidden = false;
    // other accounts: their tightest limit after the main one ("5 h 29% · org2 12%")
    const more = others.map((o) => { const t = tightest(liveOf(o)); return t ? ` · ${o.label || o.name} ${Math.round(t.pct)}%` : ''; }).join('');
    $('plan-mini').textContent = (top ? `${top.key === 'session' ? tr('mac.plan.fiveHour') : top.label} ${Math.round(top.pct)}%` : state.limitsNote ? tr('mac.plan.unread') : tr('mac.plan.reading')) + more;
    $('plan-bar').style.width = `${top ? Math.min(100, Math.max(2, top.pct)) : 0}%`;
    pill.dataset.level = top ? limitLevel(top.pct) : 'normal';
    const hint = tr('mac.plan.hint');   // (it opens on a click: say so, and what is behind it)
    pill.title = top ? tr('mac.plan.pillTitle', { hint, text: `${ws.map((w) => `${w.label} ${Math.round(w.pct)}%`).join(' · ')}${top.resetsAt ? ` · ${tr('mac.plan.labelResets', { label: top.label, when: resetText(top.resetsAt) })}` : ''}` })
      : `${state.limitsNote || tr('mac.plan.title')} ${hint}`;
  }
  const acc = state.limits?.account, accText = acc ? [acc.plan, acc.org].filter(Boolean).join(' · ') : '';
  $('plan-acct').hidden = true;   // (the plan sits in the main account's heading)
  if (none) { $('plan-at').textContent = ''; $('plan-empty').textContent = state.limitsNote || tr('mac.plan.loading'); return; }
  $('plan-at').textContent = state.limits.at ? (Date.now() - state.limits.at < 60e3 ? tr('mac.plan.justUpdated') : tr('time.ago', { time: fmtAgo((Date.now() - state.limits.at) / 1000) })) : '';
  const rows = $('plan-rows'); rows.replaceChildren();
  const mainRows = acctBlock('', state.limits.label, accText, state.limits.until); rows.append(mainRows);
  if (!ws.length) mainRows.append(el('small', 'plan-other-note', state.limitsNote || tr('mac.plan.loading')));
  for (const w of shownOf(ws)) limitRow(mainRows, w);
  // no week over all models: org plans (Team / Enterprise) don't have one; a personal plan that shows none is still being read
  if (ws.length && !ws.some((w) => w.key === 'weekly')) {
    const org = ORG_PLANS.has(acc?.plan), m = el('span', 'hl-m plan-none');
    m.append(el('span', null, tr('mac.plan.week')), el('span', 'plan-none-t', org ? tr('mac.plan.noneOnPlan', { plan: acc.plan }) : tr('mac.plan.unread')), el('em', null, '–'));
    m.title = org ? tr('mac.plan.orgNoWeek') : tr('mac.plan.personalWeekSoon');
    mainRows.append(m, el('small', 'plan-reset', ''));
  }
  renderOthers(rows);
  for (const w of [...ws, ...others.flatMap((o) => liveOf(o).map((x) => ({ ...x, key: `${o.name}:${x.key}`, label: `${o.name} · ${x.label}` })))]) {
    if (w.pct < 80) continue;
    const key = `${w.key}:${w.resetsAt}:${w.pct >= 95 ? 95 : 80}`;
    if (limitWarned.has(key)) continue;
    limitWarned.add(key);
    if (!replay.on) toast(tr('mac.plan.warn', { pct: Math.round(w.pct), label: w.label, reset: w.resetsAt ? tr('mac.plan.warnReset', { when: resetText(w.resetsAt) }) : '' }), 6000);
  }
}
function renderMacButton() {
  const s = macSnap; if (!s?.mem) return;
  const pct = Math.round((s.mem.used / s.mem.total) * 100);
  const lv = level(s);
  $('btn-mac').dataset.level = lv;
  $('mac-mini').replaceChildren(`RAM ${pct}%`, ...(s.mem.swapUsed > GB ? [el('span', 'mp-swap', ` · ${fmtBytes(s.mem.swapUsed)}`)] : []));   // (the swap: dropped on a phone)
  $('ml-ram').style.width = `${pct}%`;
  setLedMood(lv);
  // one place for the machine: the pill (level, RAM) and its panel; a dot when there is something worth cleaning
  const cpu = s.cpu?.percent ?? 0, tip = (s.tips || []).find((t) => t.action);
  $('mac-tip').hidden = !tip;
  $('btn-mac').title = tr('mac.button.title', { text: `RAM ${pct}% · CPU ${cpu}%${tip ? ` · ${tr(tip.disk ? 'mac.button.tipDisk' : 'mac.button.tipRam', { title: tip.title, size: fmtBytes(tip.gain) })}` : ''}` });
  queueUi();
}
function meter(title, big, sub, ratio, lv) {
  const m = el('div', 'meter');
  const top = el('div', 'meter-top'); top.append(el('b', null, title), el('strong', null, big));
  const bar = el('div', 'bar'); bar.dataset.level = lv; const fill = el('i'); fill.style.width = `${Math.min(100, Math.max(2, ratio * 100))}%`; bar.append(fill);
  const s = el('span', null, sub); s.title = sub;
  m.append(top, bar, s); return m;
}
function actionButton(key, verbText, run, opts = {}) {
  const b = el('button', `btn btn--sm${opts.cls ? ` ${opts.cls}` : ''}`, verbText); b.type = 'button'; b.dataset.fk = key;
  if (busyKeys.has(key)) { b.textContent = tr('mac.action.working'); b.disabled = true; return b; }
  if (confirmKey === key) { b.textContent = opts.confirm || tr('mac.action.sure', { verb: verbText }); b.classList.add(opts.force ? 'btn--danger' : 'btn--confirm'); }
  if (opts.disabled) b.disabled = true;
  b.addEventListener('click', () => {
    if (confirmKey !== key) { confirmKey = key; clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { confirmKey = null; renderMac(); }, 4500); renderMac(); return; }
    confirmKey = null; busyKeys.add(key); renderMac();
    run().finally(() => { busyKeys.delete(key); loadMac(); });
  });
  return b;
}
const stubborn = new Map();
async function doAction() { toast(tr('mac.action.demo')); }
function actFor(key, body, verbText, extra = {}) {
  if (stubborn.has(key)) return actionButton(key + ':force', tr(body.action === 'quit' ? 'mac.action.forceQuit' : 'mac.action.forceStop'), () => doAction(key, { ...body, force: true }), { force: true, confirm: tr('mac.action.sureForce') });
  return actionButton(key, verbText, () => doAction(key, body), extra);
}

/* ---------- the drawer ----------
   Top to bottom: the verdict (why the machine is slow, in one sentence, and the one safe thing that helps most), the
   small meters, what else is worth doing, who holds the RAM (one bar, then the sessions and the apps behind it),
   dev servers, disk cleanup. Everything is rebuilt every 5 seconds; the focused button keeps its focus (data-fk). */
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const cmdKey = () => (document.documentElement.dataset.os || 'darwin') === 'darwin' ? '⌘⇧P' : 'Ctrl+Shift+P';
// the session tips: idle longer than the server's rule (shorter when memory is tight)
const idleTips = (s) => { const pids = new Set(s.claude.map((c) => c.pid)); return s.tips.filter((t) => t.action === 'kill' && pids.has(t.target)); };
// a colour per app that stays with it while the page is open (slots in a fixed order, never by rank; a 7th app goes to "other")
const SLOTS = 6, slotOf = new Map();
function slotFor(key, inUse) {
  if (slotOf.has(key)) return slotOf.get(key);
  for (let i = 1; i <= SLOTS; i++) {
    if (inUse.has(i)) continue;
    for (const [k, v] of slotOf) if (v === i) slotOf.delete(k);   // (an app no longer shown gives its colour up)
    slotOf.set(key, i); return i;
  }
  return 0;
}
// who holds the memory: the apps, the Claude sessions as one, the dev servers, the rest (footprints, so swapped and
// compressed memory counts too: the total is more than the RAM)
function holders(s) {
  const claudeApp = s.apps.find((a) => a.name === 'Claude Code');
  const list = s.apps.filter((a) => a.name !== 'Claude Code').map((a) => ({ key: `app:${a.name}`, name: a.name, mem: a.mem }));
  const sess = claudeApp?.mem || s.claude.reduce((a, c) => a + c.mem, 0);
  if (sess) list.push({ key: 'claude', name: tr('mac.held.sessions'), mem: sess });
  const dev = s.devServers.reduce((a, d) => a + d.mem, 0);
  if (dev) list.push({ key: 'dev', name: tr('mac.held.dev'), mem: dev });
  list.sort((a, b) => b.mem - a.mem);
  const total = Math.max(s.held || 0, list.reduce((a, g) => a + g.mem, 0));
  const shown = list.filter((g, i) => i < SLOTS && g.mem >= total * 0.03);
  const inUse = new Set(shown.filter((g) => slotOf.has(g.key)).map((g) => slotOf.get(g.key)));
  for (const g of shown) { g.slot = slotFor(g.key, inUse); inUse.add(g.slot); }
  // in slot order: the first reading puts the biggest first, and after that two apps of about the same size don't
  // swap places every 5 seconds (and neighbours are the colour pairs checked for colour-blind readers)
  shown.sort((a, b) => a.slot - b.slot);
  const rest = total - shown.reduce((a, g) => a + g.mem, 0);
  if (rest > total * 0.01) shown.push({ key: 'other', name: tr('mac.held.other'), mem: rest, slot: 0 });
  return { total, groups: shown };
}
export function verdictKey(s) {
  const swap = s.mem.swapUsed;
  if (s.mem.pressure === 'critical') return swap > GB ? 'critical' : 'squeeze';
  if (s.mem.pressure === 'warn') return swap > GB ? 'swap' : 'squeeze';
  if (swap > 4 * GB) return 'swapLeft';
  if (s.diskTight) return 'disk';
  if (s.cpu.percent > 85) return 'cpu';
  return 'ok';
}
// a sparkline: one series, its own scale, a point per minute; hovering a minute names it
function spark(label, points, max, fmt, lv) {
  const W = 120, H = 30, box = el('div', 'mspark'); box.dataset.level = lv;
  const head = el('div', 'mspark-head'); head.append(el('span', null, label), el('b', null, fmt(points[points.length - 1].v))); box.append(head);
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${label}: ${points.map((p) => fmt(p.v)).join(', ')}`);
  const t0 = points[0].t, span = Math.max(1, points[points.length - 1].t - t0);
  const xy = points.map((p) => [((p.t - t0) / span) * W, H - 2 - (Math.min(max, p.v) / max) * (H - 4)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const base = document.createElementNS(NS, 'path'); base.setAttribute('d', `M0,${H - 0.5}L${W},${H - 0.5}`); base.setAttribute('class', 'mspark-base'); base.setAttribute('vector-effect', 'non-scaling-stroke');
  const path = document.createElementNS(NS, 'path'); path.setAttribute('d', line); path.setAttribute('class', 'mspark-line'); path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(base, path);
  points.forEach((p, i) => {   // the hover targets: a strip per minute, wider than the line
    const r = document.createElementNS(NS, 'rect'), x0 = i ? (xy[i - 1][0] + xy[i][0]) / 2 : 0, x1 = i < xy.length - 1 ? (xy[i][0] + xy[i + 1][0]) / 2 : W;
    r.setAttribute('x', x0.toFixed(1)); r.setAttribute('y', '0'); r.setAttribute('width', Math.max(1, x1 - x0).toFixed(1)); r.setAttribute('height', String(H)); r.setAttribute('class', 'mspark-hit');
    const tt = document.createElementNS(NS, 'title'); tt.textContent = tr('mac.trend.point', { time: hhmm(p.t), value: fmt(p.v) }); r.append(tt); svg.append(r);
  });
  box.append(svg); return box;
}
function verdictCard(s, lv) {
  const card = el('section', 'verdict'); card.dataset.level = lv;
  const key = verdictKey(s), main = el('div', 'verdict-main');
  const h = el('p', 'verdict-title'); h.append(el('i', 'verdict-dot'), el('span', null, tr(`mac.verdict.${key}`, { swap: fmtBytes(s.mem.swapUsed), free: fmtBytes(s.disk.free), pct: key === 'cpu' ? s.cpu.percent : pct(s.mem.used, s.mem.total) })));
  main.append(h);
  const top = holders(s).groups.filter((g) => g.key !== 'other').sort((a, b) => b.mem - a.mem).slice(0, 3);
  if (key !== 'ok' && key !== 'disk' && top.length) main.append(el('p', 'verdict-who', tr('mac.verdict.who', { list: top.map((g) => `${g.name} ${fmtBytes(g.mem)}`).join(' · ') })));
  // the one safe thing that helps most: close every idle session at once (apps are never quit in bulk)
  const idle = idleTips(s), acts = el('div', 'verdict-acts');
  if (idle.length) {
    const gain = idle.reduce((a, t) => a + t.gain, 0), n = idle.length;
    acts.append(actionButton('closeIdle', tr('mac.verdict.closeIdle', { n, size: fmtBytes(gain) }), () => doAction('closeIdle', { action: 'closeIdle', items: idle.map((t) => ({ target: t.target, start: t.start })) }), { cls: 'btn--primary', confirm: tr('mac.verdict.closeIdleSure', { n }) }));
    main.append(acts, el('p', 'verdict-note', tr('mac.verdict.idleNote', { time: fmtAgo(s.rules?.sessionIdle || 7200) })));
  } else if (lv !== 'normal' && key !== 'swapLeft' && key !== 'disk') main.append(el('p', 'verdict-note', tr('mac.verdict.appsNote')));
  if (s.diskTight) {
    const go = el('button', 'btn btn--sm', tr('mac.verdict.diskGo')); go.type = 'button'; go.dataset.fk = 'diskGo';
    go.addEventListener('click', () => $('mac-disk')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    acts.append(go); if (!acts.parentNode) main.append(acts);
  }
  card.append(main);
  // the last half hour, RAM and swap each on its own little chart
  const tr0 = (s.trend || []).filter((p) => p.t > Date.now() - 31 * 60e3);
  const side = el('div', 'verdict-trend'); side.append(el('small', null, tr('mac.trend.title')));
  if (tr0.length >= 2) {
    side.append(spark(tr('mac.trend.ram'), tr0.map((p) => ({ t: p.t, v: pct(p.used, p.total) })), 100, (v) => `${v}%`, lv),
      spark(tr('mac.trend.swap'), tr0.map((p) => ({ t: p.t, v: p.swap })), Math.max(s.mem.swapTotal || 0, ...tr0.map((p) => p.swap), GB), (v) => fmtBytes(v), s.mem.swapUsed > 8 * GB ? 'critical' : s.mem.swapUsed > 2 * GB ? 'warn' : 'normal'));
  } else side.append(el('span', 'muted', tr('mac.trend.wait')));
  card.append(side);
  return card;
}
function heldBar(s) {
  const { total, groups } = holders(s), sec = el('section', 'sec held');
  const h = el('h3', null, tr('mac.held.title')); h.append(el('small', null, tr('mac.held.total', { size: fmtBytes(total) }))); sec.append(h);
  const bar = el('div', 'held-bar'); bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `${tr('mac.held.chart')}: ${groups.map((g) => `${g.name} ${fmtBytes(g.mem)}`).join(', ')}`);
  const legend = el('ul', 'held-legend');
  for (const g of groups) {
    const seg = el('i'); seg.dataset.slot = g.slot; seg.style.flexGrow = String(g.mem); seg.title = `${g.name} · ${fmtBytes(g.mem)}`; bar.append(seg);
    const li = el('li'); const dot = el('i'); dot.dataset.slot = g.slot; li.append(dot, el('span', null, g.name), el('b', null, fmtBytes(g.mem))); legend.append(li);
  }
  sec.append(bar, legend);
  return sec;
}
function ideCard(a, ide) {
  const li = el('li', 'row row--ide'); const main = el('div', 'row-main');
  main.append(el('div', 'row-name', a.name), el('div', 'row-sub', ide.chats ? tr('mac.ide.summary', { windows: ide.windows, chats: ide.chats, idle: ide.idleChats, n: ide.chats }) : tr('mac.ide.summaryNoChat', { windows: ide.windows })));
  li.append(main, el('span', 'row-num', fmtBytes(a.mem)), el('span', 'muted', tr('mac.apps.kept')));
  // what the editor's memory is made of
  const parts = el('ul', 'ide-parts');
  for (const [k, v, words] of [['ui', ide.ui.mem, tr('mac.ide.ui')], ['ts', ide.ts.mem, tr('mac.ide.ts', { n: ide.ts.n })], ['ext', ide.ext.mem, tr('mac.ide.ext', { n: ide.ext.n })], ['other', ide.other, tr('mac.ide.other')]]) {
    if (v < 50 * 1024 ** 2) continue;
    const p = el('li'); p.dataset.part = k; const b = el('span', 'ide-bar'); const f = el('i'); f.style.width = `${Math.max(2, (v / ide.mem) * 100)}%`; b.append(f);
    p.append(el('span', null, words), b, el('b', null, fmtBytes(v))); parts.append(p);
  }
  const fixes = el('ul', 'ide-fixes'), cmd = cmdKey();
  if (ide.idleChats) fixes.append(el('li', null, tr('mac.ide.fixChats', { n: ide.idleChats })));
  if (ide.windows > 1) fixes.append(el('li', null, tr('mac.ide.fixWindows', { size: fmtBytes((ide.ui.mem + ide.ts.mem + ide.ext.mem) / ide.windows) })));
  if (ide.ts.mem > 500 * 1024 ** 2) fixes.append(el('li', null, tr('mac.ide.fixTs', { cmd, size: fmtBytes(ide.ts.mem) })));
  fixes.append(el('li', null, tr('mac.ide.fixReload', { cmd })));
  const more = el('div', 'ide-more'); more.append(parts, el('p', 'ide-fix-title', tr('mac.ide.fixTitle')), fixes);
  li.append(more);
  return li;
}
function autoClose(s) {
  const box = el('div', 'auto-close'), cur = s.auto?.hours ?? 0;
  const row = el('div', 'auto-row'); row.append(el('span', 'auto-label', tr('mac.auto.label')));
  const seg = el('div', 'ac-seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', tr('mac.auto.label'));
  for (const h of [0, 2, 4, 8]) {
    const b = el('button', 'ac-seg-b', h ? tr('mac.auto.hours', { n: h }) : tr('mac.auto.off')); b.type = 'button'; b.dataset.fk = `auto:${h}`;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(h === cur));
    b.addEventListener('click', () => setAutoClose(h));
    seg.append(b);
  }
  row.append(seg); box.append(row, el('p', 'auto-note', tr('mac.auto.note')));
  if (s.auto?.last) box.append(el('p', 'auto-note', tr('mac.auto.last', { time: hhmm(s.auto.last.at), names: s.auto.last.names })));
  return box;
}
function setAutoClose(hours) {
  macSnap.auto.hours = hours;
  renderMac();
  toast(hours ? tr('mac.auto.saved', { n: hours }) : tr('mac.auto.savedOff'));
}
// when a session's process started: the time today, the day too before that
function opened(ms) {
  const d = new Date(ms), today = new Date().toDateString() === d.toDateString();
  return today ? tr('mac.claude.opened', { time: hhmm(ms) }) : tr('mac.claude.openedDay', { day: d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' }), time: hhmm(ms) });
}
export function renderMac() {
  const s = macSnap; const body = $('mac-body');
  if (!s?.mem) { body.replaceChildren(el('p', 'muted', tr('mac.measuring'))); return; }
  $('mac-at').textContent = tr('mac.updated', { time: hhmm(s.at, true) });
  const keepScroll = body.scrollTop, focusKey = body.contains(document.activeElement) ? document.activeElement.dataset?.fk : null;
  const frag = document.createDocumentFragment();
  const lv = level(s);
  frag.append(verdictCard(s, lv));

  const meters = el('div', 'meters');
  const pressureText = ['normal', 'warn', 'critical'].includes(s.mem.pressure) ? tr(`mac.meter.pressure.${s.mem.pressure}`) : '';
  meters.append(
    meter('RAM', `${pct(s.mem.used, s.mem.total)}%`, tr('mac.meter.ramSub', { used: fmtBytes(s.mem.used), total: fmtBytes(s.mem.total), pressure: pressureText }), s.mem.used / s.mem.total, lv),
    meter('Swap', s.mem.swapTotal ? fmtBytes(s.mem.swapUsed) : '0', s.mem.swapTotal ? tr('mac.meter.swapSub', { size: fmtBytes(s.mem.swapTotal) }) : tr('mac.meter.swapNone'), s.mem.swapTotal ? s.mem.swapUsed / s.mem.swapTotal : 0, s.mem.swapUsed > 8 * GB ? 'critical' : s.mem.swapUsed > 2 * GB ? 'warn' : 'normal'),
    meter('CPU', `${s.cpu.percent}%`, tr('mac.meter.cpuSub', { n: s.cpu.cores, load: num(s.cpu.load, 1) }), s.cpu.percent / 100, s.cpu.percent > 85 ? 'critical' : s.cpu.percent > 60 ? 'warn' : 'normal'),
    meter(tr('mac.meter.disk'), `${pct(s.disk.used, s.disk.total)}%`, tr('mac.meter.diskSub', { free: fmtBytes(s.disk.free), total: fmtBytes(s.disk.total) }), s.disk.used / s.disk.total, s.diskTight ? 'warn' : 'normal'),
  );
  for (const w of liveWindows()) meters.append(meter(tr('mac.meter.plan', { label: w.label }), `${Math.round(w.pct)}%`, w.resetsAt ? tr('mac.plan.resets', { when: resetText(w.resetsAt) }) : tr('mac.meter.planSub'), w.pct / 100, limitLevel(w.pct)));
  frag.append(meters);

  // anything else worth doing: dev servers left behind, a process that keeps growing, test browsers (the sessions,
  // the apps and the disk have their own places below)
  const idle = idleTips(s), idleIds = new Set(idle.map((t) => t.id));
  const more = s.tips.filter((t) => !t.disk && !idleIds.has(t.id) && t.action !== 'quit' && t.id !== 'info:ide');
  if (more.length) {
    const sec = el('section', 'sec'); sec.append(el('h3', null, tr('mac.group.more')));
    const tl = el('ul', 'tips');
    for (const t of more) {
      const li = el('li', 'tip'); li.dataset.level = t.level;
      li.append(el('span', 'tip-title', t.title), el('span', 'tip-detail', t.detail));
      const actBox = el('div', 'tip-act');
      if (t.action) actBox.append(el('span', 'gain', tr('mac.tips.gainRam', { size: fmtBytes(t.gain) })), actFor(t.id, { action: t.action, target: t.target, start: t.start }, t.verb));
      li.append(actBox); tl.append(li);
    }
    sec.append(tl); frag.append(sec);
  }

  // who holds the RAM: one bar, then the Claude sessions and the apps behind it
  const held = heldBar(s);
  const gS = el('div', 'held-group'), sh = el('h4', null, tr('mac.group.sessions')); sh.append(el('small', null, tr('mac.claude.hint'))); gS.append(sh);
  const cl = el('ul', 'rows');
  for (const c of s.claude) {
    // the conversation's title (its folder's name until Claude Code gives it one), then where and since when it runs
    const li = el('li', 'row'); const main = el('div', 'row-main');
    const name = el('div', 'row-name', (c.title || c.name) + (c.remote ? ' 📱' : ''));
    if (c.you) { li.classList.add('row--you'); name.append(el('span', 'row-badge row-badge--you', tr('mac.claude.you'))); }
    else if (idleIds.has(`kill:${c.pid}`)) { li.classList.add('row--suggest'); name.append(el('span', 'row-badge', tr('mac.group.suggest'))); }
    const doing = [c.busy ? tr('mac.claude.busy') : tr('mac.claude.idle', { time: fmtAgo(c.idle) })];
    if (c.agents) doing.push(tr('mac.claude.agents', { n: c.agents }));
    main.append(name, el('div', 'row-sub', [c.app, c.start && opened(c.start * 1000), c.dir].filter(Boolean).join(' · ')), el('div', 'row-sub', doing.join(' · ')));
    li.append(main, el('span', 'row-num', fmtBytes(c.mem)), actFor(`kill:${c.pid}`, { action: 'kill', target: c.pid, start: c.start }, tr('common.close'), { disabled: c.busy }));
    cl.append(li);
  }
  gS.append(cl, autoClose(s));
  const gA = el('div', 'held-group'); gA.append(el('h4', null, tr('mac.group.apps')));
  const al = el('ul', 'rows');
  for (const a of s.apps.slice(0, 6)) {
    if (s.ide && a.name === s.ide.name) { al.append(ideCard(a, s.ide)); continue; }
    const li = el('li', 'row'); const main = el('div', 'row-main');
    main.append(el('div', 'row-name', a.name), el('div', 'row-sub', tr('mac.apps.procs', { n: a.count, cpu: a.cpu })));
    li.append(main, el('span', 'row-num', fmtBytes(a.mem)), a.quit ? actFor(`quit:${a.name}`, { action: 'quit', target: a.name }, tr('mac.verb.quit')) : el('span', 'muted', a.name === 'Claude Code' ? tr('mac.apps.closeAbove') : tr('mac.apps.kept')));
    al.append(li);
  }
  gA.append(al); held.append(gS, gA); frag.append(held);

  const devSec = el('section', 'sec'); devSec.append(el('h3', null, tr('mac.dev.title')));
  const dl = el('ul', 'rows');
  if (!s.devServers.length) dl.append(el('li', 'muted', tr('mac.dev.none')));
  for (const d of s.devServers) {
    const li = el('li', 'row'); const main = el('div', 'row-main');
    const who = d.owner ? tr(d.owner.alive ? 'mac.dev.ownerAlive' : 'mac.dev.ownerLeft', { name: d.owner.name }) : tr('mac.dev.ownerNone');
    main.append(el('div', 'row-name', tr('mac.dev.name', { label: d.label, ports: d.ports.join(', '), n: d.ports.length })), el('div', 'row-sub', tr('mac.dev.up', { dir: d.dir || '—', time: fmtAgo(d.up) })),
      el('div', 'row-owner' + (d.owner && !d.owner.alive ? ' row-owner--left' : d.owner ? '' : ' row-owner--none'), who));
    if (d.conns != null) main.append(el('div', 'row-use' + (d.conns ? ' row-use--on' : ''), d.conns ? tr('mac.dev.inUse', { n: d.conns }) : d.idle >= d.watched - 30 ? tr('mac.dev.notYet', { time: fmtAgo(d.watched) }) : tr('mac.dev.unused', { time: fmtAgo(d.idle) })));
    li.append(main, el('span', 'row-num', `${fmtBytes(d.mem)} · CPU ${d.cpu}%`), actFor(`kill:${d.pid}`, { action: 'kill', target: d.pid, start: d.start }, tr('mac.verb.stop')));
    dl.append(li);
  }
  devSec.append(dl); frag.append(devSec);
  frag.append(strandedSection());   // work left in the repositories' worktrees (stranded.js)

  const kSec = el('section', 'sec'); kSec.id = 'mac-disk'; const kh = el('h3', null, tr('mac.disk.title'));
  kh.append(el('small', null, s.cleanupsAt ? tr('mac.disk.measuredAt', { time: hhmm(s.cleanupsAt) }) : tr('mac.disk.measuring'))); kSec.append(kh);
  const kl = el('ul', 'rows');
  if (!s.cleanups.length) kl.append(el('li', 'muted', s.cleanupsAt ? tr('mac.disk.none') : tr('mac.disk.wait')));
  for (const c of s.cleanups) {
    const li = el('li', 'row'); const main = el('div', 'row-main');
    main.append(el('div', 'row-name', c.title), el('div', 'row-sub', c.note));
    li.append(main, el('span', 'row-num', fmtBytes(c.size)), actFor(`clean:${c.id}`, { action: 'clean', target: c.id }, tr('mac.verb.clean')));
    kl.append(li);
  }
  kSec.append(kl); frag.append(kSec);

  body.replaceChildren(frag);
  body.scrollTop = keepScroll;
  if (focusKey) body.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

export function setup() {
  if (SYMPHONY_DEMO) return;
  /* ---------- Mac drawer ---------- */
  state.macTimer = null;
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadMac(); });
  /* plan usage (5-hour / 7-day windows) from Claude Code's status line */
  state.limits = null; state.limitsNote = '';
  setInterval(renderLimits, 30000);
  $('btn-mac').addEventListener('click', () => (drM.hidden ? openMac() : closeMac()));
  $('mac-refresh').addEventListener('click', loadMac);
  $('mac-body').addEventListener('pointerdown', () => { pressing = true; });
  addEventListener('pointerup', () => { pressing = false; }); addEventListener('pointercancel', () => { pressing = false; });
}
