import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import typeface from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { PRO } from '../../core/env.js';
import { mat, noOutline, put, rbox } from '../../scene/blocks.js';
import { scene } from '../../scene/renderer.js';
import { LOGO_URL, OFFICE_TAGLINE } from '../../../shared/brand.js';

const navy = '#082D43';
const teal = '#007568';

function raisedText(font, text, size, depth, maxWidth, material) {
  const geometry = new TextGeometry(text, { font, size, height: depth, curveSegments: 6 });
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const width = max.x - min.x;
  const scale = Math.min(1, maxWidth / width);
  geometry.translate(-width / 2 - min.x, -min.y, 0);
  geometry.scale(scale, scale, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = text;
  mesh.castShadow = true;
  return mesh;
}

function logoStroke(points, style, depth, masked) {
  const outside = (point) => masked.every(({ x, y, r }) => Math.hypot(point.x - x, point.y - y) >= r + style.strokeWidth / 2);
  const start = points.findIndex(outside);
  const end = points.findLastIndex(outside);
  if (start < 0 || start === end) return null;
  const front = SVGLoader.pointsToStroke(points.slice(start, end + 1), style, 8);
  if (!front) return null;
  const edges = new THREE.EdgesGeometry(front);
  const corners = edges.getAttribute('position');
  const rim = [];
  for (let i = 0; i < corners.count; i += 2) {
    const ax = corners.getX(i), ay = corners.getY(i);
    const bx = corners.getX(i + 1), by = corners.getY(i + 1);
    rim.push(ax, ay, 0, bx, by, 0, bx, by, depth, ax, ay, 0, bx, by, depth, ax, ay, depth);
  }
  edges.dispose();
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3));
  side.computeVertexNormals();
  front.translate(0, 0, depth);
  return { front, side };
}

function addLogo(parent, x, y, size, depth, faceMaterials) {
  const logo = new THREE.Group();
  logo.name = 'Signapse emblem';
  put(parent, logo, x, y, 0);
  new SVGLoader().load(LOGO_URL, ({ paths, xml }) => {
    const [left, top, width, height] = xml.getAttribute('viewBox').split(/\s+/).map(Number);
    const scale = size / width;
    const mask = [...xml.querySelectorAll('mask circle')].map((node) => ({
      x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')), r: Number(node.getAttribute('r')),
    }));
    logo.scale.set(scale, -scale, scale);
    logo.position.x -= (left + width / 2) * scale;
    logo.position.y += (top + height / 2) * scale;
    const raisedDepth = depth / scale;
    for (const path of paths) {
      const { node, style } = path.userData;
      const index = (node.getAttribute('stroke') || node.getAttribute('fill')) === '#eafdf8' ? 1 : 0;
      const [face, edge] = faceMaterials[index];
      if (node.getAttribute('fill') === 'none' || node.getAttribute('fill') === 'transparent') {
        // shortcut: the Signapse mask only trims stroke ends; general SVG masks need polygon clipping.
        const stroke = logoStroke(path.subPaths[0].getPoints(40), style, raisedDepth, node.localName === 'path' ? mask : []);
        if (!stroke) continue;
        const front = new THREE.Mesh(stroke.front, face);
        const side = new THREE.Mesh(stroke.side, edge);
        front.castShadow = side.castShadow = true;
        logo.add(front, side);
      } else {
        const geometry = new THREE.ExtrudeGeometry(SVGLoader.createShapes(path), { depth: raisedDepth, bevelEnabled: false, curveSegments: 12 });
        const dot = new THREE.Mesh(geometry, [face, edge]);
        dot.castShadow = true;
        logo.add(dot);
      }
    }
  });
}

export function addMeetingBrand() {
  const wall = new THREE.Group();
  wall.name = 'Signapse meeting room lettering';
  wall.position.set(PRO ? 0.2 : 5.2, PRO ? 1.9 : 2.95, PRO ? -7.969 : -0.159);
  wall.userData.noMerge = true;
  scene.add(wall);
  if (!PRO) {
    const plaster = mat('#F1E6D2', { roughness: 0.9 });
    put(scene, rbox(5, 2.2, 0.3, plaster, 0.025), 5.2, 3.1, -0.31);
    for (const x of [2.85, 7.55]) {
      put(scene, rbox(0.3, 2.03, 0.3, plaster, 0.025), x, 1.015, -0.31);
    }
  }
  const headline = noOutline(mat(navy, { emissive: navy, emissiveIntensity: 0.6 }));
  const tagline = noOutline(mat(teal, { emissive: teal, emissiveIntensity: 0.6 }));
  const font = new FontLoader().parse(typeface);
  const width = PRO ? 4.75 : 4.1;
  put(wall, raisedText(font, 'SIGNAPSE', 0.64, 0.055, width - 0.9, headline), 0, -0.3, 0);
  const [firstLine, secondLine] = OFFICE_TAGLINE.split(' & ');
  for (const [index, line] of [`${firstLine} &`, secondLine].entries()) {
    put(wall, raisedText(font, line, 0.29, 0.045, width, tagline), 0, -0.93 - index * 0.32, 0);
  }
  const colors = [['#008775', '#00483F'], [navy, '#031824']];
  const materials = colors.map(([face, edge]) => [
    noOutline(mat(face, { side: THREE.DoubleSide, emissive: face, emissiveIntensity: 0.6 })),
    noOutline(mat(edge, { side: THREE.DoubleSide })),
  ]);
  addLogo(wall, 0, 1.32, 1.13, 0.04, materials);
}
