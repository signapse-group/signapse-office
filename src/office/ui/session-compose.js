// The compose controls in the fictional Claude demo.
import { state } from '../core/state.js';
import { el } from '../core/env.js';
import { icon } from './icons.js';
import { toast } from './activity.js';
import { dictate, shrink } from './task-sheet.js';
import { dn, sessions } from '../people/workers.js';
import { t as tr } from '../../i18n/index.js';

let root, input, sendBtn, photoEl, fileEl, micBtn, stopMic = null, images = [];

export const composeHeight = () => (root && !root.hidden ? root.offsetHeight : 0);
const phone = () => document.documentElement.classList.contains('is-phone');

export function setupCompose(host) {
  root = el('form', 'ds-compose'); root.id = 'ds-compose'; root.hidden = true;
  photoEl = el('div', 'ds-cmp-photos'); photoEl.hidden = true;
  const row = el('div', 'ds-cmp-row');
  fileEl = el('input'); fileEl.type = 'file'; fileEl.accept = 'image/*'; fileEl.multiple = true; fileEl.hidden = true;
  const pic = el('button', 'ds-cmp-ib'); pic.type = 'button'; pic.title = tr('chat.task.photo'); pic.setAttribute('aria-label', tr('chat.task.photo')); pic.append(icon('image'));
  pic.addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', async () => {
    for (const f of [...fileEl.files].slice(0, 4 - images.length)) { try { images.push(await shrink(f)); } catch { toast(tr('drawer.compose.badPhoto')); } }
    fileEl.value = ''; drawPhotos(); sync();
  });
  input = el('textarea', 'ds-cmp-in'); input.rows = 1; input.maxLength = 4000; input.enterKeyHint = 'send';
  input.addEventListener('input', () => { grow(); sync(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && (e.metaKey || e.ctrlKey || (!e.shiftKey && !phone()))) { e.preventDefault(); submit(); } });
  micBtn = el('button', 'ds-cmp-ib'); micBtn.type = 'button'; micBtn.title = tr('chat.task.mic'); micBtn.setAttribute('aria-label', tr('chat.task.mic')); micBtn.setAttribute('aria-pressed', 'false'); micBtn.append(icon('mic'));
  micBtn.addEventListener('click', () => { if (stopMic) { stopMic(); stopMic = null; return; } stopMic = dictate(micBtn, input, () => { grow(); sync(); }); });
  sendBtn = el('button', 'ds-cmp-send'); sendBtn.type = 'submit'; sendBtn.title = tr('drawer.compose.send'); sendBtn.setAttribute('aria-label', tr('drawer.compose.send')); sendBtn.append(icon('send'));
  row.append(pic, fileEl, input, micBtn, sendBtn);
  root.append(photoEl, row);
  root.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  host.append(root);
}
const grow = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; };
function sync() { sendBtn.disabled = !(input.value.trim() || images.length); }
function drawPhotos() {
  photoEl.hidden = !images.length; photoEl.replaceChildren();
  images.forEach((src, i) => {
    const b = el('button', 'ds-cmp-ph'); b.type = 'button'; b.title = tr('drawer.compose.dropPhoto'); const im = el('img'); im.src = src; im.alt = ''; b.append(im);
    b.addEventListener('click', () => { images.splice(i, 1); drawPhotos(); sync(); }); photoEl.append(b);
  });
}
function submit() {
  if (sessions.has(state.selectedId) && !sendBtn.disabled) toast(tr('drawer.compose.demo'));
}

export function renderCompose() {
  const s = sessions.get(state.selectedId);
  root.hidden = !s;
  if (!s) return;
  drawPhotos();
  input.placeholder = tr('chat.to.placeholder', { name: dn(s) });
  sync();
}
