// The session drawer: chat, steps, subagents.
import { state } from '../core/state.js';
import { $, SYMPHONY_DEMO, el, fmtClock, hhmm, nowMs, pad2, reduceMotion, short, small } from '../core/env.js';
import { STATUS_LABEL, verb } from './event-text.js';
import { TYPE_ICON, icon } from './icons.js';
import { BASE_ZOOM } from '../scene/renderer.js';
import { colorOf, dn, sessions, workers } from '../people/workers.js';
import { cap, feedRow, fmtTok, fmtUsd, openFromRow, queueUi, toast } from './activity.js';
import { goView, setView } from './camera-bar.js';
import { closeMac } from './mac-drawer.js';
import { unseenDone } from '../life/your-turn.js';
import { demoLog } from '../demo/demo.js';
import { renderTaskDetails, taskTitle } from '../demo/symphony-task.js';
import { drawDrawerCache } from './cache-words.js';
import { pinsLabel, renderPins } from './pins.js';
import { renderCompose, setupCompose } from './session-compose.js';
import { t as tr, locale } from '../../i18n/index.js';
import { modelLong } from '../../shared/model-name.js';

/* ---------- session drawer ---------- */
export let tab = 'chat';
let logItems = [], subItems = [];
let logTimer = null;
let displayedSymphonyMember;
export let drS;
export let drM;
export function toggleSession(id) { if (state.selectedId === id && !drS.hidden) closeSession(); else openSession(id); }
export function openSession(id, opts = {}) {
  unseenDone.delete(id);
  if (!sessions.has(id)) return;
  closeMac();
  const same = state.selectedId === id && !drS.hidden;
  state.selectedId = id; drS.hidden = false; setView(null);
  const waver = workers.get(id); if (waver && !same) waver.waveUntil = state.sim + 1.8;
  if (small.matches) $('feed').classList.remove('feed--open');
  state.zoomGoal = (small.matches ? 2.1 : 1.6) * BASE_ZOOM;
  if (!same) { logItems = []; subItems = []; }
  state.subView = opts.agent || null;
  if (sessions.get(id).symphonyMember) {
    renderSessionHead(); queueUi();
    return;
  }
  setTab(opts.tab || 'chat');
  renderSessionHead(); renderCompose();
  loadLog(true);
  queueUi();
}
export function closeSession() { state.selectedId = null; state.subView = null; drS.hidden = true; goView('home'); queueUi(); }
export function renderSessionHead() {
  const s = sessions.get(state.selectedId); if (!s) return;
  $('ds-dot').style.background = colorOf(s);
  $('ds-name').textContent = dn(s);
  if (s.symphonyMember) {
    const issue = s.symphonyIssue;
    $('ds-dir').textContent = issue ? `${issue.issue_identifier} · ${taskTitle(issue)}` : `${s.symphonyMember} · Codex`;
    const badge = $('ds-status');
    badge.textContent = tr(issue ? 'demo.symphony.active' : 'demo.symphony.available'); badge.dataset.status = s.status;
    const body = $('ds-body');
    if (displayedSymphonyMember !== s) {
      displayedSymphonyMember = s;
      body.replaceChildren(...(issue ? [renderTaskDetails(issue)] : []));
    }
    return;
  }
  $('ds-dir').textContent = s.origin ? `${s.dir} · ${s.origin}` : s.dir;
  drawDrawerCache();   // (its prompt cache: warm for how long, or cold)
  const st = $('ds-status'); st.textContent = STATUS_LABEL[s.status]; st.dataset.status = s.status;
  $('ds-read').textContent = s.counts?.read ?? 0; $('ds-edit').textContent = s.counts?.edit ?? 0; $('ds-cmd').textContent = s.counts?.cmd ?? 0;
  $('ds-time').textContent = s.taskStart && s.status !== 'rest' ? fmtClock((nowMs() - s.taskStart) / 1000) : '–';
  const u = s.usage;
  $('ds-ctx').textContent = u ? `${Math.round((u.ctx / u.ctxMax) * 100)}%` : '–'; $('ds-ctx').parentElement.title = u ? tr('drawer.tokens', { used: fmtTok(u.ctx), max: fmtTok(u.ctxMax), model: u.model }) : '';
  $('ds-cost').textContent = u ? fmtUsd(u.cost) : '–'; $('ds-cost').parentElement.title = tr('drawer.priceNote');
  const n = s.subs?.length || 0;
  $('tab-subs').textContent = n ? tr('drawer.tabSubsN', { n }) : tr('drawer.tabSubs');
  pinsLabel(s);
}
export function openWindowOf() { toast(tr('drawer.demoNoWindow')); }
function setTab(t) {
  tab = t;
  for (const [id, name] of [['tab-chat', 'chat'], ['tab-subs', 'subs'], ['tab-act', 'act'], ['tab-pins', 'pins']]) $(id).setAttribute('aria-selected', String(t === name));
  if (t === 'chat') { if (logItems.length) renderChat(true); else $('ds-body').replaceChildren(el('p', 'chat-empty', tr('drawer.loadingChat'))); }
  else if (t === 'subs') renderSubs(true);
  else if (t === 'pins') renderPins();   // (what you pinned for it: ui/pins.js)
  else renderActivity();
  queueMicrotask(syncJump);
}
function loadLog(scrollEnd = false) {
  const id = state.selectedId; if (!id) return;
  const agent = tab === 'subs' ? state.subView : null;
  if (tab === 'subs' && !agent) return;
  if (tab === 'act') return;
  const items = (demoLog.get(agent || id) || []).slice(-120);
  if (agent) { subItems = items; renderSubs(scrollEnd); }
  else { logItems = items; if (tab === 'chat') renderChat(scrollEnd); }
}
export function scheduleLog() { clearTimeout(logTimer); logTimer = setTimeout(() => loadLog(false), 1200); }
/* conversation: a small markdown renderer that only builds DOM nodes (never innerHTML), so a transcript can't inject
   markup. Covers what Claude writes: headings, lists (nested, task boxes), code blocks, tables, quotes, rules, links. */
const MD_INLINE = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|(?<![\w*])\*[^*\s][^*\n]*?\*(?!\w)|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?])/;
function mdInline(parent, text) {
  for (const bit of String(text).split(new RegExp(MD_INLINE.source))) {
    if (!bit) continue;
    let m;
    if (bit.length > 2 && bit[0] === '`' && bit.at(-1) === '`') parent.append(el('code', null, bit.slice(1, -1)));
    else if (/^(\*\*|__).+\1$/.test(bit) && bit.length > 4) { const b = el('strong'); mdInline(b, bit.slice(2, -2)); parent.append(b); }
    else if (/^\*[^*].*\*$/.test(bit)) { const i = el('em'); mdInline(i, bit.slice(1, -1)); parent.append(i); }
    else if ((m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(bit))) {
      if (/^https?:\/\//.test(m[2])) { const a = el('a', null, m[1]); a.href = m[2]; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a); }
      else parent.append(el('span', 'md-file', m[1]));   // a path in the project: nothing to open from here
    } else if (/^https?:\/\//.test(bit)) { const a = el('a', null, short(bit.replace(/^https?:\/\//, ''), 60)); a.href = bit; a.target = '_blank'; a.rel = 'noopener noreferrer'; parent.append(a); }
    else parent.append(bit);
  }
}
const LIST_RE = /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/;
export function mdBlocks(text) {
  const frag = document.createDocumentFragment(), lines = String(text).replace(/\r/g, '').split('\n');
  let i = 0;
  const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l || '');
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const startsBlock = (l, next) => /^\s*```/.test(l) || /^#{1,6}\s/.test(l) || LIST_RE.test(l) || /^\s*>/.test(l) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l) || (/^\s*\|/.test(l) && isTableSep(next));
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = /^\s*```\s*([\w+#.-]*)/.exec(line))) {
      const code = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      const box = el('div', 'md-code'), head = el('div', 'md-code-head'), copy = el('button', 'md-copy', tr('drawer.copy')); copy.type = 'button';
      const body = code.join('\n'); copy.addEventListener('click', () => copyText(body, copy));
      head.append(el('span', null, m[1] || 'code'), copy); box.append(head, el('pre', null, body)); frag.append(box);
      continue;
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { const h = el(m[1].length <= 2 ? 'h4' : 'h5'); mdInline(h, m[2].replace(/\s#+\s*$/, '')); frag.append(h); i++; continue; }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { frag.append(el('hr')); i++; continue; }
    if (/^\s*\|/.test(line) && isTableSep(lines[i + 1])) {
      const wrap = el('div', 'md-table'), t = el('table'), thead = el('thead'), tr = el('tr');
      for (const c of cells(line)) { const th = el('th'); mdInline(th, c); tr.append(th); }
      thead.append(tr); t.append(thead); i += 2;
      const tb = el('tbody');
      while (i < lines.length && /^\s*\|/.test(lines[i])) { const r = el('tr'); for (const c of cells(lines[i])) { const td = el('td'); mdInline(td, c); r.append(td); } tb.append(r); i++; }
      t.append(tb); wrap.append(t); frag.append(wrap); continue;
    }
    if (/^\s*>/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      const bq = el('blockquote'); bq.append(mdBlocks(q.join('\n'))); frag.append(bq); continue;
    }
    if (LIST_RE.test(line)) {
      const stack = [];   // { indent, list, li }
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { if (LIST_RE.test(lines[i + 1] || '')) { i++; continue; } break; }
        const lm = LIST_RE.exec(l);
        if (!lm) {
          if (/^\s+\S/.test(l) && stack.length) { const li = stack.at(-1).li; li.append(' '); mdInline(li, l.trim()); i++; continue; }
          break;
        }
        const indent = lm[1].replace(/\t/g, '  ').length, ordered = /\d/.test(lm[2]);
        while (stack.length && stack.at(-1).indent > indent) stack.pop();
        if (!stack.length || stack.at(-1).indent < indent) {
          const list = el(ordered ? 'ol' : 'ul');
          if (ordered && parseInt(lm[2], 10) > 1) list.start = parseInt(lm[2], 10);
          (stack.length ? stack.at(-1).li : frag).append(list);
          stack.push({ indent, list, li: null });
        }
        const top = stack.at(-1), li = el('li');
        const task = /^\[( |x|X)\]\s+(.*)$/.exec(lm[3]);
        if (task) { li.className = 'md-task'; li.dataset.done = String(task[1] !== ' '); const t = el('span'); mdInline(t, task[2]); li.append(el('span', 'md-box', task[1] !== ' ' ? '✓' : ''), t); }
        else mdInline(li, lm[3]);
        top.list.append(li); top.li = li; i++;
      }
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i], lines[i + 1]))) para.push(lines[i++]);
    const p = el('p');
    para.forEach((l, k) => { if (k) p.append(el('br')); mdInline(p, l); });
    frag.append(p);
  }
  return frag;
}
function copyText(text, btn) {
  const done = () => { if (btn) { const t = btn.textContent; btn.textContent = tr('drawer.copied'); setTimeout(() => { btn.textContent = t; }, 1400); } else toast(tr('drawer.copiedToast')); };
  if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, () => toast(tr('drawer.copyFailed'))); return; }
  const ta = el('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch { toast(tr('drawer.copyFailed')); }
  ta.remove();
}
// Which long messages / step groups / summaries are open survives the re-render that follows every new event.
const chatOpen = new Set();
const chatKey = (it, k) => `${it.role}:${it.ts}:${k}`;
const LONG_CHARS = 1100, LONG_LINES = 18;
// the tally word for each step type: a key under drawer.step
const STEP_WORD = { read: 'read', grep: 'read', glob: 'read', skill: 'read', edit: 'edit', write: 'edit', bash: 'cmd', web: 'web', fetch: 'web', mcp: 'tool', agent: 'agent', plan: 'plan' };
function chatDay(ts) {
  const d = new Date(ts), t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const day = d >= t0 ? tr('drawer.today') : d >= t0.getTime() - 86400e3 ? tr('drawer.yesterday')
    : tr('drawer.date', { dd: pad2(d.getDate()), mm: pad2(d.getMonth() + 1), d: d.getDate(), mon: d.toLocaleDateString(locale(), { month: 'short' }) });
  return `${day} · ${hhmm(ts)}`;
}
function foldable(details, key) {
  if (chatOpen.has(key)) details.open = true;
  details.addEventListener('toggle', () => { if (details.open) chatOpen.add(key); else chatOpen.delete(key); });
  return details;
}
function buildChat(items, who = 'Claude') {
  const chat = el('div', 'chat');
  if (!items.length) chat.append(el('p', 'chat-empty', tr('drawer.chatEmpty')));
  let steps = null, lastTs = 0;
  const flush = () => {
    if (!steps) return;
    const first = steps[0], d = foldable(el('details', 'steps'), chatKey(first, 'steps'));
    const sum = el('summary'), counts = {};
    for (const x of steps) { const w = STEP_WORD[x.type] || 'other'; counts[w] = (counts[w] || 0) + 1; }
    sum.append(el('span', 'st-ico', null), el('b', null, tr('drawer.steps', { n: steps.length })));
    sum.firstChild.append(icon('terminal'));
    const tally = el('span', 'st-tally', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([w, n]) => tr(`drawer.step.${w}`, { n })).join(' · '));
    sum.append(tally, el('span', 'st-chev'));
    sum.lastChild.append(icon('chevron'));
    const ul = el('ul');
    for (const x of steps) {
      const li = el('li'), ic = el('span', 'st-step-ico'); ic.append(icon(TYPE_ICON[x.type] || 'sparkle'));
      const txt = el('span', x.type === 'bash' ? 'st-cmd' : null, cap(verb(x)));
      li.append(ic, txt); ul.append(li);
    }
    d.append(sum, ul); chat.append(d); steps = null;
  };
  items.forEach((it, k) => {
    if (it.ts && (!lastTs || it.ts - lastTs > 20 * 60e3 || new Date(it.ts).getDate() !== new Date(lastTs).getDate())) { flush(); chat.append(el('div', 'chat-day', chatDay(it.ts))); }
    if (it.ts) lastTs = it.ts;
    if (it.role === 'tool') { (steps ||= []).push(it); return; }
    flush();
    // the server writes the note; one about a subagent gets a clipboard ("trợ lý" is the Vietnamese wording)
    if (it.role === 'note') { chat.append(el('div', 'msg-note', `${/trợ lý|subagent/i.test(it.text) ? '📋' : '✋'} ${it.text}${it.ts ? ' · ' + hhmm(it.ts) : ''}`)); return; }
    if (it.role === 'summary') {
      const d = foldable(el('details', 'msg-summary'), chatKey(it, 'sum')), sm = el('summary');
      const ic = el('span', 'sum-ico'); ic.append(icon('list'));
      const tx = el('span', 'sum-txt'); tx.append(el('b', null, tr('drawer.summaryTitle')), el('small', null, tr('drawer.summaryNote')));
      const chev = el('span', 'st-chev'); chev.append(icon('chevron'));
      sm.append(ic, tx, chev);
      const body = el('div', 'md'); body.append(mdBlocks(it.text.replace(/^This session is being continued[^\n]*\n+/, '').replace(/^Summary:\s*\n?/, '')));
      d.append(sm, body); chat.append(d); return;
    }
    const mine = it.role === 'user', m = el('div', 'msg msg--' + (mine ? 'user' : 'claude'));
    const head = el('div', 'msg-head');
    if (!mine) { const av = el('span', 'msg-av', who === 'Claude' ? 'C' : tr('drawer.subAvatar')); if (who !== 'Claude') av.dataset.tone = 'blue'; head.append(av); }
    head.append(el('b', null, mine ? (who === 'Claude' ? tr('drawer.you') : tr('drawer.fromMain')) : who));
    if (it.ts) head.append(el('time', null, hhmm(it.ts)));
    if (!mine) { const cp = el('button', 'msg-copy', tr('drawer.copy')); cp.type = 'button'; cp.title = tr('drawer.copyMessage'); cp.addEventListener('click', () => copyText(it.text, cp)); head.append(cp); }
    const body = el('div', 'msg-body md');
    body.append(mdBlocks(it.text));
    if (it.imgs) body.append(el('p', 'msg-imgs', tr('drawer.images', { n: it.imgs })));
    m.append(head, body);
    const long = it.text.length > LONG_CHARS || it.text.split('\n').length > LONG_LINES;
    if (long) {
      const key = chatKey(it, k), more = el('button', 'msg-more'); more.type = 'button';
      const set = (open) => { body.classList.toggle('is-clamped', !open); more.textContent = open ? tr('drawer.showLess') : tr('drawer.showMore', { n: Math.max(1, Math.round(it.text.length / 1000)) }); };
      set(chatOpen.has(key));
      more.addEventListener('click', () => { const open = !chatOpen.has(key); if (open) chatOpen.add(key); else chatOpen.delete(key); set(open); });
      m.append(more);
    }
    chat.append(m);
  });
  flush();
  return chat;
}
export function renderChat(scrollEnd) {
  if (tab !== 'chat') return;
  const body = $('ds-body');
  const nearEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  const top = body.scrollTop;
  body.replaceChildren(buildChat(logItems));
  if (scrollEnd || nearEnd) body.scrollTop = body.scrollHeight; else body.scrollTop = top;
  syncJump();
}
let jumpBtn;
function syncJump() { const b = $('ds-body'); jumpBtn.hidden = !(tab === 'chat' || (tab === 'subs' && state.subView)) || b.scrollHeight - b.scrollTop - b.clientHeight < 240; }
const subInfo = (s, id) => [...(s?.subs || []), ...(s?.doneSubs || [])].find((y) => y.id === id);
export function renderSubs(scrollEnd = false) {
  if (tab !== 'subs') return;
  const s = sessions.get(state.selectedId), body = $('ds-body');
  if (state.subView) {
    const x = subInfo(s, state.subView);
    const nearEnd = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
    const head = el('div', 'sub-head');
    const back = el('button', 'btn btn--sm', tr('drawer.allSubs')); back.type = 'button';
    back.addEventListener('click', () => { state.subView = null; renderSubs(); });
    const pill = el('span', 'pill', x && !x.endedAt ? tr('drawer.working') : tr('drawer.done')); pill.dataset.status = x && !x.endedAt ? 'work' : 'rest';
    head.append(back, el('b', null, x ? `${x.type}${x.desc ? ': ' + x.desc : ''}` : tr('drawer.subagent')), pill);
    const wrap = el('div'); wrap.append(head, subItems.length ? buildChat(subItems, x?.type || tr('drawer.subagent')) : el('p', 'chat-empty', tr('drawer.loadingSub')));
    body.replaceChildren(wrap);
    if (scrollEnd || nearEnd) body.scrollTop = body.scrollHeight;
    syncJump();
    return;
  }
  const frag = document.createDocumentFragment();
  const act = s?.subs || [], done = s?.doneSubs || [];
  if (!act.length && !done.length) frag.append(el('p', 'chat-empty', tr('drawer.noSubs')));
  const card = (x, running) => {
    const b = el('button', 'sub-card'); b.type = 'button';
    const ic = el('span', 'fi-ico'); if (running) ic.dataset.tone = 'blue'; ic.append(icon(running ? 'sparkle' : 'check'));
    const steps = tr('drawer.steps', { n: x.steps || 0 });
    const m = modelLong(x.model);
    b.append(ic, el('b', null, `${x.type}${x.desc ? ' · ' + x.desc : ''}`), el('small', null, [m, running ? steps : tr('drawer.doneAt', { time: hhmm(x.endedAt) })].filter(Boolean).join(' · ')),
      el('span', null, running ? (x.last ? cap(verb(x.last)) : tr('drawer.starting')) : tr('drawer.subDoneMeta', { steps, time: hhmm(x.startedAt) })));
    b.addEventListener('click', () => { state.subView = x.id; subItems = []; renderSubs(); loadLog(true); });
    return b;
  };
  if (act.length) { frag.append(el('p', 'sub-group', tr('drawer.groupWorking', { n: act.length }))); const box = el('div', 'rows'); act.forEach((x) => box.append(card(x, true))); frag.append(box); }
  if (done.length) { frag.append(el('p', 'sub-group', tr('drawer.groupDone'))); const box = el('div', 'rows'); done.forEach((x) => box.append(card(x, false))); frag.append(box); }
  body.replaceChildren(frag);
}
export function renderActivity() {
  if (tab !== 'act') return;
  const body = $('ds-body');
  const mine = state.feed.filter((e) => e.sess === state.selectedId).slice(-60).reverse();
  const ul = el('ul', 'feed-list'); ul.style.padding = '0';
  if (!mine.length) ul.append(el('li', 'fi-empty', tr('drawer.noActivity')));
  for (const e of mine) ul.append(feedRow(e, false));
  ul.addEventListener('click', (ev) => { const b = ev.target.closest('[data-agent]'); if (b) openFromRow(b); });
  body.replaceChildren(ul);
}

export function setup() {
  state.subView = null;
  drS = $('dr-session'); drM = $('dr-mac');
  if (SYMPHONY_DEMO) return;
  $('tab-chat').addEventListener('click', () => { setTab('chat'); loadLog(true); });
  $('tab-subs').addEventListener('click', () => { state.subView = null; setTab('subs'); });
  $('tab-act').addEventListener('click', () => setTab('act'));
  $('tab-pins').addEventListener('click', () => setTab('pins'));
  // "Latest" button: shows when you have scrolled up in a conversation.
  jumpBtn = el('button', 'chat-jump');
   jumpBtn.type = 'button';
   jumpBtn.hidden = true;
  jumpBtn.append(icon('chevron'), document.createTextNode(tr('drawer.latest')));
  jumpBtn.addEventListener('click', () => { const b = $('ds-body'); b.scrollTo({ top: b.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  $('dr-session').append(jumpBtn);
  setupCompose(drS);   // (a box to write to the session from its page: ui/session-compose.js)
  $('ds-body').addEventListener('scroll', syncJump, { passive: true });
}
