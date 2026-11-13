// The static city and the office's day/night cycle.
import * as THREE from 'three';
import { state } from '../core/state.js';
import { scene } from '../scene/renderer.js';
import { buildCity } from './backdrops/city.js';
import { isNightHour, night, setNight } from './room-update.js';

export let city;

export function setup() {
  const group = new THREE.Group();
  group.name = 'city';
  group.userData.noMerge = group.userData.noCollide = true;
  scene.add(group);
  city = buildCity(group);

  setNight(state.nightManual ? night : isNightHour());
  setInterval(() => {
    if (!state.nightManual && night !== isNightHour()) setNight(isNightHour());
    else city.refresh();
  }, 1000);
}
