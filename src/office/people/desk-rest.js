import { ANIM_AT, verb } from '../ui/event-text.js';
import { t as tr } from '../../i18n/index.js';
import { sessions } from './workers.js';

export const resting = (w) => !w.sub && w.root.parent && !w.leaving && !w.away && !w.homeBound && !w.chore && !w.after && !w.want && w.phase !== 'walk'
  && !w.liftHold && !w.liftWait && !w.inStall && !w.wcBusy && !w.queued && w.anim === 'sleep' && w.station === 'desk'
  && sessions.get(w.id)?.status === 'rest' && !sessions.get(w.id)?.bg?.length;
export const called = (w) => { const s = sessions.get(w.id); return !!w.want || !s || s.status !== 'rest' || !!s.bg?.length; };

export function resume(w) {
  const s = sessions.get(w.id);
  w.station = 'desk';
  if (s?.status === 'wait') { w.anim = 'hand'; w.say('wait', tr('people.needsApproval'), 'wait'); }
  else if (s?.bg?.length) { w.anim = 'think'; w.say('bash', tr('people.bgWait', { desc: s.bg[0].desc })); }
  else if (s?.status === 'work') { w.anim = ANIM_AT.desk; if (s.last) w.say(s.last.type, s.last.label || verb(s.last)); }
  else { w.anim = 'sleep'; w.hush(); }
}
