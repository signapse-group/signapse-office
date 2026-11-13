// The deploy rocket on its launch pad.
import * as THREE from 'three';
import { scene } from '../../scene/renderer.js';
import { canvasTex, cyl, mat, put, rbox } from '../../scene/blocks.js';
import { LAY } from '../layout.js';

export let ROCKET_HOME;
export const ROCKET_SCALE = 3;
const padRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 32), new THREE.MeshBasicMaterial({ color: '#FFD166' }));
export const rocket = new THREE.Group();
export const quotaReset = new THREE.Group();

export function setup() {
  ROCKET_HOME = new THREE.Vector3(LAY.rocket[0], 0.12, LAY.rocket[1]);
  const pad = put(scene, cyl(0.55, 0.6, 0.12, '#3A3F48', 28), ROCKET_HOME.x, 0.06, ROCKET_HOME.z);
  padRing.rotation.x = Math.PI / 2;
   put(scene, padRing, ROCKET_HOME.x, 0.125, ROCKET_HOME.z);
   scene.add(rocket);
   rocket.position.copy(ROCKET_HOME);
  put(rocket, cyl(0.2, 0.22, 0.8, mat('#F7F3EA', { roughness: 0.35, metalness: 0.2 })), 0, 0.55, 0);
  put(rocket, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.38, 20), mat('#E8730E', { roughness: 0.4 })), 0, 1.14, 0).castShadow = true;
  for (let k = 0; k < 3; k++) { const fin = rbox(0.05, 0.32, 0.22, '#C8553D', 0.01); const a = (k * 2 * Math.PI) / 3; fin.position.set(Math.sin(a) * 0.22, 0.26, Math.cos(a) * 0.22); fin.rotation.y = a; rocket.add(fin); }
  put(rocket, new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat('#7EC8E3', { roughness: 0.1, metalness: 0.3 })), 0, 0.7, 0.19);
  rocket.scale.setScalar(ROCKET_SCALE);
  const reach = LAY.box.x1 - ROCKET_HOME.x - 0.05;
  const padScale = Math.min(1.6, reach / 0.6);
  pad.scale.set(padScale, 1, padScale);
  padRing.scale.setScalar(padScale);

  put(scene, quotaReset, ROCKET_HOME.x - 0.1, 0, ROCKET_HOME.z - 3.05);
  quotaReset.userData.noMerge = true;
  put(quotaReset, rbox(1.28, 0.82, 1.08, '#263445', 0.12), 0, 0.41, 0);
  put(quotaReset, cyl(0.70, 0.72, 0.12, '#F7BD54', 32), 0, 0.86, 0);
  put(quotaReset, cyl(0.67, 0.69, 0.23, mat('#D71426', { emissive: '#790711', emissiveIntensity: 0.65 }), 32), 0, 1.02, 0);
  const label = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#fff';
    g.font = '900 113px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('RESET', w / 2, h * 0.29);
    g.fillText('QUOTA', w / 2, h * 0.71);
  });
  const face = put(quotaReset, new THREE.Mesh(new THREE.PlaneGeometry(1.19, 0.86), new THREE.MeshBasicMaterial({ map: label, transparent: true, toneMapped: false })), 0, 1.137, 0);
  face.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
}
