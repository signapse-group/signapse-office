import { LOGO_URL } from '../../shared/brand.js';
import { canvasTex } from './blocks.js';

let mark;

export function drawOfficeLogo(g, x, y, size) {
  if (mark?.naturalWidth) g.drawImage(mark, x, y, size, size);
}

export function brandedTexture(width, height, draw) {
  mark ||= Object.assign(new Image(), { src: LOGO_URL });
  const texture = canvasTex(width, height, draw);
  if (!mark.naturalWidth) mark.addEventListener('load', () => {
    draw(texture.image.getContext('2d'), width, height);
    texture.needsUpdate = true;
  }, { once: true });
  return texture;
}
