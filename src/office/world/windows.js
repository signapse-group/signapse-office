// Windows on the outer walls and the views they show.
import * as THREE from 'three';
import { PRO, rand } from '../core/env.js';
import { scene } from '../scene/renderer.js';
import { canvasTex, noOutline, put, rbox } from '../scene/blocks.js';
import { potPlant } from './terrace.js';

/* panoramic window with a city skyline (day / night) */
function cityTex(nightMode) {
  return canvasTex(1024, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (nightMode) { sky.addColorStop(0, '#0A1430'); sky.addColorStop(1, '#2A3A66'); } else { sky.addColorStop(0, '#8EC8F2'); sky.addColorStop(1, '#DCEFFB'); }
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    if (nightMode) {
      g.fillStyle = '#FFF3C4'; g.beginPath(); g.arc(w * 0.78, h * 0.2, 26, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${rand(0.3, 0.85)})`; g.fillRect(rand(0, w), rand(0, h * 0.45), 2, 2); }
    } else {
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (const [cx, cy, r] of [[200, 90, 40], [250, 80, 50], [300, 95, 36], [700, 130, 34], [745, 120, 44], [790, 132, 30]]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
    }
    for (const layer of [0, 1]) {
      let x = -20;
      while (x < w) {
        const bw = rand(50, 120), bh = rand(h * (layer ? 0.22 : 0.42), h * (layer ? 0.52 : 0.82));
        g.fillStyle = nightMode ? (layer ? '#111827' : '#1A2340') : (layer ? '#8FA3B8' : '#B2C2D2');
        g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 12; wy < h - 10; wy += 18) for (let wx = x + 8; wx < x + bw - 10; wx += 14) {
          const lit = Math.random() < (nightMode ? 0.42 : 0.12);
          g.fillStyle = nightMode ? (lit ? '#FFD27A' : 'rgba(255,255,255,.05)') : (lit ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.2)');
          g.fillRect(wx, wy, 7, 9);
        }
        x += bw + rand(4, 18);
      }
    }
  });
}
export let cityDay;
export let cityNight;
export let glassM;
// A window on an outer wall: frame, the view, mullions, a sill. (x, y, z) is the centre of the glass; ry turns it.
export function wallWindow(x, y, z, w, h, ry = 0, panes = 3) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
  put(g, rbox(w + 0.2, h + 0.2, 0.12, '#2F343E', 0.03), 0, 0, 0);
  put(g, new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassM), 0, 0, 0.065);
  for (let i = 1; i < panes; i++) put(g, rbox(0.06, h, 0.06, '#2F343E', 0.02), -w / 2 + (i * w) / panes, 0, 0.09);
  put(g, rbox(w, 0.06, 0.06, '#2F343E', 0.02), 0, h * 0.18, 0.09);
  put(g, rbox(w + 0.4, 0.1, 0.36, '#7A5A3E', 0.03), 0, -h / 2 - 0.12, 0.14);
  // a roller blind, rolled up out of sight until the midday nap pulls it down (life/nap.js)
  const blind = new THREE.Group(); blind.position.set(0, h / 2 + 0.06, 0.15); blind.visible = false; blind.userData.dynamic = true; g.add(blind);
  put(blind, rbox(w + 0.16, 0.09, 0.09, '#D9CDB4', 0.04), 0, 0, 0);
  const cloth = put(blind, new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, h + 0.1).translate(0, -(h + 0.1) / 2, 0), blindM), 0, 0, 0.01);
  cloth.scale.y = 0.001; cloth.receiveShadow = true;
  blinds.push({ blind, cloth });
  return g;
}
export const blinds = [];
let blindM;

export function setup() {
  cityDay = cityTex(false); cityNight = cityTex(true);
  glassM = noOutline(new THREE.MeshBasicMaterial({ map: cityDay }));   // every window shows the backdrop
  // the blinds' fabric: warm linen with faint horizontal ribs and a darker hem
  blindM = noOutline(new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide, map: canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#EDE3CC'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(120,96,60,.10)'; g.fillRect(0, y, w, 2); }
    g.fillStyle = '#B9A47E'; g.fillRect(0, h - 6, w, 6);
  }) }));
  if (!PRO) {
    wallWindow(0.9, 2.35, -5.98, 4.4, 2.3);
    potPlant(1.9, -5.82, 0.42, 'bush', 1.13);
    potPlant(-0.2, -5.82, 0.38, 'snake', 1.13);
  }
}
