import { $, el, reduceMotion } from '../core/env.js';
import { state } from '../core/state.js';
import { upsertSession } from '../net/live.js';
import { queueUi } from '../ui/activity.js';
import { later } from '../people/errands.js';
import { workers } from '../people/workers.js';
import { t } from '../../i18n/index.js';
import { LAST_STEP, SNAPSHOT_AT, STEP_MS, SEATS, TEAMS, runtimeRows, snapshots } from './symphony-state.js';
import { renderTaskDetails, taskTitle } from './symphony-task.js';
import { resetRoomWorkflow, startSymphonyMotion, showRoomWorkflow } from './symphony-motion.js';

const tr = (key, vars) => t(`demo.symphony.${key}`, vars);
const kinds = ['active', 'assigning', 'assigned', 'returning', 'blocked', 'unblocked', 'handoff', 'retrying', 'waiting', 'completed'];

function syncSessions(teams) {
  for (const team of teams) {
    const active = runtimeRows(team).active;
    for (const { id, slot, role } of SEATS.filter((seat) => seat.team === team.key)) {
      const issue = active.find((row) => row.demo.slot === slot);
      upsertSession({
        id, name: `${role} ${slot + 1}`, agent: 'codex', status: issue ? 'work' : 'rest',
        taskStart: issue ? Date.parse(issue.started_at) : null, lastAt: issue ? Date.parse(issue.last_event_at) : null,
        symphonyMember: team.name, symphonyIssue: issue, subs: [],
      }, false);
      const worker = workers.get(id);
      if (worker?.station === 'desk' && worker.phase !== 'walk' && !worker.chore) worker.anim = issue ? 'type' : 'idle';
    }
  }
  queueUi();
}

function issueList(rows) {
  const list = el('ul', 'symphony-issues');
  for (const issue of rows) {
    const item = el('li'), button = el('button', 'btn btn--sm');
    button.type = 'button';
    button.dataset.issue = issue.issue_identifier;
    button.append(el('small', null, `${TEAMS.find((team) => team.key === issue.demo.team).name} · ${issue.issue_identifier} · ${issue.demo.priority}`),
      el('span', null, taskTitle(issue)));
    if (issue.attempt) button.append(el('small', null, tr('attempt', { n: issue.attempt })));
    item.append(button);
    list.append(item);
  }
  return list;
}

export function startSymphonyDemo() {
  document.body.classList.add('is-symphony');
  $('conn').dataset.state = 'sample';
  $('conn').lastElementChild.textContent = 'Codex';
  $('feed-toggle').querySelector('.act-title').textContent = tr('queue');
  $('live-tag').hidden = true;
  const sidebar = $('sessions-sidebar');
  sidebar.setAttribute('aria-label', tr('runtimes'));
  sidebar.querySelector('h2').textContent = tr('runtimes');
  $('feed').setAttribute('aria-label', tr('queue'));
  for (const [side, label] of [['sessions', tr('runtimes')], ['activity', tr('queue')]]) {
    const toggle = document.querySelector(`[data-sidebar="${side}"]`);
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    document.querySelector(`.ph-tab[data-tab="${side}"] span`).textContent = label;
  }
  state.connectedOnce = true;

  const runtimes = el('ul', 'symphony-runtimes');
  $('rail-list').before(runtimes);
  const panel = el('div', 'symphony-panel');
  const heading = el('p', 'symphony-caption');
  const run = el('button', 'btn btn--sm', tr('rerun'));
  run.type = 'button';
  const reset = el('button', 'btn btn--sm', tr('reset'));
  reset.type = 'button';
  reset.hidden = true;
  const controls = el('div', 'symphony-controls');
  controls.append(run, reset);
  const status = el('p', 'symphony-caption');
  status.setAttribute('role', 'status');
  const progress = el('div', 'symphony-progress');
  const issues = el('div', 'symphony-queues');
  panel.append(heading, controls, status, progress, issues);
  $('feed-stats').before(panel);

  const dialog = el('dialog', 'symphony-task');
  const title = el('h2');
  title.id = 'symphony-task-title';
  dialog.setAttribute('aria-labelledby', title.id);
  const close = el('button', 'btn btn--sm', t('common.close'));
  close.type = 'button';
  close.autofocus = true;
  const header = el('div', 'symphony-task-head'), detail = el('div');
  detail.setAttribute('aria-live', 'polite');
  header.append(title, close);
  dialog.append(header, detail);
  $('app').append(dialog);

  let selectedId, rowsById;
  const taskButton = (id, root = issues) => root.querySelector(`[data-issue="${id}"]`);
  let opener;
  const renderTask = (issue) => {
    title.textContent = `${issue.issue_identifier} · ${taskTitle(issue)}`;
    detail.replaceChildren(renderTaskDetails(issue));
  };
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-issue]');
    if (!button) return;
    selectedId = button.dataset.issue;
    opener = progress.contains(button) ? progress : issues;
    renderTask(rowsById.get(selectedId));
    dialog.showModal();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') event.stopPropagation(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    (taskButton(selectedId, opener) || taskButton(selectedId) || run).focus();
    selectedId = null;
  });

  const render = (step, roomStatus) => {
    const teams = snapshots(step, stepTimes[1], stepTimes, transitions);
    syncSessions(teams);
    heading.replaceChildren(step ? tr('scenario') : tr('snapshot'));
    if (!step) {
      const time = el('time', null, '13:21 · 13/11/2026 · UTC+7');
      time.dateTime = SNAPSHOT_AT;
      heading.append(' · ', time);
    }
    status.textContent = tr(roomStatus || `step${step}`);
    $('active-count').textContent = tr('capacity', { teams: teams.length, members: SEATS.length });
    runtimes.replaceChildren(...teams.map((team) => {
      const { mode } = team.state.runtime_control;
      const row = el('li');
      row.append(el('b', null, team.name), el('span', 'pill', tr(mode)), el('span', 'symphony-seat-count',
        `${runtimeRows(team).active.length}/${team.capacity}`));
      return row;
    }));
    const focused = panel.contains(document.activeElement) && document.activeElement.dataset.issue;
    const focusedIn = progress.contains(document.activeElement) ? progress : issues;
    const queues = teams.map(runtimeRows);
    rowsById = new Map();
    issues.replaceChildren(...kinds.map((kind) => {
      const rows = queues.flatMap((queue) => queue[kind]);
      for (const issue of rows) rowsById.set(issue.issue_identifier, issue);
      const section = el('section');
      section.dataset.queue = kind;
      section.hidden = !rows.length && ['assigning', 'assigned', 'returning', 'unblocked'].includes(kind);
      section.append(el('h3', null, tr(kind)), el('b', 'symphony-count', rows.length));
      if (rows.length) section.append(issueList(rows));
      return section;
    }));
    progress.replaceChildren();
    for (const [id, role, type] of [['OFC-212', 'Project Manager', 'plan'], ['OFC-210', 'Quality Assurance', 'test']]) {
      if (step === 1 && roomStatus) continue;
      const issue = rowsById.get(id);
      const action = issue?.demo.milestones.findLast(({ reached }) => reached)?.action;
      if (!step || !action) continue;
      const label = tr(`workflow.${action}`);
      const button = el('button', 'btn btn--sm');
      button.type = 'button';
      button.dataset.issue = id;
      button.append(el('small', null, role), el('span', null, label));
      progress.append(button);
      const seat = SEATS.find(({ team, slot }) => team === issue.demo.team && slot === issue.demo.slot);
      const w = workers.get(seat.id);
      if (!reduceMotion && w && !w.chore && w.phase !== 'walk' && issue.demo.milestones.some((m) => m.action === action && m.step === step)) {
        w.say(type, label);
        const spoken = w.lastSay;
        later(4, () => { if (w.lastSay === spoken) w.hush(); });
      }
    }
    if (focused) (taskButton(focused, focusedIn) || taskButton(focused))?.focus({ preventScroll: true });
    if (dialog.open) {
      const issue = rowsById.get(selectedId);
      if (issue) renderTask(issue);
      else dialog.close();
    }
  };

  let timer;
  const stepTimes = [];
  const transitions = new Map();
  function play() {
    clearTimeout(timer);
    resetRoomWorkflow();
    stepTimes.length = 0;
    transitions.clear();
    state.symphonyAssignments = [];
    state.symphonyBlocker = '';
    reset.hidden = false;
    function record(ids, step, kind) {
      const at = new Date().toISOString();
      for (const id of ids) {
        if (!transitions.has(id)) transitions.set(id, new Map());
        const events = transitions.get(id);
        if (!events.has(step)) events.set(step, []);
        events.get(step).push({ kind, at });
      }
    }

    function room(step, ids, phases, messages, done, assignments) {
      render(step, messages[0]);
      const stages = { arrived: 1, returning: 2, done: 3 };
      showRoomWorkflow(step, (stage) => {
        const index = stages[stage];
        if (phases[index]) record(ids, step, phases[index]);
        if (stage === 'arrived' && assignments) {
          state.symphonyAssignments = assignments.map(({ id, worker }) => ({ id, name: workers.get(worker).cfg.name }));
        }
        if (!assignments) state.symphonyBlocker = stage === 'arrived' ? 'ownerReview' : 'ownerCleared';
        if (stage === 'done') done();
        else render(step, messages[index]);
      }, assignments);
    }

    function advance(step) {
      stepTimes[step] = Date.now();
      const done = () => {
        render(step);
        timer = step === LAST_STEP ? setTimeout(play, 12_000) : setTimeout(() => advance(step + 1), STEP_MS);
      };
      const assignments = snapshots(step).flatMap((team) => runtimeRows(team).active
        .filter(({ started_at }) => started_at === team.state.generated_at)
        .filter(({ turn_count }) => turn_count === 1)
        .map((issue) => ({ id: issue.issue_identifier, worker: SEATS.find(({ team: key, slot }) => key === team.key && slot === issue.demo.slot).id })));
      if (step === 4) assignments.unshift({ id: 'OFC-207', worker: 'symphony-fe-1' });
      const ids = assignments.map(({ id }) => id);
      if (ids.length) record(ids, step, 'assigning');
      const assign = () => {
        if (ids.length) room(step, ids, ['assigning', 'assigned', 'returning', 'active'], ['meetingStart', 'meetingAssigned', 'meetingReturn'], done, assignments);
        else done();
      };
      if (step === 3) {
        state.symphonyBlocker = 'ownerWait';
        record(['OFC-207'], step, 'blocked');
        room(step, ['OFC-207'], ['blocked', null, 'unblocked'], ['ownerWait', 'ownerReview', 'ownerCleared'], assign);
      } else assign();
    }
    advance(1);
  }
  run.addEventListener('click', play);
  reset.addEventListener('click', () => {
    clearTimeout(timer);
    resetRoomWorkflow();
    state.symphonyAssignments = [];
    state.symphonyBlocker = '';
    reset.hidden = true;
    run.focus();
    render(0);
  });
  play();
  startSymphonyMotion();
}
