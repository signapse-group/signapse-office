// Browser input helpers for demo chat and session forms.
import { toast } from './activity.js';
import { t as tr, locale } from '../../i18n/index.js';

/* ---------- speaking instead of typing: the browser's speech recognition, in the office's language ---------- */
const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canDictate = () => !!SR && window.isSecureContext;
/** 🎤 on a button: speak, and the words go into the field as they come; again to stop. -> stop() */
export function dictate(btn, field, onChange) {
  if (!canDictate()) { toast(tr('chat.task.noMic'), 6000); return null; }
  const rec = new SR(), start = field.value, sep = start && !/\s$/.test(start) ? ' ' : '';
  rec.lang = locale() === 'vi-VN' ? 'vi-VN' : 'en-US'; rec.interimResults = true; rec.continuous = true;
  let done = '';
  rec.onresult = (e) => {
    let live = '';
    for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) done += e.results[i][0].transcript; else live += e.results[i][0].transcript; }
    field.value = `${start}${sep}${done}${live}`.slice(0, 4000); onChange?.();
  };
  const end = () => { btn.classList.remove('is-rec'); btn.setAttribute('aria-pressed', 'false'); };
  rec.onend = end; rec.onerror = (e) => { end(); if (e.error === 'not-allowed') toast(tr('chat.task.micBlocked'), 6000); };
  try { rec.start(); } catch { end(); return null; }
  btn.classList.add('is-rec'); btn.setAttribute('aria-pressed', 'true');
  return () => { try { rec.stop(); } catch { /* stopped */ } end(); };
}

/* ---------- photos: made smaller here (1600 px, JPEG) so they go quickly over a phone's connection ---------- */
export async function shrink(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  let url = c.toDataURL('image/jpeg', 0.82);
  if (url.length > 480_000) url = c.toDataURL('image/jpeg', 0.6);   // (under what the group chat shows too)
  return url;
}

