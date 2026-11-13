// Quarterly office fire drill: alarm, stairs and return to the floor. The sessions keep working.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { PRO, officeNow, pad2, rand, reduceMotion, replay } from '../core/env.js';
import { scene } from '../scene/renderer.js';
import { boxAt, mergeAll, vmat } from '../world/terrace.js';
import { lift, liftArrive, liftIdle, stairsDown } from '../world/entrance.js';
import { DOOR_OUT } from '../people/navigation.js';
import { dn, sessions, workers } from '../people/workers.js';
import { later } from '../people/errands.js';
import { resume } from '../people/desk-rest.js';
import { hrOnDuty } from '../people/hr.js';
import { director } from '../people/director.js';
import { staff } from '../people/staff.js';
import { sfx } from '../audio/sfx.js';
import { chatLife } from '../ui/group-chat.js';
import { queueUi, toast } from '../ui/activity.js';
import { dayKey, isWorkday, quarterStart } from '../../shared/workdays.js';
import { t as tr } from '../../i18n/index.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const FORCE = Q.has('drill'), AT = 900, KEY = 'office-drill', DONE_KEY = 'office-drill-day';
let D = null, last = null, checkAt = 0, noticeDay = '', strobes = null, forced = false, bornAt = 0;
const minutes = (d = officeNow()) => d.getHours() * 60 + d.getMinutes();
const quarterOf = (d) => tr('life.drill.quarters', null, 'list')[Math.floor(d.getMonth() / 3)];   // (I–IV in Vietnamese, 1–4 in English)
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* storage blocked */ } return null; };
/** whether the drill is on (Settings → More) */
export const drillOn = () => store(KEY) !== 'off';
/** today is the quarter's first working day (the drill's day) */
export const drillDay = (d = officeNow()) => isWorkday(d) && dayKey(quarterStart(d)) === dayKey(d);
function say(w, key, vars, ms = 3500) { const text = tr(`life.drill.${key}`, vars); w.say('idle', text); setTimeout(() => { if (w.lastSay?.text === text) w.hush(); }, ms); return text; }

/* ---------- the horn-strobes on the walls (always there, as in any office; flashing in a drill) ---------- */
const STROBES = [[-7.95, 2.55, 2.1, Math.PI / 2], [-7.95, 2.55, 6.3, Math.PI / 2], [4.2, 2.85, -7.95, 0], [13.52, 2.62, -7.95, 0]];
function buildStrobes() {
  const parts = [], lens = [];
  for (const [x, y, z, ry] of STROBES) {
    const M = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    parts.push(boxAt(0.15, 0.2, 0.05, 0, 0, 0.025, '#C8261B').applyMatrix4(M), boxAt(0.11, 0.05, 0.02, 0, -0.045, 0.055, '#E9ECEF').applyMatrix4(M));
    lens.push(new THREE.BoxGeometry(0.1, 0.05, 0.03).translate(0, 0.045, 0.06).applyMatrix4(M));
  }
  const body = new THREE.Mesh(mergeAll(parts), vmat({ roughness: 0.5 })); scene.add(body);
  const lensM = new THREE.MeshBasicMaterial({ color: '#E9D9D2', toneMapped: false });
  const lensMesh = new THREE.Mesh(mergeAll(lens), lensM); lensMesh.userData.noMerge = true; scene.add(lensMesh);
  return { lensM, on: false, flashAt: 0 };
}
function flash(on) {
  if (!strobes) return;
  if (!on) { if (strobes.on) { strobes.on = false; strobes.lensM.color.set('#E9D9D2'); } return; }
  const t = state.sim, k = (t % 1) < 0.12;   // (once a second, a hard white blink)
  if (k !== strobes.on) { strobes.on = k; strobes.lensM.color.setRGB(k ? 6 : 0.9, k ? 6 : 0.85, k ? 6 : 0.82); }
}

/* ---------- the people ---------- */
// who is on the floor and can take part: in their place or walking about on the floor (not out, not in the lift, not
// in the middle of something of their own: a stall, a chore, an errand)
const onFloor = (w) => !!w.root.parent && !w.leaving && !w.coming && !w.leavingNow && !w.ritual && !w.job && !w.away && !w.homeBound && !w.offstage && !w.chore && !w.liftHold && !w.liftWait && !w.liftRide && !w.stairs && !w.inStall && !w.wcBusy;
function gather() {
  const out = [];
  for (const w of workers.values()) if (!w.sub && onFloor(w)) out.push({ w, kind: 'worker', name: dn(sessions.get(w.id)) || w.cfg.name });
  const { receptionist } = staff();
  if (receptionist && onFloor(receptionist)) out.push({ w: receptionist, kind: 'staff', name: receptionist.cfg.name });
  if (director && onFloor(director) && !director.job && director.station === 'home') out.push({ w: director, kind: 'staff', name: director.cfg.name });
  return out;
}
const alive = (m) => !!D && !m.dead && m.w.chore?.drill === D && !m.w.leaving;
function join(m, k) {
  const w = m.w;
  m.home = { spot: w.spot, station: w.station, anim: w.anim, pose: w.pose };
  m.stage = 'go'; m.i = k;
  w.after = null; w.hush(); w.restAt = Infinity;
  w.chore = { drill: D, where: { ic: 'walk', text: tr('life.drill.where') } };
  later(reduceMotion ? 0.2 : rand(0.6, 2.4) + (m.hr ? 4 : 0), () => {
    if (!alive(m)) return;
    w.anim = 'idle'; if (Math.random() < 0.45 && !m.hr) say(w, 'go', null, 3000);
    m.stage = 'stairs';
    stairsDown(w, () => alive(m) && down(m), null);
  });
}
function down(m) {
  m.stage = 'there';
  m.w.away = true;
}

function up(m) {
  const w = m.w;
  m.stage = 'up'; w.path = []; w.phase = 'idle';
  later(rand(2, 4.5), () => {
    if (!alive(m)) return;
    w.away = false; w.pos.set(DOOR_OUT.x, DOOR_OUT.z); w.face = w.faceTarget = Math.PI / 2; w.spot = DOOR_OUT;
    liftArrive(w);
    const home = m.kind === 'worker' ? w.homeSpot() : m.home.spot || w.homeSpot();
    w.goTo(home, () => settle(m));
  });
}
// back in place: a session's person on with whatever is there; the staff as they were
function settle(m) {
  const w = m.w;
  m.dead = true; m.stage = 'done';
  if (w.chore?.drill) w.chore = null;
  armband(w, false);
  if (m.kind === 'worker') resume(w);
  else { w.station = m.home.station; w.anim = m.home.anim === 'walk' ? 'idle' : m.home.anim; w.pose = m.home.spot?.sit ? 'sit' : 'stand'; }
  queueUi();
}
// called off (a replay began, they left): back in their place at once
function drop(m) {
  if (m.dead) return;
  const w = m.w;
  m.dead = true; armband(w, false);
  if (w.chore?.drill) w.chore = null;
  if (w.leaving) return;
  w.away = false; w.stairs = null; w.liftHold = false; w.path = []; w.phase = 'idle'; w.onArrive = null; w.after = null;
  const at = m.kind === 'worker' ? w.homeSpot() : m.home?.spot || w.homeSpot();
  w.pos.set(at.x, at.z); w.spot = at; w.face = w.faceTarget = at.face; w.pose = at.sit ? 'sit' : 'stand';
  if (m.kind === 'worker') resume(w); else { w.station = m.home?.station; w.anim = m.home?.anim || 'idle'; }
}
// HR's red armband.
let bandGeo, bandM;
function armband(w, on) {
  if (!on) { w.drillBand?.removeFromParent(); w.drillBand = null; return; }
  if (w.drillBand) return;
  bandGeo ||= new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); bandM ||= new THREE.MeshStandardMaterial({ color: '#D21F1F', roughness: 0.6, side: THREE.DoubleSide });
  const b = new THREE.Mesh(bandGeo, bandM), Dm = w.P.D;
  b.scale.set(Dm.armR * 1.25, 0.06, Dm.armR * 1.25); b.position.set(0, -Dm.upper * 0.42, 0); w.P.armL.sh.add(b); w.drillBand = b;
}

/* ---------- the drill ---------- */
function begin() {
  const d = officeNow();
  const list = gather(), H = hrOnDuty();
  D = { phase: 'alarm', t0: state.sim, members: [], q: quarterOf(d), day: dayKey(d), ringUntil: state.sim + (reduceMotion ? 6 : 22), outAt: 0 };
  strobes ||= buildStrobes();
  if (lift) lift.drill = true;
  sfx.play('alarm');
  toast(tr('life.drill.toast', { q: D.q }), 6000);
  // HR first to her feet: the armband on, the call, then she sees everyone out and goes last
  if (H && onFloor(H)) { list.push({ w: H, kind: 'staff', name: H.cfg.name, hr: true }); armband(H, true); later(0.8, () => D && say(H, 'call', null, 5000)); }
  list.forEach((m, k) => { D.members.push(m); join(m, k); });
  if (!FORCE) store(DONE_KEY, D.day);
  queueUi();
}
function muster() {
  D.phase = 'muster';
  D.secs = Math.round(D.outAt - D.t0);
  later(reduceMotion ? 2 : 20, () => D && back());
}
function back() {
  D.phase = 'back';
  if (lift) lift.drill = false;
  D.members.forEach((m, k) => { if (alive(m)) later(reduceMotion ? 0.2 : 0.4 + k * rand(0.4, 0.9), () => alive(m) && up(m)); });
}
function end() {
  const d = D; D = null;
  last = { ...state_(d), ended: true };
  if (lift) lift.drill = false;
  flash(false);
  chatLife('drillDone', { q: d.q, n: d.members.length, time: `${Math.floor((d.secs || 0) / 60)}:${pad2((d.secs || 0) % 60)}`, every: 12 * 3600e3 });
  queueUi();
}
function stop() {   // called off (a replay): everyone back in place
  if (!D) return;
  for (const m of D.members) drop(m);
  const d = D; D = null; last = { ...state_(d), stopped: true };
  if (lift) lift.drill = false;
  flash(false);
}

/* ---------- each frame ---------- */
export function updateDrill() {
  if (!PRO) return;
  if (D) { step(); return; }
  const now = performance.now();   // (by the wall clock: the office's own clock crawls when it draws a few frames a second)
  if (now < checkAt) return;
  checkAt = now + 4000;
  if (replay.on) return;
  const d = officeNow(), m = minutes(d), today = dayKey(d);
  if (FORCE && !forced && now - bornAt > 6000) { if (liftIdle() || now - bornAt > 20000) { forced = true; begin(); } return; }   // (?drill: once a page, the lift free first)
  if (!drillOn() || !drillDay(d)) return;
  // the morning: HR's notice, pinned in the group chat
  if (noticeDay !== today && m >= 510 && m < 690) { noticeDay = today; chatLife('drillNotice', { q: quarterOf(d), every: 12 * 3600e3 }); }
  // 15:00 (up to half past, if the page was closed at three), once
  if (m >= AT && m < AT + 30 && store(DONE_KEY) !== today && (liftIdle() || m >= AT + 2)) begin();
}
function step() {
  if (replay.on) { stop(); return; }
  const t = state.sim;
  flash(D.phase !== 'back' || t - D.t0 < 8);
  if (D.phase === 'alarm' && t < D.ringUntil && t > (D.ringAt || 0)) { D.ringAt = t + 1.7; sfx.play('alarm'); }
  for (const m of D.members) if (!m.dead && (m.w.leaving || !m.w.root.parent)) m.dead = true;
  const live = D.members.filter((m) => !m.dead);
  if (D.phase === 'alarm') {
    const out = live.every((m) => m.stage === 'there');
    if (out && !D.outAt) D.outAt = t;
    if ((live.every((m) => m.stage === 'there') && live.length) || t - D.t0 > 150) { D.outAt ||= t; muster(); }
  }
  if ((D.phase === 'back' && live.every((m) => m.stage === 'done' || m.dead)) || (!live.length && D.phase !== 'alarm')) end();
}
/* ---------- for tests (?debug) ---------- */
const state_ = (d) => d && ({ phase: d.phase, q: d.q, secs: d.secs ?? null, lift: !!lift?.drill, strobe: !!strobes,
  members: d.members.map((m) => ({ id: m.w.id, stage: m.stage, hr: !!m.hr, x: +m.w.pos.x.toFixed(1), z: +m.w.pos.y.toFixed(1) })) });
const debug = {
  start: () => { if (D) return false; begin(); return true; },
  state: () => (D ? state_(D) : last),
  day: (iso) => { const d = new Date(`${iso}T12:00:00`); return { day: drillDay(d), first: dayKey(quarterStart(d)) }; },
};
if (Q.has('debug')) setTimeout(function hook() { if (!window.__office) { setTimeout(hook, 200); return; } window.__office.drill = debug; }, 0);
export function setup() {
  bornAt = performance.now();
  if (!PRO) return;
  strobes = buildStrobes();
}
