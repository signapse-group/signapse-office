// The capture preserves the surveyed queue counts. The running demo uses the office's team roster.
export const SNAPSHOT_AT = '2026-11-13T06:21:27Z';
export const TEAMS = [
  { key: 'BE', name: 'Backend', role: 'Backend Developer', capacity: 1, proUnit: 0, cozyDesks: [0, 1] },
  { key: 'FE', name: 'Frontend', role: 'Frontend Developer', capacity: 2, proUnit: 1, cozyDesks: [2, 9] },
  { key: 'QA', name: 'Quality Assurance', role: 'Quality Assurance Engineer', capacity: 2, proUnit: 2, cozyDesks: [3, 4] },
  { key: 'PM', name: 'Project Management', role: 'Project Manager', capacity: 1, cozyDesks: [10, 11] },
  { key: 'Sales', name: 'Sales', role: 'Sales Specialist', capacity: 0, cozyDesks: [6, 7] },
  { key: 'Marketing', name: 'Marketing', role: 'Marketing Specialist', capacity: 0, cozyDesks: [5, 8] },
];
export const MEMBERS_PER_TEAM = 2;
export const SEATS = TEAMS.flatMap(({ key, role, proUnit, cozyDesks }) =>
  Array.from({ length: MEMBERS_PER_TEAM }, (_, slot) => ({
    team: key, role, proUnit, slot, cozyDesk: cozyDesks[slot], id: `symphony-${key.toLowerCase()}-${slot + 1}`,
  })));

export const STEP_MS = 10_000;
export const LAST_STEP = 6;

// Each task lists its queue changes by step. A missing step keeps its previous status.
const tasks = [
  { team: 'BE', id: 'OFC-201', priority: 'P2', steps: { 0: 'handoff', 1: 'active', 4: 'completed' } },
  { team: 'BE', id: 'OFC-202', priority: 'P1', slot: 1, steps: { 1: 'active', 2: 'completed' } },
  { team: 'BE', id: 'OFC-203', priority: 'P1', slot: 1, steps: { 1: 'waiting', 2: 'active', 3: 'retrying', 4: 'active', 5: 'completed' } },
  { team: 'FE', id: 'OFC-204', priority: 'P1', steps: { 0: 'retrying', 1: 'active', 2: 'completed' }, snapshotAttempt: 1 },
  { team: 'FE', id: 'OFC-205', priority: 'P2', slot: 1, steps: { 1: 'active', 3: 'completed' } },
  { team: 'FE', id: 'OFC-206', priority: 'P2', slot: 1, steps: { 1: 'waiting', 3: 'active', 4: 'completed' } },
  { team: 'FE', id: 'OFC-207', priority: 'P3', steps: { 1: 'waiting', 2: 'active', 3: 'blocked', 4: 'active', 6: 'completed' }, dependency: 'OFC-212' },
  { team: 'FE', id: 'OFC-208', priority: 'P2', steps: { 1: 'waiting', 5: 'active', 6: 'completed' }, slot: 1 },
  { team: 'FE', id: 'OFC-209', priority: 'P1', slot: 1, steps: { 3: 'waiting', 4: 'active', 5: 'completed' },
    reportedBy: 'OFC-210', workflow: { 3: 'logBug', 4: 'fix', 5: 'retest', 6: 'verify' } },
  { team: 'QA', id: 'OFC-210', priority: 'P1', steps: { 0: 'retrying', 1: 'active', 6: 'completed' }, snapshotAttempt: 15,
    workflow: { 1: 'reproduce', 2: 'evidence', 3: 'logBug', 5: 'retest', 6: 'verify' } },
  { team: 'QA', id: 'OFC-211', priority: 'P2', slot: 1, steps: { 1: 'active', 3: 'completed' } },
  { team: 'PM', id: 'OFC-212', priority: 'P2', steps: { 1: 'active', 4: 'completed' },
    workflow: { 1: 'requirement', 2: 'epic', 3: 'story', 4: 'subtasks' } },
  { team: 'PM', id: 'OFC-213', priority: 'P2', slot: 1, steps: { 1: 'active', 5: 'completed' } },
  { team: 'Sales', id: 'OFC-214', priority: 'P2', steps: { 1: 'active', 3: 'completed' } },
  { team: 'Sales', id: 'OFC-215', priority: 'P2', slot: 1, steps: { 1: 'active', 5: 'completed' } },
  { team: 'Marketing', id: 'OFC-216', priority: 'P2', steps: { 1: 'active', 4: 'completed' } },
  { team: 'Marketing', id: 'OFC-217', priority: 'P2', slot: 1, steps: { 1: 'active', 6: 'completed' } },
];

function taskAt(task, step, timeAt, events) {
  const { id, team, priority, steps, dependency, reportedBy, workflow, snapshotAttempt, slot = 0 } = task;
  const history = [...new Set([...Object.keys(steps).map(Number), ...(events?.keys() ?? [])])]
    .filter((n) => n <= step).sort((a, b) => a - b)
    .flatMap((n) => events?.get(n) || [{ kind: steps[n], at: timeAt(n) }]);
  const latest = history.at(-1);
  if (!latest) return null;
  const { kind, at } = latest;
  const milestones = Object.entries(workflow || {}).map(([n, action]) => ({ action, step: Number(n), reached: Number(n) <= step }));
  const row = { issue_id: id, issue_identifier: id, issue_url: null,
    demo: { kind, team, priority, history, dependency, reportedBy, milestones, slot } };
  if (kind === 'active') {
    const firstStart = history.findIndex((event) => event.kind === 'active');
    const turn_count = 1 + history.slice(firstStart).filter((event) => event.kind === 'retrying').length;
    const started_at = turn_count === 1 ? history[firstStart].at : at;
    Object.assign(row, { state: 'Progress', session_id: `sample-${id}-${turn_count}`, started_at,
      turn_count, handoff_error: null, last_event: 'session_started', last_event_at: at });
  } else if (kind === 'handoff') {
    Object.assign(row, { state: 'Progress', session_id: null, started_at: null, turn_count: 0,
      handoff_error: 'handoff', last_event: null, last_event_at: null });
  } else if (kind === 'retrying') {
    Object.assign(row, { attempt: step ? 1 : snapshotAttempt, error: step ? 'interrupted' : 'handoff',
      due_at: step ? new Date(Date.parse(at) + STEP_MS).toISOString() : null });
  } else {
    row.state = { waiting: 'Ready', assigning: 'Ready', assigned: 'Assigned', returning: 'Assigned',
      blocked: 'Blocked', unblocked: 'Ready', completed: 'Done' }[kind];
  }
  return row;
}

export function snapshots(step = 0, runAt = Date.parse(SNAPSHOT_AT), stepTimes = [], transitions = new Map()) {
  const timeAt = (n) => n ? new Date(stepTimes[n] ?? runAt + (n - 1) * STEP_MS).toISOString() : SNAPSHOT_AT;
  const generated_at = timeAt(step);
  return TEAMS.map((team) => {
    const rows = tasks.filter((task) => task.team === team.key)
      .map((task) => taskAt(task, step, timeAt, transitions.get(task.id))).filter(Boolean);
    const queue = (kind) => rows.filter((row) => row.demo.kind === kind);
    const active = queue('active');
    const running = [...active, ...queue('handoff')];
    const retrying = queue('retrying'), waiting = queue('waiting'), blocked = queue('blocked');
    return { ...team, capacity: step ? MEMBERS_PER_TEAM : team.capacity, completed: queue('completed'),
      assigning: queue('assigning'), assigned: queue('assigned'), returning: queue('returning'), unblocked: queue('unblocked'), state: {
      generated_at, counts: { running: running.length, retrying: retrying.length, waiting: waiting.length, blocked: blocked.length },
      running, retrying, waiting, waiting_updated_at: generated_at, blocked, codex_totals: null, rate_limits: null,
      runtime_control: { mode: step || team.key === 'PM' ? 'running' : 'paused', active_turns: active.length },
    } };
  });
}

export function runtimeRows(team) {
  const { running, retrying, waiting, blocked } = team.state;
  const active = running.filter((row) => row.session_id && !row.handoff_error);
  const handoff = running.filter((row) => row.handoff_error);
  const { assigning, assigned, returning, unblocked, completed } = team;
  return { active, assigning, assigned, returning, unblocked, handoff, retrying, waiting, blocked, completed };
}
