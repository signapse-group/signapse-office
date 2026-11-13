import { reduceMotion } from '../core/env.js';
import { state } from '../core/state.js';
import { free, later } from '../people/errands.js';
import { allocate, faceTo, STATIONS } from '../people/navigation.js';
import { nearBoss, sessions, workers } from '../people/workers.js';
import { t } from '../../i18n/index.js';
import { MEMBERS_PER_TEAM, SEATS, TEAMS } from './symphony-state.js';

const tr = (key, vars) => t(`demo.symphony.motion.${key}`, vars);
const atDesk = (w) => w && w.station === 'desk' && free(w);
const frontend = 'symphony-fe-1', owner = 'symphony-pm-2', pm = 'symphony-pm-1', qa = 'symphony-qa-1';
let roomJob, run = 0;

export function resetRoomWorkflow() {
  roomJob = null;
  run++;
  for (const w of workers.values()) {
    if (!['symphony-blockers', 'symphony-meeting'].includes(w.chore?.thing)) continue;
    w.chore.until = state.sim;
    if (w.after && !Number.isFinite(w.afterAt)) w.afterAt = state.sim;
  }
}

export function showRoomWorkflow(step, onStage, assignments) {
  let job;
  if (step === 3 && !assignments) {
    job = { room: 'blockers', people: [frontend, owner], lines: [[frontend, 'raiseBlock'], [owner, 'ackBlock'], [owner, 'clearBlock']] };
  } else if (step === 1) {
    job = { room: 'meeting', people: SEATS.map(({ id }) => id), lines: [[pm, 'assignSprint'], [frontend, 'acceptSprint']] };
  } else if (step === 4) {
    job = { room: 'meeting', people: [...new Set([pm, frontend, qa, ...assignments.map(({ worker }) => worker)])],
      lines: [[pm, 'assignTask', { id: assignments.find(({ worker }) => worker !== frontend)?.id }], [frontend, 'acceptTask'], [qa, 'acceptTest']] };
  } else {
    job = { room: 'meeting', people: [...new Set([pm, ...assignments.map(({ worker }) => worker)])],
      lines: [[pm, 'assignIssues', { ids: assignments.map(({ id }) => id).join(', ') }], [assignments[0].worker, 'acceptSprint']] };
  }
  if (reduceMotion) {
    for (const phase of ['arrived', 'returning', 'done']) onStage(phase);
    return;
  }
  roomJob = { ...job, onStage };
}

function startRoomJob() {
  const { room, people, lines, onStage } = roomJob;
  const participants = people.map((id) => workers.get(id));
  if (!participants.every(atDesk)) return;
  const spots = STATIONS[room].filter((spot) => !spot.by).slice(0, people.length);
  if (spots.length < people.length) return;
  const startedIn = run;
  const jobs = new Map();
  let arrived = 0, returned = 0;
  for (const [i, worker] of participants.entries()) {
    const spot = spots[i];
    spot.by = worker;
    const errand = worker.errand({
      thing: `symphony-${room}`, spot, type: room === 'meeting' ? 'meet' : 'plan', anim: 'idle', wait: 0.2, hold: 0.3,
      arrived: () => {
        if (startedIn !== run || ++arrived !== participants.length) return;
        if (room === 'blockers') onStage('arrived');
        const end = state.sim + 6;
        for (const [person, job] of jobs) {
          job.until = end;
          if (person.after && !Number.isFinite(person.afterAt)) person.afterAt = end;
        }
        for (const [index, [id, line, vars]] of lines.entries()) later(index * 1.7, () => {
          const speaker = workers.get(id);
          if (startedIn !== run || speaker.chore !== jobs.get(speaker)) return;
          const message = tr(line, vars);
          speaker.chore.said.add(message);
          speaker.say(room === 'blockers' && index === 0 ? 'wait' : 'meet', message);
          if (room === 'meeting' && index === lines.length - 1) onStage('arrived');
        });
        later(5, () => { if (startedIn === run) onStage('returning'); });
      },
      done: () => {
        if (startedIn !== run || ++returned !== participants.length) return;
        roomJob = null;
        onStage('done');
      },
    });
    errand.until = Infinity;
    jobs.set(worker, errand);
  }
  roomJob.started = true;
}

export function startSymphonyMotion() {
  let turn = 0;
  function next() {
    if (roomJob && !roomJob.started) startRoomJob();
    const team = turn % TEAMS.length, round = Math.floor(turn / TEAMS.length);
    const slot = round % MEMBERS_PER_TEAM;
    const w = workers.get(SEATS[team * MEMBERS_PER_TEAM + slot].id);
    const peerTeam = (team + 1 + Math.floor(round / MEMBERS_PER_TEAM) % (TEAMS.length - 1)) % TEAMS.length;
    const peer = workers.get(SEATS[peerTeam * MEMBERS_PER_TEAM + (slot + 1) % MEMBERS_PER_TEAM].id);
    turn++;
    if (!reduceMotion && !roomJob?.people.includes(w.id) && atDesk(w)) {
      if ((Math.floor(round / MEMBERS_PER_TEAM) + team) % 2 === 0) {
        const spot = allocate('server', w, true);
        if (spot) {
          spot.by = w;
          w.errand({ thing: 'symphony-server', spot, type: 'bash', anim: 'console', wait: 0.2, hold: 2.6,
            line: tr('server'), at: () => tr('serverDone') });
        }
      } else if (!roomJob?.people.includes(peer.id) && atDesk(peer)) {
        const spot = nearBoss(peer, w);
        const host = peer.errand({ type: 'meet', wait: 0.2, hold: 12, linger: 0.3, anim: 'idle',
          done: () => { peer.faceTarget = peer.homeSpot().face; } });
        w.errand({ thing: 'symphony-talk', spot, type: 'meet', anim: 'idle', wait: 0.2, hold: 2.6,
          line: tr('visit', { team: sessions.get(peer.id).symphonyMember }),
          arrived: () => {
            if (peer.chore !== host || host.stage !== 'go') return;
            peer.faceTarget = faceTo(peer.pos.x, peer.pos.y, w.pos.x, w.pos.y);
            const reply = tr('reply');
            peer.say('meet', reply);
            host.said.add(reply);
            peer.afterAt = state.sim + 2.6;
          },
          at: () => tr('thanks'),
        });
      }
    }
    later(2.5, next);
  }
  if (!reduceMotion) later(0.6, next);
}
