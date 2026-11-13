import { el } from '../core/env.js';
import { locale, t } from '../../i18n/index.js';
import { TEAMS } from './symphony-state.js';

const tr = (key, vars) => t(`demo.symphony.${key}`, vars);
const copy = (id) => t(`demo.symphony.issues.${id}`, null, 'list');
export const taskTitle = (issue) => copy(issue.issue_identifier)[0];

export function renderTaskDetails(issue) {
  const { team, priority, kind, history, dependency, reportedBy, milestones } = issue.demo;
  const [, description, ...criteria] = copy(issue.issue_identifier);
  const formatter = new Intl.DateTimeFormat(locale(), {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const clock = (at) => formatter.format(new Date(at));
  const details = el('div', 'symphony-task-details');
  details.append(el('p', 'symphony-caption', `${TEAMS.find(({ key }) => key === team).name} · ${priority} · ${tr(kind)}`), el('p', null, description));
  if (issue.state) details.append(el('p', null, tr('tracker', { state: issue.state })));
  if (issue.turn_count) details.append(el('p', null, tr('turn', { n: issue.turn_count })));
  if (dependency) details.append(el('p', null, tr('dependency', { id: dependency })));
  if (kind === 'blocked') details.append(el('p', null, t('demo.symphony.rooms.blockOwner')));
  if (reportedBy) {
    details.append(el('p', null, tr('reportedBy', { id: reportedBy })));
    const repro = el('ol');
    for (const line of t('demo.symphony.bugReport.repro', null, 'list')) repro.append(el('li', null, line));
    details.append(el('h3', null, t('demo.symphony.bugReport.heading')), repro);
    for (const key of ['actual', 'expected', 'evidence']) details.append(el('p', null, tr(`bugReport.${key}`)));
  }
  if (milestones.length) {
    const list = el('ol', 'symphony-workflow');
    const current = milestones.findLast(({ reached }) => reached);
    for (const milestone of milestones) {
      const item = el('li');
      item.dataset.reached = String(milestone.reached);
      if (milestone === current) item.setAttribute('aria-current', 'step');
      item.append(el('b', null, tr(`workflow.${milestone.action}`)));
      if (milestone.reached) item.append(el('p', null, tr(`workflowDetails.${milestone.action}`)));
      list.append(item);
    }
    details.append(el('h3', null, tr('workflowHeading')), list);
  }
  const error = issue.error || issue.handoff_error;
  if (error) details.append(el('p', null, tr(`errors.${error}`)));
  if (issue.attempt) details.append(el('p', null, tr('attempt', { n: issue.attempt })));
  if (issue.due_at) details.append(el('p', null, tr('due', { time: clock(issue.due_at) })));
  const checklist = el('ul');
  checklist.append(...criteria.map((item) => el('li', null, item)));
  const activity = el('ol');
  for (const event of history) {
    const item = el('li'), time = el('time', null, clock(event.at));
    time.dateTime = event.at;
    item.append(time, ' · ', tr(event.kind));
    activity.append(item);
  }
  details.append(el('h3', null, tr('criteria')), checklist, el('h3', null, `${tr('history')} · UTC+7`), activity);
  return details;
}
