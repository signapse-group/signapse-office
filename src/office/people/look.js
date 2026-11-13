// Which character look (A / B) this viewer chose.
import { state } from '../core/state.js';

export function setup() {
  /* ---------- chibi ---------- */
  // Characters come from /assets/chibi.js (two looks on one rig). The look is each viewer's own choice.
  state.LOOK = 'toy';
  try { if (localStorage.getItem('office-look') === 'pixar') state.LOOK = 'pixar'; } catch { /* storage blocked */ }
}
