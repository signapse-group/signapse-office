// Street-facing stores. Their fittings, signs and lighting are retained without ambient activity.
import * as THREE from 'three';
import { HQ, PRO, officeNow } from '../../core/env.js';
import { GY, boxAt, colorize, mergeAll, vmat } from '../terrace.js';
import { wx } from '../../life/weather.js';
import { quality } from '../../scene/quality.js';
import { sfx } from '../../audio/sfx.js';
import { RM, drawMixue, fitMixue, snowKing } from './shop-mixue.js';
import { HIGHLANDS } from './shop-highlands.js';
import { TGDD } from './shop-tgdd.js';
import { KATINAT } from './shop-katinat.js';
import { PHUCLONG } from './shop-phuclong.js';
import { LONGCHAU } from './shop-longchau.js';
import { DMX } from './shop-dmx.js';
import { CONG } from './shop-cong.js';
import { figure, glassOver } from './shop-paint.js';
// the shops made whole in a file of their own (their printing, fittings, front and people; and `paint`, how the front looks
// when it is too far to walk into: paint(g, cx, cy, dark) the whole cell, its sign and the picture under it, or
// paint(g, x, y, w, h, dark) only the picture, in the front's rect, under the sign its draw() makes): chain key -> that module
const CUSTOM = { highlands: HIGHLANDS, tgdd: TGDD, katinat: KATINAT, phuclong: PHUCLONG, longchau: LONGCHAU, dmx: DMX, cong: CONG };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const SHOPS = 12, SHOP_W = 6.6, SHOP_CEIL = 2.75;   // how many, a shop's width and its ceiling (metres)
/* How many of the chains, the nearest the office, are rooms you can walk into; the ones further off are their sign and a
   picture of the inside behind the glass (as the eateries are), with no fittings and no people to step. Measured (Oct 2026,
   'low' quality, 390 × 844 at 2×, Ho Chi Minh City's twelve chains at 19:30): up to 8 rooms cost next to nothing more than
   none, as the nearest fronts are round the office and only one or two are in sight at a time; the 9th to 12th are the
   ones in the long views, and as rooms they add 11% to the triangles on the pavement (761k against 675k), 3% from the
   office's view, and half again to the street's time each frame (0.6 ms against 0.4; with the CPU slowed 4×, 1.4 against
   1.2, and the picture's 5.4 ms against 4.8). Ten in Ho Chi Minh City since 2/11/2026 (WALK_INS_AT), so that Bách Hóa
   Xanh and Điện Máy Xanh could come to the office's door there with every room there was before still a room (not
   measured again: about half the four's cost, by the numbers above); the other cities keep their eight, so a chain with
   one shop in town stays painted further down. ?debug&walkins=N tries another number. */
const WALK_INS = 8, WALK_INS_AT = { hcm: 10 };
export const shopDepth = (deep) => Math.min(5.0, deep - 1.4);   // how far in a shop goes, in a building `deep` deep
const FL = 0.12, GLASS = 2.42, SIGN_H_M = 0.9, DOOR = 0.82;      // the floor (level with the pavement), the glass's top, the sign, half the door
const FRAME = '#4A515B';   // the glass fronts' frames
/* what each city has, front-most first (the first WALK_INS chains are the rooms you walk into, so the ones people go to
   come first). Oct 2026: GS25, Circle K, 7-Eleven and Ministop in Ho Chi Minh City; Circle K, GS25 and WinMart+ in Hanoi;
   WinMart+ everywhere; Bách Hóa Xanh in the south; none of the foreign chains confirmed in Đà Nẵng; Mixue everywhere, 4–6
   to a kilometre in the big cities, so one near the office in each; Highlands Coffee and Thế Giới Di Động in every city
   too. Long Châu in all 34 provinces, 2,700 of them: one near the office everywhere, often a second down the street.
   Phúc Long's own shops in Ho Chi Minh City, Hanoi, Đà Nẵng, Nha Trang, Đà Lạt, Cần Thơ and Hải Phòng (in Huế only
   inside the mall). Katinat in Ho Chi Minh City (most of its ~93), Hanoi since 2022, Cần Thơ and Đà Lạt. Điện Máy Xanh
   (the same group's appliance chain as Thế Giới Di Động) in every province: in the smaller cities in a front that was to
   let. Cộng Cà Phê (its store list, Nov 2026): 26 in Hà Nội, 21 in Ho Chi Minh City, 4 in Đà Nẵng, 4 in Khánh Hòa (Nha
   Trang), one each in Hải Phòng, Huế and Đà Lạt, none in Cần Thơ: a room where there are many, further down the street
   (painted) where there is one; in Hà Nội it takes WinMart+'s room. In Ho Chi Minh City (the
   office's city until you pick one) Bách Hóa Xanh and Điện Máy Xanh are right by the office, rooms you walk into (asked
   for, 2/11/2026: neither was in sight, Bách Hóa Xanh not on the street at all), Cộng in Circle K's room (Circle K
   painted there, GS25 the 24-hour room), and no Ministop. 'rent': a shuttered front to let. */
const SETS = {
  hcm: ['gs25', 'mixue', 'bhx', 'dmx', 'highlands', 'tgdd', 'cong', 'longchau', 'phuclong', 'katinat', 'circlek', 'seven'],
  hn: ['circlek', 'mixue', 'highlands', 'cong', 'tgdd', 'longchau', 'phuclong', 'katinat', 'gs25', 'pho', 'dmx', 'buncha'],
  hp: ['winmart', 'mixue', 'highlands', 'tgdd', 'longchau', 'phuclong', 'banhdacua', 'circlek', 'dmx', 'cong', 'haisan', 'longchau'],
  dn: ['winmart', 'mixue', 'highlands', 'tgdd', 'longchau', 'phuclong', 'miquang', 'haisan', 'dmx', 'cong', 'banhxeo', 'longchau'],
  hue: ['winmart', 'mixue', 'highlands', 'tgdd', 'longchau', 'bunbo', 'comhen', 'dmx', 'winmart', 'banhxeo', 'longchau', 'cong'],
  nt: ['winmart', 'mixue', 'highlands', 'tgdd', 'longchau', 'phuclong', 'bunchaca', 'haisan', 'dmx', 'cong', 'banhxeo', 'longchau'],
  dl: ['winmart', 'mixue', 'highlands', 'tgdd', 'longchau', 'phuclong', 'katinat', 'banhcan', 'suadau', 'dmx', 'cong', 'banhxeo'],
  ct: ['bhx', 'mixue', 'highlands', 'tgdd', 'longchau', 'phuclong', 'katinat', 'winmart', 'hutieu', 'laumam', 'dmx', 'bhx'],
};
/* the chains: logo, the sign (face, stripes), the staff's shirt, opening hours (null: day and night), a window counter to
   sit at, and the three things you can take: from the fridges, from the chain's own corner (`side`), at the till (`hot`).
   Prices in thousands of đồng, about what they are. */
const CHAINS = {
  circlek: { name: 'Circle K', logo: 'circle-k.svg', crop: [0.946, 1], stripes: ['#E21F26', '#F39C1F'], accent: '#E21F26', shirt: '#D7262E', hours: null, seats: true,
    fridge: { id: 'peachTea', price: 20, carry: 'cup' }, side: { id: 'noodle', price: 12, carry: 'noodle', unit: 'noodles' }, hot: { id: 'sausage', price: 15, carry: 'cup', unit: 'grill' } },
  gs25: { name: 'GS25', logo: 'gs25.svg', stripes: ['#0068B7', '#2BB8E6'], accent: '#0068B7', shirt: '#1F5FA8', hours: null, seats: true, outdoor: true,
    fridge: { id: 'bananaMilk', price: 28, carry: 'cup' }, side: { id: 'ramyeon', price: 29, carry: 'noodle', unit: 'ramyeon' }, hot: { id: 'tok', price: 35, carry: 'tok', unit: 'tok' } },
  seven: { name: '7-Eleven', logo: '7-eleven.svg', stripes: ['#F58220', '#008163', '#EE2526'], accent: '#008163', shirt: '#0E7A5C', hours: null, seats: true,
    fridge: { id: 'coffee', price: 20, carry: 'cup' }, side: { id: 'onigiri', price: 17, carry: 'onigiri', unit: 'chiller' }, hot: { id: 'bun', price: 19, carry: 'bun', unit: 'steamer' } },
  ministop: { name: 'Ministop', logo: 'ministop.svg', stripes: ['#003894', '#FFD200', '#E60012'], accent: '#003894', shirt: '#1E3F8F', hours: null, seats: true,
    fridge: { id: 'water', price: 8, carry: 'cup' }, side: { id: 'cone', price: 10, carry: 'cone', unit: 'softserve' }, hot: { id: 'chicken', price: 25, carry: 'chicken', unit: 'fryer' } },
  winmart: { name: 'WinMart+', logo: 'winmart.png', crop: [0.92, 0.7], plus: true, stripes: ['#E21B2A'], accent: '#E21B2A', shirt: '#D21F2C', hours: [6, 22], seats: false,
    fridge: { id: 'milk', price: 32, carry: 'grocery' }, side: { id: 'veg', price: 12, carry: 'grocery', unit: 'produce' }, hot: null },
  // (an ice cream and tea shop, not a store: its own printing, fittings and people, shop-mixue.js)
  mixue: { name: 'Mixue', parlour: true, face: '#E50914', stripes: ['#E50914'], accent: '#E50914', shirt: '#1E1E1E', hours: [9, 22], seats: true },
  highlands: { ...HIGHLANDS.chain, custom: 'highlands' }, tgdd: { ...TGDD.chain, custom: 'tgdd' },
  katinat: { ...KATINAT.chain, custom: 'katinat' }, phuclong: { ...PHUCLONG.chain, custom: 'phuclong' }, longchau: { ...LONGCHAU.chain, custom: 'longchau' },
  dmx: { ...DMX.chain, custom: 'dmx' }, cong: { ...CONG.chain, custom: 'cong' },
  bhx: { name: 'Bách Hóa Xanh', logo: 'bach-hoa-xanh.png', face: '#008C44', stripes: ['#FFE600', '#008C44'], accent: '#008C44', shirt: '#0B8A43', hours: [6.5, 21.5], seats: false,
    fridge: { id: 'eggs', price: 30, carry: 'grocery' }, side: { id: 'meat', price: 65, carry: 'grocery', unit: 'meat' }, hot: null },
};
const isOpen = (c, h) => !c.hours || (h >= c.hours[0] && h < c.hours[1]);
// the posters on the glass and the menu over the till (the shop's own words, in Vietnamese as on any shop there)
const PROMO = {
  circlek: [['MÌ LY', '+ TRÀ ĐÀO', '25K', '#E21F26'], ['XÚC XÍCH', 'NƯỚNG', '15K', '#F39C1F']],
  gs25: [['TOKBOKKI', 'CHẢ CÁ', '35K', '#C8261B'], ['MÌ HÀN', 'NẤU MÁY', '29K', '#0068B7']],
  seven: [['ONIGIRI', 'CƠM NẮM', '17K', '#008163'], ['BÁNH BAO', 'NÓNG HỔI', '19K', '#F58220']],
  ministop: [['KEM TƯƠI', 'ỐC QUẾ', '10K', '#003894'], ['GÀ RÁN', 'GIÒN TAN', '25K', '#E60012']],
  winmart: [['GIÁ TỐT', 'MỖI NGÀY', '-20%', '#E21B2A'], ['RAU CỦ', 'TƯƠI MỚI', '9K', '#2E9E4A']],
  bhx: [['RAU TƯƠI', 'MỖI NGÀY', '9K', '#008C44'], ['THỊT CÁ', 'TƯƠI SỐNG', '-15%', '#E8A100']],
};
const MENU = {
  circlek: ['MÓN NÓNG', [['Mì ly', '12K'], ['Xúc xích nướng', '15K'], ['Bánh bao', '15K'], ['Trà đào', '20K']]],
  gs25: ['MÓN HÀN', [['Tokbokki chả cá', '35K'], ['Chả cá xiên', '12K'], ['Mì Hàn nấu máy', '29K'], ['Kimbap', '25K']]],
  seven: ['MÓN NGON', [['Cơm hộp', '35K'], ['Onigiri', '17K'], ['Bánh bao', '19K'], ['Cà phê', '20K']]],
  ministop: ['MÓN NÓNG', [['Gà rán', '25K'], ['Khoai tây chiên', '15K'], ['Kem tươi', '10K'], ['Xúc xích', '15K']]],
  winmart: ['GIÁ HÔM NAY', [['Trứng gà (10)', '32K'], ['Sữa tươi 1L', '32K'], ['Rau muống', '12K'], ['Gạo 5kg', '120K']]],
  bhx: ['GIÁ HÔM NAY', [['Thịt heo (kg)', '135K'], ['Cá basa (kg)', '70K'], ['Rau cải', '10K'], ['Trứng gà (10)', '30K']]],
};
// local food: a painted signboard (no brand: the dish and the town), and what the shop front shows
const EATS = {
  miquang: { title: 'MÌ QUẢNG', sub: 'ĐẶC SẢN QUẢNG NAM – ĐÀ NẴNG', bg: '#B3121E', fg: '#FFD400', kind: 'noodle', menu: ['Mì Quảng gà', 'Mì Quảng tôm thịt', 'Mì Quảng cá lóc', 'Bánh tráng'] },
  haisan: { title: 'HẢI SẢN', sub: 'TƯƠI SỐNG MỖI NGÀY', bg: '#0B4F8A', fg: '#FFE45C', kind: 'seafood' },
  bunbo: { title: 'BÚN BÒ HUẾ', sub: 'GIÒ HEO – CHẢ CUA', bg: '#B3121E', fg: '#FFFFFF', kind: 'noodle', menu: ['Bún bò giò', 'Bún bò tái', 'Bún bò đặc biệt', 'Chả cua'] },
  comhen: { title: 'CƠM HẾN', sub: 'BÚN HẾN – HẾN XÚC BÁNH TRÁNG', bg: '#1F6F3B', fg: '#FFF2A8', kind: 'noodle', menu: ['Cơm hến', 'Bún hến', 'Hến xúc bánh tráng', 'Chè'] },
  bunchaca: { title: 'BÚN CHẢ CÁ', sub: 'ĐẶC SẢN NHA TRANG', bg: '#0B4F8A', fg: '#FFFFFF', kind: 'noodle', menu: ['Bún chả cá', 'Bún sứa', 'Bánh canh chả cá', 'Nem nướng'] },
  banhcan: { title: 'BÁNH CĂN', sub: 'ĐÀ LẠT', bg: '#7A3B12', fg: '#FFE7A8', kind: 'noodle', menu: ['Bánh căn trứng', 'Bánh căn mực', 'Bánh căn thập cẩm', 'Xíu mại'] },
  suadau: { title: 'SỮA ĐẬU NÀNH', sub: 'NÓNG – BÁNH NGỌT', bg: '#2F6B3A', fg: '#FFFFFF', kind: 'drink', menu: ['Sữa đậu nành', 'Sữa bắp', 'Sữa đậu xanh', 'Bánh bông lan'] },
  banhdacua: { title: 'BÁNH ĐA CUA', sub: 'ĐẶC SẢN HẢI PHÒNG', bg: '#A0281C', fg: '#FFE45C', kind: 'noodle', menu: ['Bánh đa cua', 'Bánh đa cua chả lá lốt', 'Bánh mì cay', 'Nem cua bể'] },
  hutieu: { title: 'HỦ TIẾU', sub: 'CÁI RĂNG – CẦN THƠ', bg: '#B3121E', fg: '#FFFFFF', kind: 'noodle', menu: ['Hủ tiếu nam vang', 'Hủ tiếu khô', 'Hủ tiếu bò kho', 'Bánh lọt'] },
  laumam: { title: 'LẨU MẮM', sub: 'MIỀN TÂY', bg: '#5C2E7E', fg: '#FFE45C', kind: 'noodle', menu: ['Lẩu mắm', 'Cá linh kho', 'Bông điên điển', 'Rau đồng'] },
  pho: { title: 'PHỞ BÒ', sub: 'GIA TRUYỀN – TÁI CHÍN NẠM', bg: '#7A1F12', fg: '#FFE7A8', kind: 'noodle', menu: ['Phở tái', 'Phở chín', 'Phở tái nạm', 'Quẩy'] },
  buncha: { title: 'BÚN CHẢ', sub: 'HÀ NỘI – NEM CUA BỂ', bg: '#2B4A1E', fg: '#FFE45C', kind: 'noodle', menu: ['Bún chả', 'Nem cua bể', 'Bún chả nem', 'Trà đá'] },
  banhxeo: { title: 'BÁNH XÈO', sub: 'NÓNG GIÒN – RAU RỪNG', bg: '#B8620F', fg: '#FFFFFF', kind: 'noodle', menu: ['Bánh xèo tôm', 'Bánh xèo mực', 'Nem lụi', 'Bánh khọt'] },
};
const cityKey = () => (SETS[wx.city] ? wx.city : 'hcm');
const hourNow = () => { const d = officeNow(); return d.getHours() + d.getMinutes() / 60; };

// the office's middle on the floor plan (street-life.js weighs the traffic by it too)
export const officeMiddle = () => (HQ ? [3, 9] : PRO ? [3, 0.7] : [0, 0.2]);

/* ---------- the printing: one canvas, a 1024 × 512 cell per shop ---------- */
const CELL = 1024, ROW = 512;
// where each thing is in a shop's cell (x, y, w, h): the sign on top; a chain's posters, menu, door sticker, the till's
// panel, the QR stand and the band along the back wall below it (an eatery's or a shuttered front's painting instead)
const R = { sign: [0, 0, 1024, 140], front: [0, 140, 1024, 372], posterA: [0, 140, 200, 290], posterB: [200, 140, 200, 290], menu: [400, 140, 420, 200],
  door: [820, 140, 204, 204], panel: [400, 340, 420, 90], qr: [830, 346, 84, 84], band: [0, 432, 1024, 80] };
const logos = {};
// A logo from public/assets/brands, or null until it has loaded (then `redraw` runs). An SVG drawn in part (the crop) goes
// wrong in Chrome unless it has a size of its own: it is given one (four times its viewBox).
export function brandImage(file, redraw) {
  if (logos[file]) return logos[file].complete && logos[file].naturalWidth ? logos[file] : null;
  const img = new Image(); img.decoding = 'async'; img.onload = redraw; logos[file] = img;
  const url = `${BASE}/assets/brands/${file}`;
  if (!file.endsWith('.svg')) { img.src = url; return null; }
  fetch(url).then((r) => r.text()).then((svg) => {
    const vb = /viewBox="([^"]+)"/.exec(svg)?.[1].split(/[\s,]+/).map(Number);
    if (vb) svg = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, '').replace(/<svg\b/, `<svg width="${vb[2] * 4}" height="${vb[3] * 4}"`));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }).catch(() => {});
  return null;
}
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const FONT = '"Be Vietnam Pro", system-ui, sans-serif';
// a chain's logo fitted in a box (x, y, w, h), centred; WinMart+ gets its plus
function logo(g, ch, x, y, w, h, redraw) {
  const img = brandImage(ch.logo, redraw); if (!img) return;
  const [cw, chh] = ch.crop || [1, 1], sw = img.naturalWidth * cw, shh = img.naturalHeight * chh, scale = Math.min(w / sw, h / shh);
  const dw = sw * scale, dh = shh * scale, dx = x + (w - dw) / 2 - (ch.plus ? dh * 0.25 : 0), dy = y + (h - dh) / 2;
  g.drawImage(img, 0, 0, sw, shh, dx, dy, dw, dh);
  if (ch.plus) { const p = dh * 0.5, t = p * 0.3, px = dx + dw + p * 0.05, py = dy + dh * 0.22; g.fillStyle = '#E21B2A'; g.fillRect(px, py + (p - t) / 2, p, t); g.fillRect(px + (p - t) / 2, py, t, p); }
}
function stripes(g, ch, x, y, w, h) { const n = ch.stripes.length; ch.stripes.forEach((c, k) => { g.fillStyle = c; g.fillRect(x, y + (k * h) / n, w, h / n + 0.5); }); }
function sign(g, x, y, w, h, key, redraw, dark) {
  const ch = CHAINS[key];
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (ch) {   // a lightbox: the chain's face, the logo in the middle, its stripes along the bottom
    g.fillStyle = ch.face || '#FFFFFF'; g.fillRect(x, y, w, h);
    stripes(g, ch, x, y + h - 22, w, 22);
    logo(g, ch, x + w * 0.19, y + 11, w * 0.62, h - 44, redraw);
  } else if (key === 'rent') {   // an old sign, taken down to its frame
    g.fillStyle = '#3B4048'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 6; k++) g.fillRect(x + 40 + k * 160, y + 30, 90, h - 60);
  } else {    // a painted signboard: the dish in big letters, a line under it
    const e = EATS[key];
    g.fillStyle = e.bg; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = e.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${Math.round(h * 0.46)}px ${FONT}`; g.fillText(e.title, x + w / 2, y + h * 0.42, w - 60);
    g.fillStyle = '#FFFFFF'; g.font = `700 ${Math.round(h * 0.15)}px ${FONT}`; g.fillText(e.sub, x + w / 2, y + h * 0.8, w - 80);
  }
  if (dark) { g.fillStyle = 'rgba(8,10,14,.62)'; g.fillRect(x, y, w, h); }   // (closed: the sign's light off)
  g.restore();
}
function poster(g, [x, y, w, h], [a, b, price, c]) {
  g.fillStyle = '#FFFFFF'; g.fillRect(x + 8, y + 8, w - 16, h - 16);
  g.fillStyle = c; g.fillRect(x + 14, y + 14, w - 28, h * 0.5);
  g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(w * 0.15)}px ${FONT}`;
  g.fillText(a, x + w / 2, y + h * 0.2, w - 36); g.font = `800 ${Math.round(w * 0.11)}px ${FONT}`; g.fillText(b, x + w / 2, y + h * 0.36, w - 36);
  g.fillStyle = c; g.font = `900 ${Math.round(w * 0.24)}px ${FONT}`; g.fillText(price, x + w / 2, y + h * 0.72, w - 30);
  g.fillStyle = '#FFD400'; g.beginPath(); g.arc(x + w - 36, y + h * 0.56, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#C8261B'; g.font = `900 15px ${FONT}`; g.fillText('MỚI', x + w - 36, y + h * 0.56 + 1);
}
function menuBoard(g, [x, y, w, h], ch, [title, rows]) {
  g.fillStyle = '#20252D'; g.fillRect(x, y, w, h);
  g.fillStyle = ch.accent; g.fillRect(x, y, w, 46);
  g.fillStyle = '#FFFFFF'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `900 28px ${FONT}`; g.fillText(title, x + 18, y + 24, w - 36);
  rows.forEach(([n, p], k) => {
    const ry = y + 70 + k * 34;
    g.fillStyle = '#E9EDF2'; g.font = `700 22px ${FONT}`; g.textAlign = 'left'; g.fillText(n, x + 18, ry, w * 0.66);
    g.fillStyle = '#FFD400'; g.textAlign = 'right'; g.fillText(p, x + w - 18, ry);
  });
}
const fmtH = (h) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
function doorSticker(g, [x, y, w, h], ch, redraw) {
  g.fillStyle = 'rgba(255,255,255,.94)'; g.beginPath(); g.roundRect(x + 10, y + 10, w - 20, h - 20, 18); g.fill();
  logo(g, ch, x + 24, y + 22, w - 48, 52, redraw);
  g.fillStyle = '#1C1F24'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `800 20px ${FONT}`; g.fillText('MỞ CỬA', x + w / 2, y + 100);
  g.fillStyle = ch.accent === '#FFE600' ? '#1C1F24' : ch.accent; g.font = `900 ${ch.hours ? 30 : 42}px ${FONT}`;
  g.fillText(ch.hours ? `${fmtH(ch.hours[0])} – ${fmtH(ch.hours[1])}` : '24/7', x + w / 2, y + 142, w - 30);
}
function counterPanel(g, [x, y, w, h], ch, redraw) { g.fillStyle = ch.accent; g.fillRect(x, y, w, h); g.fillStyle = ch.face || '#FFFFFF'; g.fillRect(x + w * 0.28, y + 8, w * 0.44, h - 16); logo(g, ch, x + w * 0.29, y + 12, w * 0.42, h - 24, redraw); }
function qrStand(g, [x, y, w, h], key) {
  const r = rnd(key.length * 977 + 3), n = 17, c = (w - 10) / n;
  g.fillStyle = '#FFFFFF'; g.fillRect(x, y, w, h);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (r() < 0.48) { g.fillStyle = '#111'; g.fillRect(x + 5 + i * c, y + 5 + j * c, c, c); }
  for (const [i, j] of [[0, 0], [n - 5, 0], [0, n - 5]]) { g.fillStyle = '#111'; g.fillRect(x + 5 + i * c, y + 5 + j * c, c * 5, c * 5); g.fillStyle = '#FFF'; g.fillRect(x + 5 + (i + 1) * c, y + 5 + (j + 1) * c, c * 3, c * 3); g.fillStyle = '#111'; g.fillRect(x + 5 + (i + 2) * c, y + 5 + (j + 2) * c, c, c); }
}
function band(g, [x, y, w, h], ch, redraw) {
  g.fillStyle = ch.face || '#FFFFFF'; g.fillRect(x, y, w, h); stripes(g, ch, x, y + h - 16, w, 16);
  for (let k = 0; k < 3; k++) logo(g, ch, x + 60 + k * 340, y + 8, 220, h - 30, redraw);
}
// shelves of goods: rows of packs in shop colours (drinks, noodles, snacks, milk, biscuits)
const PACKS = ['#E41E2B', '#1C4FA0', '#F7C600', '#E8742A', '#2E9E4A', '#7E3FA6', '#F2F2F2', '#0B7FC2', '#D62F6B', '#8C5A2B', '#FF9F1C', '#46B1E1'];
// someone on a low stool at a table, seen from the street: a head, a shirt, sometimes a bowl lifted
function diner(g, x, y, h, shirt, r) {
  g.fillStyle = shirt; g.beginPath(); g.roundRect(x - h * 0.05, y - h * 0.2, h * 0.1, h * 0.17, 6); g.fill();
  g.fillStyle = '#EDC4A2'; g.beginPath(); g.arc(x, y - h * 0.25, h * 0.045, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2B2420'; g.beginPath(); g.arc(x, y - h * 0.265, h * 0.046, Math.PI, Math.PI * 2); g.fill();
  if (r() < 0.6) { g.fillStyle = '#F2F2F2'; g.beginPath(); g.ellipse(x + h * 0.05, y - h * 0.15, h * 0.035, h * 0.018, 0, 0, Math.PI * 2); g.fill(); }
}
function eateryFront(g, x, y, w, h, key) {
  const e = EATS[key], r = rnd(key.length * 4271 + 7);
  g.fillStyle = '#F3E3C4'; g.fillRect(x, y, w, h);                                   // warm light, open to the street
  g.fillStyle = '#F6F4EE'; g.fillRect(x, y + h * 0.42, w, h * 0.42);                 // white tiles up to the waist
  g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1;
  for (let ty = y + h * 0.42; ty < y + h * 0.84; ty += 14) { g.beginPath(); g.moveTo(x, ty); g.lineTo(x + w, ty); g.stroke(); }
  for (let tx = x; tx < x + w; tx += 14) { g.beginPath(); g.moveTo(tx, y + h * 0.42); g.lineTo(tx, y + h * 0.84); g.stroke(); }
  g.fillStyle = '#B9A88C'; g.fillRect(x, y + h * 0.84, w, h * 0.16);                 // the floor
  g.fillStyle = '#6E7681'; g.fillRect(x, y, w, h * 0.08);                            // the rolled-up shutter
  for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + k * h * 0.016, w, 2); }
  for (const fx of [0.3, 0.7]) { g.fillStyle = '#FFFFFF'; g.fillRect(x + w * fx - 50, y + h * 0.11, 100, 6); }   // tube lights
  g.fillStyle = '#5E6670'; g.fillRect(x + w * 0.5 - 2, y + h * 0.08, 4, h * 0.07);                                    // a ceiling fan
  g.beginPath(); g.ellipse(x + w * 0.5, y + h * 0.155, 58, 6, 0, 0, Math.PI * 2); g.fill();
  const tables = e.kind === 'seafood' ? [0.62, 0.76] : [0.4, 0.58, 0.76];
  if (e.kind === 'seafood') {   // tanks of crab, prawns and fish
    for (let t = 0; t < 3; t++) {
      const tx = x + w * (0.03 + t * 0.19), ty = y + h * 0.3, tw = w * 0.17, th = h * 0.42;
      g.fillStyle = '#5FB6E6'; g.fillRect(tx, ty, tw, th); g.fillStyle = '#9FD8F5'; g.fillRect(tx, ty, tw, th * 0.15);
      for (let k = 0; k < 7; k++) { g.fillStyle = ['#D9532B', '#E8742A', '#7A8AA0', '#C23B22'][k % 4]; g.beginPath(); g.ellipse(tx + 8 + r() * (tw - 16), ty + th * (0.3 + r() * 0.6), 9, 6, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#3A3F47'; g.lineWidth = 4; g.strokeRect(tx, ty, tw, th);
      g.fillStyle = '#3A3F47'; g.fillRect(tx, ty + th, tw, h * 0.12);
    }
  } else {   // the cook at the pot, the menu on the back wall
    g.fillStyle = '#9AA2AD'; g.fillRect(x + w * 0.03, y + h * 0.52, w * 0.24, h * 0.32);
    g.fillStyle = '#C9CED6'; g.beginPath(); g.ellipse(x + w * 0.09, y + h * 0.5, w * 0.045, h * 0.045, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + w * (0.085 + k * 0.012), y + h * (0.38 - k * 0.07), h * 0.032, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(x + w * 0.17, y + h * 0.34, w * 0.05, h * 0.18, 6); g.fill();   // the cook, in white
    g.fillStyle = '#EDC4A2'; g.beginPath(); g.arc(x + w * 0.195, y + h * 0.3, h * 0.045, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2B2F36'; g.fillRect(x + w * 0.3, y + h * 0.17, w * 0.28, h * 0.22);
    g.fillStyle = '#FFE7A8'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(h * 0.045)}px ${FONT}`;
    (e.menu || []).forEach((m, k) => g.fillText(m, x + w * 0.315, y + h * (0.205 + k * 0.05), w * 0.25));
  }
  // a drinks fridge at the back on the right
  g.fillStyle = '#E9EEF2'; g.fillRect(x + w * 0.9, y + h * 0.3, w * 0.08, h * 0.54);
  for (let k = 0; k < 5; k++) for (let bx = 0; bx < 4; bx++) { g.fillStyle = PACKS[(k * 4 + bx) % 8]; g.fillRect(x + w * 0.905 + bx * 17, y + h * (0.33 + k * 0.1), 12, h * 0.07); }
  // tables, the low plastic stools, and the people eating
  const SHIRTS = ['#3F7CC4', '#D64550', '#F2F2F2', '#2A9D8F', '#E8742A', '#5B6CD8', '#3B3B3B'];
  for (const t of tables) {
    const tx = x + w * t;
    g.fillStyle = '#C9CED6'; g.fillRect(tx, y + h * 0.66, w * 0.12, h * 0.035); g.fillRect(tx + w * 0.055, y + h * 0.69, 5, h * 0.15);
    g.fillStyle = '#E9E2D2'; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(tx + w * (0.02 + k * 0.04), y + h * 0.655, 12, 5, 0, 0, Math.PI * 2); g.fill(); }
    for (const [sx, who] of [[-0.03, r() < 0.8], [0.13, r() < 0.6]]) {
      g.fillStyle = r() < 0.5 ? '#D62F2F' : '#2E6FD1'; g.fillRect(tx + w * sx, y + h * 0.75, w * 0.035, h * 0.09);
      if (who) diner(g, tx + w * (sx + 0.0175), y + h * 0.76, h, SHIRTS[Math.floor(r() * SHIRTS.length)], r);
    }
  }
}
// a shutter rolled down over a front (a shop shut for the night)
function shutterFront(g, x, y, w, h) { for (let k = 0; k * 10 < h; k++) { g.fillStyle = k % 2 ? '#8E949C' : '#A3A9B1'; g.fillRect(x, y + k * 10, w, 10); } }
// a front to let: the shutter down, a banner on it
function rentFront(g, x, y, w, h) {
  shutterFront(g, x, y, w, h);
  g.fillStyle = '#FFFFFF'; g.fillRect(x + w * 0.22, y + h * 0.3, w * 0.56, h * 0.3);
  g.fillStyle = '#C8261B'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(h * 0.14)}px ${FONT}`;
  g.fillText('CHO THUÊ', x + w / 2, y + h * 0.4); g.fillStyle = '#1C1F24'; g.font = `700 ${Math.round(h * 0.06)}px ${FONT}`; g.fillText('MẶT BẰNG KINH DOANH', x + w / 2, y + h * 0.52);
}
/* A chain's front too far from the office to walk into, painted: a convenience store's bright inside (the fridges along
   the back, the aisles end on, the cashier at the till in the chain's colour, its posters on the glass), or a café's warm
   one (the counter in its colour, people at the tables) for a chain whose own module has no picture of its own */
function storeFront(g, x, y, w, h, ch, key) {
  const r = rnd(key.length * 3301 + 5);
  g.fillStyle = '#F4F6F8'; g.fillRect(x, y, w, h);
  stripes(g, ch, x, y + h * 0.07, w, h * 0.05);
  for (let k = 0; k < 6; k++) {
    const fx = x + w * (0.2 + k * 0.1);
    g.fillStyle = '#DDE6EE'; g.fillRect(fx, y + h * 0.16, w * 0.095, h * 0.5);
    for (let s = 0; s < 5; s++) for (let i = 0; i < 5; i++) { g.fillStyle = DRINKS[(k * 7 + s * 3 + i) % DRINKS.length]; g.fillRect(fx + 6 + i * 17, y + h * (0.2 + s * 0.09), 11, h * 0.06); }
  }
  g.fillStyle = '#D9DCE0'; g.fillRect(x, y + h * 0.84, w, h * 0.16);
  for (const ax of [0.22, 0.44]) {
    g.fillStyle = '#C3C9D0'; g.fillRect(x + w * ax, y + h * 0.46, w * 0.12, h * 0.4);
    for (let s = 0; s < 4; s++) for (let i = 0; i < 5; i++) { g.fillStyle = PACKS[Math.floor(r() * PACKS.length)]; g.fillRect(x + w * ax + 6 + i * 23, y + h * (0.49 + s * 0.09), 18, h * 0.06); }
  }
  figure(g, x + w * 0.83, y + h * 0.46, 15, ch.shirt); figure(g, x + w * 0.38, y + h * 0.52, 15, PACKS[Math.floor(r() * 6)], '#3A2A20');
  g.fillStyle = '#2F343B'; g.fillRect(x + w * 0.68, y + h * 0.6, w * 0.26, h * 0.25); g.fillStyle = '#E8E6E1'; g.fillRect(x + w * 0.68, y + h * 0.59, w * 0.26, 8);
  if (PROMO[key]) { poster(g, [x + 4, y + h * 0.16, w * 0.155, h * 0.64], PROMO[key][0]); poster(g, [x + w * 0.845 - 4, y + h * 0.16, w * 0.155, h * 0.64], PROMO[key][1]); }
  glassOver(g, x, y, w, h);
}
function cafeFront(g, x, y, w, h, ch) {
  g.fillStyle = '#F1E6D6'; g.fillRect(x, y, w, h);
  g.fillStyle = '#B9A88C'; g.fillRect(x, y + h * 0.82, w, h * 0.18);
  g.fillStyle = ch.accent; g.fillRect(x + w * 0.5, y + h * 0.56, w * 0.48, h * 0.26);
  figure(g, x + w * 0.78, y + h * 0.42, 15, ch.shirt);
  g.fillStyle = '#7A4B2E'; g.fillRect(x + w * 0.1, y + h * 0.68, w * 0.28, 10);
  for (const [fx, c] of [[0.12, '#DCE6F2'], [0.24, '#F7D774'], [0.36, '#2A2D33']]) figure(g, x + w * fx, y + h * 0.58, 14, c);
  glassOver(g, x, y, w, h);
}
// all of a far front: its sign (its own module's, if it has one) and the painting under it; shut, the shutter down
function farFront(g, cx, cy, key, dark, redraw) {
  const ch = CHAINS[key], M = ch.custom && CUSTOM[ch.custom], front = [cx + R.front[0], cy + R.front[1], R.front[2], R.front[3]];
  if (M?.paint && M.paint.length < 6) M.paint(g, cx, cy, dark);   // (the whole cell)
  else if (M?.paint) { M.draw(g, cx, cy, dark); g.clearRect(...front); M.paint(g, ...front, dark); }   // (the picture only)
  else {
    if (M) M.draw(g, cx, cy, dark); else if (ch.parlour) drawMixue(g, cx, cy, dark); else sign(g, cx + R.sign[0], cy + R.sign[1], R.sign[2], R.sign[3], key, redraw, dark);
    g.clearRect(...front);
    if (M || ch.parlour) cafeFront(g, ...front, ch); else storeFront(g, ...front, ch, key);
  }
  if (dark) { shutterFront(g, ...front); g.fillStyle = 'rgba(10,12,16,.5)'; g.fillRect(...front); }   // (shut at night: the painting glows then, a shutter doesn't)
}

/* ---------- inside a store: the fittings, in the shop's own frame ----------
   x along the front (-SW/2 … SW/2), y up from the ground (the floor is FL up, level with the pavement), z out to the
   street (+) and into the shop (-): the glass at z = 0. Boxes painted by vertex colour, merged with the rest. fix: the
   footprints you can't walk through ([x0, x1, z0, z1]). */
const DRINKS = ['#E41E2B', '#1C4FA0', '#F7C600', '#2E9E4A', '#F2F2F2', '#0B7FC2', '#FF9F1C', '#46B1E1', '#8FD14F', '#6B3A1E'];
const RAMEN = ['#D62F2F', '#E8742A', '#1E1E1E', '#C8261B', '#F7C600', '#B3121E'];
const GREENS = ['#3E8E3A', '#58A445', '#2F6E2C', '#7DBA4A'];
function fitOut(key, D, r, low) {
  const ch = CHAINS[key], inner = [], glass = [], fix = [], spots = [], half = SHOP_W / 2;
  const b = (w, h, d, x, y, z, c) => inner.push(boxAt(w, h, d, x, FL + y, z, c));
  const cyl = (rt, rb, h, x, y, z, c, seg = 10) => inner.push(colorize(new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, FL + y, z), c));
  const ball = (s, x, y, z, c, sy = 1) => inner.push(colorize(new THREE.SphereGeometry(s, 7, 5).scale(1, sy, 1).translate(x, FL + y, z), c));
  // a glass display case on a counter (x, z its middle, y its foot): base, a lit top, corner posts, glass all round
  const vitrine = (w, h, d, x, y, z, tint = '#FFF6E0') => {
    b(w, 0.04, d, x, y + 0.02, z, '#9AA2AD'); b(w, 0.04, d, x, y + h - 0.02, z, '#9AA2AD'); b(w - 0.04, 0.01, d - 0.04, x, y + h - 0.045, z, tint);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b(0.02, h, 0.02, x + sx * (w / 2 - 0.01), y + h / 2, z + sz * (d / 2 - 0.01), '#9AA2AD');
    for (const sz of [-1, 1]) glass.push(new THREE.PlaneGeometry(w - 0.02, h - 0.08).translate(x, FL + y + h / 2, z + sz * (d / 2 - 0.005)));
    for (const sx of [-1, 1]) glass.push(new THREE.PlaneGeometry(d - 0.02, h - 0.08).rotateY(Math.PI / 2).translate(x + sx * (w / 2 - 0.005), FL + y + h / 2, z));
  };
  const block = (x0, x1, z0, z1) => fix.push([x0, x1, z0, z1]);
  const thin = low ? 2 : 1;   // (low quality: every other pack)
  // the floor (a checker of 60 cm tiles), the walls, the ceiling and its light panels, the band over the glass inside
  for (let x = -half; x < half - 0.01; x += 0.6) for (let z = -D; z < -0.01; z += 0.6) {
    const w = Math.min(0.6, half - x), d = Math.min(0.6, -z);
    inner.push(colorize(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x + w / 2, FL + 0.004, z + d / 2), (Math.round((x + half) / 0.6) + Math.round(-z / 0.6)) % 2 ? '#E4E6E9' : '#D9DCE0'));
  }
  b(SHOP_W, SHOP_CEIL - FL, 0.06, 0, (SHOP_CEIL - FL) / 2, -D + 0.03, '#F2F3F4');   // (inside the cut in the building: on its faces they'd flicker)
  for (const s of [-1, 1]) b(0.06, SHOP_CEIL - FL, D, s * (half - 0.03), (SHOP_CEIL - FL) / 2, -D / 2, '#F2F3F4');
  b(SHOP_W, 0.04, D, 0, SHOP_CEIL - FL - 0.04, -D / 2, '#F7F7F5');
  for (const x of [-2.2, 0, 2.2]) for (let z = -1.0; z > -D + 0.4; z -= 1.4) b(1.2, 0.02, 0.3, x, SHOP_CEIL - FL - 0.07, z, '#FFFFFF');
  b(SHOP_W, SHOP_CEIL - GLASS, 0.05, 0, (GLASS + SHOP_CEIL) / 2 - FL, -0.05, '#F2F3F4');
  // drinks fridges along the back wall: lit insides, rows of bottles, glass doors
  const nF = 6, fw = 0.9, fx0 = -nF * fw / 2, fz = -D + 0.31;
  for (const [h, y] of [[0.14, 1.97], [0.16, 0.08]]) b(nF * fw + 0.08, h, 0.62, 0, y, fz, '#CDD3DA');   // (an open case: top, plinth, ends)
  for (const s of [-1, 1]) b(0.04, 2.04, 0.62, s * (nF * fw / 2 + 0.02), 1.02, fz, '#CDD3DA');
  for (let k = 0; k < nF; k++) {
    const cx = fx0 + fw * (k + 0.5);
    b(fw - 0.06, 1.8, 0.02, cx, 1.04, -D + 0.08, '#F4F9FF');
    for (let s = 0; s < 5; s++) {
      const y = 0.22 + s * 0.36;
      b(fw - 0.08, 0.015, 0.5, cx, y - 0.01, fz + 0.02, '#B8C0C9');
      for (let bx = -fw / 2 + 0.09; bx < fw / 2 - 0.06; bx += 0.1 * thin) { const h = 0.18 + r() * 0.08; b(0.07, h, 0.07, cx + bx, y + h / 2, fz + 0.2, DRINKS[Math.floor(r() * DRINKS.length)]); }
    }
    b(0.03, 1.96, 0.03, fx0 + fw * k, 1.02, fz + 0.32, '#5E6670');
    b(0.02, 0.5, 0.03, cx + fw / 2 - 0.1, 1.05, fz + 0.34, '#C9CED6');
    glass.push(new THREE.PlaneGeometry(fw - 0.04, 1.9).translate(cx, FL + 1.02, fz + 0.315));
  }
  b(0.03, 1.96, 0.03, fx0 + fw * nF, 1.02, fz + 0.32, '#5E6670');
  block(-half, half, -D, fz + 0.32);
  spots.push({ kind: 'fridge', item: ch.fridge, x: 0, z: fz + 0.85, face: Math.PI });
  // two aisles of shelves running in from the front (packs both sides, a yellow price strip on each shelf)
  const gz0 = -1.35, gz1 = Math.max(gz0 - 2.4, -D + 1.55), L = gz0 - gz1, pal = key === 'gs25' ? [...RAMEN, ...PACKS] : PACKS;
  for (const gx of [-1.85, -0.55]) {
    const gz = (gz0 + gz1) / 2;
    b(0.62, 0.12, L, gx, 0.06, gz, '#3B4048'); b(0.05, 1.45, L, gx, 0.72, gz, '#C3C9D0');
    for (const y of [0.3, 0.64, 0.98, 1.32]) {
      b(0.62, 0.025, L, gx, y, gz, '#BCC3CB');
      for (const s of [-1, 1]) {
        b(0.005, 0.035, L, gx + s * 0.31, y + 0.005, gz, '#FFE45C');
        for (let z = gz1 + 0.04; z < gz0 - 0.08;) {
          const w = (0.07 + r() * 0.08) * thin, h = 0.1 + r() * 0.12, c = pal[Math.floor(r() * pal.length)], n = 1 + Math.floor(r() * 3);
          for (let i = 0; i < n && z < gz0 - 0.08; i++) { b(0.17, h, w, gx + s * 0.17, y + 0.012 + h / 2, z + w / 2, c); z += w + 0.01; }
          z += 0.02;
        }
      }
    }
    for (let k = 0; k < 3; k++) b(0.5, 0.22, 0.2, gx, 0.23 + k * 0.23, gz0 + 0.12, k % 2 ? ch.accent : '#F7C600');   // the week's offer, stacked at the end
    block(gx - 0.33, gx + 0.33, gz1, gz0 + 0.24);
  }
  // the till: a counter with the register, a card reader and the QR stand facing you; the back counter and its shelves behind
  b(1.8, 0.94, 0.62, 2.2, 0.47, -1.6, '#2F343B'); b(1.86, 0.04, 0.68, 2.2, 0.96, -1.6, '#E8E6E1');
  b(0.4, 0.12, 0.32, 2.5, 1.04, -1.72, '#1E2125'); b(0.34, 0.24, 0.02, 2.5, 1.22, -1.78, '#2B3A55');
  b(0.08, 0.14, 0.05, 1.95, 1.05, -1.42, '#1E2125'); b(0.1, 0.18, 0.03, 1.6, 1.07, -1.36, '#E8E6E1');
  b(1.95, 0.95, 0.42, 2.27, 0.475, -2.95, '#3A3F47'); b(2.0, 0.04, 0.46, 2.27, 0.96, -2.95, '#C9CED6');
  b(1.95, 0.9, 0.3, 2.27, 1.75, -3.05, '#4A505A');
  for (let y = 1.45; y < 2.15; y += 0.22) for (let x = 1.4; x < 3.15; x += 0.11 * thin) b(0.08, 0.14, 0.08, x, y, -2.96, PACKS[Math.floor(r() * 8)]);
  block(1.25, 3.3, -3.2, -1.25);
  const till = { x: 2.2, z: -0.95 };
  spots.push({ kind: 'pay', item: ch.hot, x: till.x, z: till.z, face: Math.PI });
  // the chain's own corner: on the back counter or the till (what the cashier serves), along the left wall (`side`)
  const hot = ch.hot?.unit, steam = [];
  if (hot === 'grill') {   // sausages on the rollers; a bánh bao steamer beside
    b(0.5, 0.1, 0.36, 1.75, 1.03, -2.95, '#9AA2AD');
    for (let k = 0; k < 6; k++) inner.push(colorize(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6).rotateZ(Math.PI / 2).translate(1.75, FL + 1.1, -3.08 + k * 0.05), '#A6452A'));
    vitrine(0.34, 0.32, 0.3, 2.3, 0.98, -2.92); for (let k = 0; k < 4; k++) ball(0.05, 2.2 + (k % 2) * 0.18, 1.06 + Math.floor(k / 2) * 0.13, -2.9, '#FAF6EC', 0.75);
    steam.push([2.3, 1.35, -2.92]);
  } else if (hot === 'tok') {   // the tokbokki tray in its red sauce, the fish-cake pot full of skewers
    b(0.62, 0.1, 0.38, 1.7, 1.03, -2.92, '#B8C0C9'); b(0.56, 0.02, 0.32, 1.7, 1.09, -2.92, '#C8261B');
    for (let k = 0; k < 14; k++) inner.push(colorize(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 6).rotateZ(Math.PI / 2).rotateY(r() * 3).translate(1.48 + r() * 0.44, FL + 1.105, -3.05 + r() * 0.26), '#F4EBDA'));
    cyl(0.17, 0.17, 0.16, 2.35, 1.06, -2.92, '#9AA2AD', 14); cyl(0.155, 0.155, 0.01, 2.35, 1.14, -2.92, '#B5803F', 14);
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2, sx = 2.35 + Math.cos(a) * 0.08, sz = -2.92 + Math.sin(a) * 0.08; b(0.008, 0.3, 0.008, sx, 1.22, sz, '#D8C49A'); b(0.07, 0.1, 0.012, sx, 1.21, sz, '#E9D2A4'); }
    steam.push([2.35, 1.25, -2.92]);
  } else if (hot === 'steamer') {   // a glass bánh bao cabinet on the till (your side); the coffee machine behind
    vitrine(0.5, 0.42, 0.36, 1.62, 0.98, -1.62); b(0.48, 0.015, 0.34, 1.62, 1.16, -1.62, '#B8C0C9');   // (and a shelf in it)
    for (let s = 0; s < 2; s++) for (let k = 0; k < 6; k++) ball(0.055, 1.45 + (k % 3) * 0.17, 1.06 + s * 0.18, -1.7 + Math.floor(k / 3) * 0.14, '#FAF6EC', 0.75);
    b(0.3, 0.5, 0.3, 2.6, 1.23, -2.95, '#2B2F36'); b(0.12, 0.03, 0.12, 2.6, 1.03, -2.88, '#9AA2AD');
    steam.push([1.62, 1.5, -1.62]);
  } else if (hot === 'fryer') {   // fried chicken under a warm lamp, on the till
    vitrine(0.55, 0.36, 0.38, 1.62, 0.98, -1.62, '#FFC46B'); b(0.5, 0.01, 0.34, 1.62, 1.0, -1.62, '#D9A441');   // (under a warm lamp)
    for (let k = 0; k < 8; k++) ball(0.05, 1.44 + (k % 4) * 0.12, 1.04, -1.7 + Math.floor(k / 4) * 0.14, '#C8862E', 0.8);
  }
  const sz0 = -1.35, sz1 = Math.max(sz0 - 2.4, -D + 1.55), sm = (sz0 + sz1) / 2, sl = sz0 - sz1, unit = ch.side.unit;   // along the left wall, beside the first aisle
  if (unit === 'noodles') {   // a wall of cup noodles and the hot water dispenser
    b(0.5, 1.5, sl, -3.02, 0.75, sm, '#C3C9D0');
    for (let y = 0.35; y < 1.4; y += 0.28) for (let z = sz1 + 0.08; z < sz0 - 0.06; z += 0.13 * thin) cyl(0.05, 0.04, 0.12, -2.86, y, z, RAMEN[Math.floor(r() * RAMEN.length)], 8);
    b(0.32, 0.5, 0.36, -2.98, 1.75, sz0 - 0.3, '#F2F2F2'); b(0.04, 0.05, 0.04, -2.8, 1.62, sz0 - 0.36, '#D62F2F'); b(0.04, 0.05, 0.04, -2.8, 1.62, sz0 - 0.24, '#2E6FD1');
  } else if (unit === 'ramyeon') {   // the ramyeon machines on a counter, a pot on each, the packs on the wall above
    b(0.55, 0.9, sl, -3.0, 0.45, sm, '#3A3F47'); b(0.58, 0.04, sl, -3.0, 0.92, sm, '#C9CED6');
    for (let k = 0; k < 3; k++) { const z = sz0 - 0.4 - k * 0.6; b(0.4, 0.22, 0.4, -3.0, 1.05, z, '#B8C0C9'); b(0.3, 0.01, 0.3, -2.96, 1.165, z, '#1E1E1E'); cyl(0.11, 0.1, 0.09, -2.96, 1.22, z, '#D9A441', 12); }
    for (let y = 1.45; y < 2.2; y += 0.24) for (let z = sz1 + 0.08; z < sz0 - 0.06; z += 0.16 * thin) b(0.06, 0.18, 0.13, -3.25, y, z, RAMEN[Math.floor(r() * RAMEN.length)]);
    steam.push([-2.96, 1.4, sz0 - 0.4]);
  } else if (unit === 'chiller') {   // the open chiller: onigiri and bento boxes; snacks above
    b(0.6, 1.0, sl, -3.0, 0.5, sm, '#DDE3E9'); b(0.5, 0.02, sl - 0.1, -2.98, 0.86, sm, '#5E6670');
    for (let z = sz1 + 0.1; z < sz0 - 0.1; z += 0.12) { inner.push(colorize(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 3).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(-2.9, FL + 0.93, z), '#F5F2EA')); b(0.02, 0.04, 0.05, -2.875, 0.92, z, '#1E2B22'); }
    for (let z = sz1 + 0.12; z < sz0 - 0.12; z += 0.2) b(0.16, 0.05, 0.16, -3.1, 0.9, z, r() < 0.5 ? '#F7C600' : '#E8742A');
    b(0.5, 0.9, sl, -3.05, 1.75, sm, '#C3C9D0');
    for (let y = 1.4; y < 2.1; y += 0.24) for (let z = sz1 + 0.06; z < sz0 - 0.06; z += 0.12 * thin) b(0.08, 0.16, 0.09, -2.84, y, z, PACKS[Math.floor(r() * 12)]);
  } else if (unit === 'softserve') {   // the soft-serve machine and a stack of cones; snacks along the wall
    b(0.55, 0.9, sl, -3.0, 0.45, sm, '#3A3F47'); b(0.58, 0.04, sl, -3.0, 0.92, sm, '#E8E6E1');
    b(0.42, 0.62, 0.4, -3.02, 1.25, sz0 - 0.4, '#F2F2F2'); b(0.06, 0.08, 0.06, -2.82, 1.0, sz0 - 0.4, '#9AA2AD');
    for (let k = 0; k < 4; k++) inner.push(colorize(new THREE.ConeGeometry(0.035, 0.12, 8).rotateX(Math.PI).translate(-2.88, FL + 1.0 + k * 0.03, sz0 - 0.85), '#D9A441'));
    for (let y = 1.3; y < 2.1; y += 0.25) for (let z = sz1 + 0.08; z < sz0 - 1.0; z += 0.14 * thin) b(0.08, 0.18, 0.11, -3.2, y, z, PACKS[Math.floor(r() * 12)]);
  } else {   // crates of vegetables; at Bách Hóa Xanh an open case of meat and fish over them
    b(0.62, 0.6, sl, -3.0, 0.3, sm, '#7A5A3A');
    for (let z = sz1 + 0.12; z < sz0 - 0.1; z += 0.24) for (let k = 0; k < 4; k++) b(0.12, 0.08, 0.1, -3.18 + k * 0.12, 0.65, z + (k % 2) * 0.05, unit === 'meat' ? (k % 2 ? '#E7A39A' : '#F2F0EA') : GREENS[(k + Math.round(z * 10)) & 3]);
    if (unit === 'meat') { b(0.6, 0.9, sl, -3.02, 1.15, sm, '#DDE3E9'); for (let z = sz1 + 0.12; z < sz0 - 0.1; z += 0.22) b(0.18, 0.04, 0.16, -2.95, 0.93, z, '#D9666B'); }
  }
  block(-half, -2.7, sz1, sz0);
  spots.push({ kind: 'side', item: ch.side, x: -2.25, z: sm, face: Math.PI / 2 });
  // the window: a counter to sit at with three stools (the convenience stores), or crates of fruit (the grocers)
  const seats = [];
  if (ch.seats) {
    b(2.3, 0.04, 0.4, -2.05, 1.0, -0.25, '#C8A27A'); b(2.3, 0.98, 0.04, -2.05, 0.49, -0.07, '#8D7358');
    for (const x of [-2.85, -2.05, -1.25]) {
      cyl(0.17, 0.17, 0.05, x, 0.72, -0.65, ch.accent, 14); cyl(0.025, 0.025, 0.7, x, 0.36, -0.65, '#9AA2AD', 6); cyl(0.2, 0.2, 0.02, x, 0.01, -0.65, '#5E6670', 14);
      seats.push({ x, z: -0.65, top: 0.745 });
      block(x - 0.18, x + 0.18, -0.83, -0.47);
    }
    block(-3.25, -0.9, -0.45, 0);
    spots.push({ kind: 'seat', x: -2.05, z: -1.0, face: 0, seat: seats[1] });
  } else {
    for (let k = 0; k < 4; k++) { const x = -3.0 + k * 0.55; b(0.5, 0.4 + (k % 2) * 0.12, 0.5, x, 0.2 + (k % 2) * 0.06, -0.45, '#7A5A3A'); for (let i = 0; i < 6; i++) ball(0.06, x - 0.15 + (i % 3) * 0.15, 0.46 + (k % 2) * 0.12, -0.55 + Math.floor(i / 3) * 0.18, ['#E8742A', '#D62F2F', '#7DBA4A', '#F7C600'][k]); }
    block(-3.3, -0.7, -0.75, 0);
  }
  // where a shopper stands along the aisles (they move between these)
  const aisle = [[-1.2, -2.0], [-1.2, gz1 + 0.5], [0.3, -1.8], [0.3, gz1 + 0.6]];
  return { inner, glass, fix, spots, seats, till, cashier: { x: 2.3, z: -2.3 }, steam, aisle };
}

/* ---------- the shops ----------
   fronts: ground floors facing a street, nearest the office first: { dir: 'px' | 'pz', x, z, deep } on the facade, which
   faces +x or +z (the sides the camera sees); city.js has cut each shop's room out of its building. */
export function buildShops(G, fronts) {
  for (const f of fronts) f.store = true;   // (the city leaves its plain shop out)
  if (!fronts.length) return { refresh() {}, updateDoors() {}, night() {}, doors: () => [], walk: () => undefined, shop: null };
  // (on the 'low' quality the canvas is half the size, drawn scaled: a quarter of the memory, and of the upload each time
  // a shop opens or shuts; everything is still drawn in a cell's 1024 × 512)
  const low = quality.level === 'low', PX = low ? 0.5 : 1, W = CELL * 2, H = ROW * Math.ceil(fronts.length / 2);
  const canvas = document.createElement('canvas'); canvas.width = W * PX; canvas.height = H * PX;
  const g = canvas.getContext('2d'), tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const qs = new URLSearchParams(location.search), asked = qs.has('debug') && qs.get('walkins') ? Number(qs.get('walkins')) : 0;
  const walkIns = () => asked || WALK_INS_AT[city] || WALK_INS;
  let city = null, set = [], night = false, built = null, stores = [], shut = [];
  const cellOf = (n) => [(n % 2) * CELL, Math.floor(n / 2) * ROW];
  function cell(n) {
    const [cx, cy] = cellOf(n), key = set[n] || 'rent', ch = CHAINS[key], at = ([x, y, w, h]) => [cx + x, cy + y, w, h];
    if (stores[n]?.far) { farFront(g, cx, cy, key, !!shut[n], draw); return; }
    if (ch?.parlour) { drawMixue(g, cx, cy, !!shut[n]); return; }
    if (ch?.custom) { CUSTOM[ch.custom].draw(g, cx, cy, !!shut[n]); return; }
    sign(g, ...at(R.sign), key, draw, !!shut[n]);
    if (!ch) { if (EATS[key]) eateryFront(g, ...at(R.front), key); else rentFront(g, ...at(R.front)); return; }
    poster(g, at(R.posterA), PROMO[key][0]); poster(g, at(R.posterB), PROMO[key][1]);
    menuBoard(g, at(R.menu), ch, MENU[key]); doorSticker(g, at(R.door), ch, draw); counterPanel(g, at(R.panel), ch, draw); qrStand(g, at(R.qr), key); band(g, at(R.band), ch, draw);
  }
  function draw() {
    g.setTransform(PX, 0, 0, PX, 0, 0); g.clearRect(0, 0, W, H);
    // (a shop's own printing that fails costs that shop's cell, not the whole canvas: every sign on the street with it)
    fronts.forEach((_, n) => { g.save(); try { cell(n); } catch (e) { console.error('shops: printing', set[n], e); } finally { g.restore(); } });
    tex.needsUpdate = true;
  }
  document.fonts?.ready.then(() => { if (city) draw(); });   // the lettering, once the font is in
  // a plane showing part of a cell (rect: x, y, w, h in the cell's pixels)
  const decalOn = (p, n, [rx, ry, rw, rh]) => {   // (any flat geometry with 0–1 uvs: a plane, a disc)
    const uv = p.attributes.uv, [cx, cy] = cellOf(n);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + rx + uv.getX(i) * rw) / W, 1 - (cy + ry + (1 - uv.getY(i)) * rh) / H);
    return p;
  };
  const decal = (w, h, n, rect) => decalOn(new THREE.PlaneGeometry(w, h), n, rect);
  const faceM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#FFFFFF', emissiveIntensity: 0.06, roughness: 0.45, alphaTest: 0.5 });
  // the insides: lit by their own tubes, so each glows in its own colours (per shop: open or shut, day or night)
  const glow = { value: new Array(SHOPS + 1).fill(0) };
  const innerM = vmat({ roughness: 0.7 });
  innerM.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aShop;\nvarying float vShop;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvShop = aShop;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uGlow[${SHOPS + 1}];\nvarying float vShop;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n{ float gl = 0.; for (int k = 0; k < ${SHOPS + 1}; k++) if (abs(float(k) - vShop) < .5) gl = uGlow[k]; totalEmissiveRadiance += diffuseColor.rgb * gl; }`);
  };
  innerM.customProgramCacheKey = () => 'shop-inner';
  const glassM = new THREE.MeshStandardMaterial({ color: '#BFD9E6', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const frameM = vmat({ roughness: 0.5, metalness: 0.3 }), shutterM = vmat({ roughness: 0.6, metalness: 0.35 });
  const poolM = new THREE.MeshBasicMaterial({ map: poolTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  const tag = (geo, n) => { geo.setAttribute('aShop', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(n), 1)); return geo; };
  let poolMesh = null, doorGlass = null, doorFrame = null;

  /* (re)build everything for the city picked now */
  function build() {
    if (built) { built.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isCSS2DObject) o.element.remove(); }); G.remove(built); }
    built = new THREE.Group(); G.add(built);
    const out = [], inner = [], glass = [], faces = [], pools = [], leafs = [];
    stores = [];
    let chains = 0;
    // a pool of light on the pavement at night (in one mesh: each shop's four corners lit or not)
    const pool = (S, M) => {
      const p = new THREE.PlaneGeometry(4.4, 2.4).rotateX(-Math.PI / 2).translate(0, FL + 0.02, 1.0);
      p.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 3).fill(1), 3));
      S.poolAt = pools.reduce((a, q) => a + q.attributes.position.count, 0);
      pools.push(p.applyMatrix4(M));
    };
    fronts.forEach((f, n) => {
      const key = set[n] || 'rent', ch = CHAINS[key], rot = f.dir === 'px' ? Math.PI / 2 : 0, D = shopDepth(f.deep);
      const M = new THREE.Matrix4().makeRotationY(rot).setPosition(f.x, GY, f.z);
      const put = (geo, list) => list.push(geo.applyMatrix4(M));
      const toW = (x, z) => (rot ? [f.x + z, f.z - x] : [f.x + x, f.z + z]);
      const S = { n, key, ch, f, rot, D, M, toW, door: 0, inside: false };
      stores.push(S);
      // the front: the lightbox over it, scooters parked along the kerb
      put(boxAt(SHOP_W + 0.3, SIGN_H_M + 0.1, 0.18, 0, FL + GLASS + SIGN_H_M / 2 + 0.05, 0.09, '#D8DCE1'), out);
      put(decal(SHOP_W + 0.2, SIGN_H_M, n, R.sign).translate(0, FL + GLASS + SIGN_H_M / 2 + 0.05, 0.185), faces);
      const far = !!ch && chains++ >= walkIns();
      if (!ch || far) {   // an eatery, a front to let, a chain too far off to walk into: painted, in a plain frame
        put(boxAt(SHOP_W + 0.3, GLASS + 0.05, 0.08, 0, FL + GLASS / 2, 0.03, (ch?.custom && CUSTOM[ch.custom].frame) || '#5E6670'), out);
        put(decal(SHOP_W, GLASS - FL, n, R.front).translate(0, FL + (GLASS - FL) / 2 + 0.02, 0.075), faces);
        if (far) { Object.assign(S, { far, spots: [], seats: [], fix: [] }); pool(S, M); }
        return;
      }
      const fr = rnd(n * 7919 + key.length * 131 + 17);
      Object.assign(S, ch.custom ? CUSTOM[ch.custom].fit(D, fr, low, SHOP_W) : ch.parlour ? fitMixue(D, fr, low, SHOP_W) : fitOut(key, D, fr, low));
      inner.push(S.inner.map((geo) => tag(geo.applyMatrix4(M), n)));   // (each shop's own mesh: one out of view isn't drawn)
      for (const geo of S.glass) put(geo, glass);
      S.inner = S.glass = null;
      // the glass front: mullions, sill and head, the door's frame; fixed panes either side of the door, a pane over it
      // (in the chain's own colour when its module says: Cộng's olive)
      const fc = (ch.custom && CUSTOM[ch.custom].frame) || FRAME;
      for (const x of [-SHOP_W / 2, -2.2, -DOOR - 0.03, DOOR + 0.03, 2.2, SHOP_W / 2]) put(boxAt(0.07, GLASS - FL, 0.08, x, FL + (GLASS - FL) / 2, 0, fc), out);
      put(boxAt(SHOP_W + 0.14, 0.12, 0.1, 0, FL + 0.06, 0, fc), out); put(boxAt(SHOP_W + 0.14, 0.07, 0.1, 0, GLASS + 0.02, 0, fc), out);
      put(boxAt(2 * DOOR + 0.1, 0.06, 0.09, 0, FL + 2.12, 0, fc), out);
      for (const [x0, x1] of [[-SHOP_W / 2, -DOOR - 0.03], [DOOR + 0.03, SHOP_W / 2]]) put(new THREE.PlaneGeometry(x1 - x0, GLASS - FL - 0.12).translate((x0 + x1) / 2, FL + 0.12 + (GLASS - FL - 0.12) / 2, 0.01), glass);
      put(new THREE.PlaneGeometry(2 * DOOR, GLASS - FL - 2.15).translate(0, FL + 2.15 + (GLASS - FL - 2.15) / 2, 0.01), glass);
      if (ch.custom) Object.assign(S, CUSTOM[ch.custom].front({ n, D, put, out, faces, decal, decalOn, built, S, GY }));   // (its printing, and what stands out front)
      else if (ch.parlour) {   // Mixue: its posters, the hours on the door, the menu over the back counter, the counter's front, the
        // slogan on the wall, the round light box out on its bracket, the Snow King's statue by the window; the Snow King himself
        put(decal(0.55, 0.7, n, RM.posterA).translate(-2.75, FL + 1.5, -0.015), faces);
        put(decal(0.55, 0.7, n, RM.posterB).translate(2.75, FL + 1.5, -0.015), faces);
        put(decal(0.42, 0.072, n, RM.hours).translate(DOOR + 0.3, FL + 1.3, -0.015), faces);
        put(decal(3.4, 0.6, n, RM.menu).translate(1.5, FL + 2.12, -D + 0.075), faces);
        put(decal(3.4, 0.66, n, RM.panel).translate(1.5, FL + 0.5, -1.545), faces);
        put(decal(2.5, 0.37, n, RM.slogan).translate(-1.8, FL + 1.85, -D + 0.07), faces);
        const bx = SHOP_W / 2 + 0.14, by = FL + GLASS + SIGN_H_M / 2 + 0.05, bz = 0.62;
        put(boxAt(0.05, 0.05, 0.56, bx, by + 0.45, 0.3, '#2B2F36'), out);
        put(colorize(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 28).rotateZ(Math.PI / 2).translate(bx, by, bz), '#FFFFFF'), out);
        for (const s of [1, -1]) put(decalOn(new THREE.CircleGeometry(0.4, 28).rotateY(s * Math.PI / 2).translate(bx + s * 0.037, by, bz), n, RM.blade), faces);
        put(snowKing().translate(-2.75, FL, 0.42), out);
      } else {
        // the printing: posters on the glass, the door sticker, the menu over the back counter, the till's front, the QR stand, the band along the back
        put(decal(0.62, 0.9, n, R.posterA).translate(-2.75, FL + 1.55, -0.015), faces);
        put(decal(0.62, 0.9, n, R.posterB).translate(2.7, FL + 1.55, -0.015), faces);
        put(decal(0.36, 0.36, n, R.door).translate(DOOR + 0.3, FL + 1.25, -0.015), faces);
        put(decal(1.48, 0.7, n, R.menu).translate(2.27, 2.3, -2.78), faces);   // (clear of the ceiling)
        put(decal(1.7, 0.36, n, R.panel).translate(2.2, FL + 0.55, -1.285), faces);
        put(decal(0.09, 0.09, n, R.qr).translate(1.6, FL + 1.09, -1.343), faces);
        put(decal(SHOP_W - 0.1, 0.48, n, R.band).translate(0, SHOP_CEIL - 0.3, -D + 0.02), faces);
      }
      if (ch.outdoor) {   // GS25: a table and stools on the pavement under a parasol in its blue
        const tx = 2.3, tz = 0.7;
        put(colorize(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 16).translate(tx, FL + 0.72, tz), '#F2F2F2'), out);
        put(colorize(new THREE.CylinderGeometry(0.03, 0.05, 0.72, 6).translate(tx, FL + 0.36, tz), '#9AA2AD'), out);
        put(colorize(new THREE.CylinderGeometry(0.018, 0.018, 1.7, 6).translate(tx, FL + 1.3, tz), '#E8E8E8'), out);
        put(colorize(new THREE.ConeGeometry(0.85, 0.32, 10, 1, true).translate(tx, FL + 2.18, tz), ch.accent), out);
        put(colorize(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 10, 1, true).translate(tx, FL + 2.0, tz), '#FFFFFF'), out);
        for (const sx of [-0.55, 0.55]) put(boxAt(0.36, 0.42, 0.36, tx + sx, FL + 0.21, tz, '#2B5FA8'), out);
        S.table = { x: tx, z: tz };
      }
      if (ch.hours) {   // a shutter box over the front, and the shutter (rolled down at closing time)
        put(boxAt(SHOP_W + 0.2, 0.2, 0.22, 0, GLASS + 0.14, 0.16, '#8E949C'), out);
        const slats = [];
        for (let k = 0; k * 0.09 < GLASS - FL; k++) slats.push(boxAt(SHOP_W + 0.1, 0.1, 0.03 + (k % 2) * 0.012, 0, -0.045 - k * 0.09, (k % 2) * 0.006, k % 2 ? '#9AA1A9' : '#B2B8BF'));
        const sh = new THREE.Mesh(mergeAll(slats), shutterM), holder = new THREE.Group();
        holder.matrixAutoUpdate = false; holder.matrix.copy(M).multiply(new THREE.Matrix4().makeTranslation(0, GLASS + 0.03, 0.13)); holder.add(sh); built.add(holder);
        sh.visible = false; S.shutter = sh;
      }
      // the door's two sliding leaves; a pool of light on the pavement at night
      S.leaf = leafs.length; leafs.push(S, S);
      pool(S, M);
    });
    const mesh = (list, mat, shadow, recv = true) => { if (!list.length) return null; const o = new THREE.Mesh(mergeAll(list), mat); o.castShadow = shadow; o.receiveShadow = recv; built.add(o); return o; };
    mesh(out, vmat({ roughness: 0.6 }), true);
    for (const list of inner) mesh(list, innerM, false, false);
    mesh(faces, faceM, false);
    const gl = mesh(glass, glassM, false, false); if (gl) gl.renderOrder = 2;
    poolMesh = mesh(pools, poolM, false, false); if (poolMesh) { poolMesh.renderOrder = 1; poolMesh.visible = night; }
    // the door leaves, instanced (moved as a door opens)
    const leafGlass = new THREE.PlaneGeometry(DOOR, 2.0).translate(0, 1.0, 0);
    const leafFrame = mergeAll([boxAt(0.04, 2.0, 0.04, -DOOR / 2, 1.0, 0, FRAME), boxAt(0.04, 2.0, 0.04, DOOR / 2, 1.0, 0, FRAME), boxAt(DOOR, 0.05, 0.04, 0, 0.025, 0, FRAME), boxAt(DOOR, 0.05, 0.04, 0, 1.975, 0, FRAME), boxAt(0.03, 0.4, 0.05, DOOR / 2 - 0.08, 1.05, 0, '#C9CED6')]);
    doorGlass = new THREE.InstancedMesh(leafGlass, glassM, Math.max(1, leafs.length)); doorFrame = new THREE.InstancedMesh(leafFrame, frameM, Math.max(1, leafs.length));
    for (const o of [doorGlass, doorFrame]) { o.frustumCulled = false; o.renderOrder = 2; o.count = leafs.length; built.add(o); }
    // a chain whose frames have their own colour: its door leaves too (each leaf's colour times the frame's grey)
    if (stores.some((S) => S.leaf != null && S.ch.custom && CUSTOM[S.ch.custom].frame)) {
      const base = new THREE.Color(FRAME), c = new THREE.Color();
      stores.forEach((S) => { if (S.leaf == null) return; const own = S.ch.custom && CUSTOM[S.ch.custom].frame;
        if (own) { c.set(own); c.r /= base.r; c.g /= base.g; c.b /= base.b; } else c.setRGB(1, 1, 1);
        doorFrame.setColorAt(S.leaf, c); doorFrame.setColorAt(S.leaf + 1, c); });
      doorFrame.instanceColor.needsUpdate = true;
    }
    for (const S of stores) if (S.leaf != null) placeDoor(S);
  }
  const LM = new THREE.Matrix4(), LT = new THREE.Matrix4();
  function placeDoor(S) {
    const o = S.door * (DOOR - 0.06);
    for (const [k, s] of [[0, -1], [1, 1]]) {
      LM.copy(S.M).multiply(LT.makeTranslation(s * (DOOR / 2 + o), FL, -0.05));
      doorGlass.setMatrixAt(S.leaf + k, LM); doorFrame.setMatrixAt(S.leaf + k, LM);
    }
    doorGlass.instanceMatrix.needsUpdate = doorFrame.instanceMatrix.needsUpdate = true;
  }

  let lastH = -1, walker = null;
  function refresh(h) {   // the opening hours: shutters, lights, signs (looked at every minute of office time)
    let redraw = false;
    for (const S of stores) {
      if (!S.ch) continue;
      const open = isOpen(S.ch, h);
      if (!!shut[S.n] === open) { shut[S.n] = !open; redraw = true; }
      glow.value[S.n] = open ? (night ? 0.55 : 0.22) : (night ? 0.0 : 0.06);
      if (poolMesh) { const c = poolMesh.geometry.attributes.color, v = open ? 1 : 0; for (let i = 0; i < 4; i++) c.setXYZ(S.poolAt + i, v, v, v); c.needsUpdate = true; }
    }
    if (redraw) draw();
  }
  function sync() {
    const k = cityKey();
    if (k !== city) { city = k; set = SETS[k]; shut = []; build(); draw(); lastH = -1; }
    const h = hourNow();
    if (Math.abs(h - lastH) <= 0.016) return;
    lastH = h; refresh(h);
    for (const S of stores) if (S.shutter) S.shutter.visible = !!shut[S.n];
  }
  function updateDoors(dt) {
    for (const S of stores) {
      if (S.leaf == null) continue;
      const [x, z] = doorOf(S);
      const want = !shut[S.n] && walker && Math.hypot(walker[0] - x, walker[1] - z) < 1.7 ? 1 : 0;
      if (S.door === want) continue;
      if (want && S.door === 0) sfx.play('ding');
      S.door = THREE.MathUtils.clamp(S.door + Math.sign(want - S.door) * dt * 2.6, 0, 1);
      placeDoor(S);
    }
  }
  const doorOf = (S) => (S.dw ??= S.toW(0, 0.1));
  const local = (S, x, z) => { const dx = x - S.f.x, dz = z - S.f.z; return S.rot ? [-dz, dx] : [dx, dz]; };
  // walking in (first person): whether (x, z) is blocked, at or in a shop (undefined: not ours to say)
  function walk(x, z, r = 0.25) {
    for (const S of stores) {
      const [lx, lz] = local(S, x, z), half = SHOP_W / 2;
      if (lx < -half - 0.3 || lx > half + 0.3 || lz < -S.D - 0.3 || lz > r + 0.02) continue;
      const doorway = S.ch && !S.far && Math.abs(lx) < DOOR - r && S.door > 0.6;
      if (lz > -r - 0.05) return !doorway;   // at the front (either side of the glass): only through the open door
      if (!S.ch || S.far) return true;
      if (lx < -half + r || lx > half - r || lz < -S.D + r) return true;
      return S.fix.some(([x0, x1, z0, z1]) => lx > x0 - r && lx < x1 + r && lz > z0 - r && lz < z1 + r);
    }
    return undefined;
  }
  /* for walking in (first-person.js): feel([x, z]) each frame where you are on the street (null: not out there); inside():
     the shop you are in; spots(): what you can do there (the fridges, the chain's corner, the till, a seat at the
     window), each { kind, item, store, x, z, face, seatAt } */
  const shop = {
    feel(p) {
      walker = p;
      for (const S of stores) {
        if (!S.ch || S.far) continue;
        const [lx, lz] = p ? local(S, p[0], p[1]) : [99, 99], inside = Math.abs(lx) < SHOP_W / 2 && lz < -0.3 && lz > -S.D;
        S.inside = inside;
      }
    },
    inside: () => stores.find((S) => S.inside) || null,
    // every front, the rooms and the painted ones (for the tests): its chain, whether it is a room, where to stand at it
    fronts: () => stores.map((S) => { const [x, z] = S.toW(0, 0.45); return { key: S.key, room: S.leaf != null, far: !!S.far, x, z, face: S.rot ? -Math.PI / 2 : Math.PI }; }),
    spots: () => stores.flatMap((S) => (S.inside ? S.spots.map((o) => {
      const [x, z] = S.toW(o.x, o.z), seat = o.seat && S.toW(o.seat.x, o.seat.z);
      return { ...o, x, z, face: o.face + S.rot, store: { key: S.key, name: S.ch.name, accent: S.ch.accent }, seatAt: seat && { x: seat[0], z: seat[1], y: GY + FL + o.seat.top, yaw: S.rot } };
    }) : [])),
  };
  return {
    refresh: sync, updateDoors,
    night(on) { night = on; faceM.emissiveIntensity = on ? 0.55 : 0.06; if (poolMesh) poolMesh.visible = on; lastH = -1; sync(); },   // (brighter, and the bloom blurs the logos)
    doors: () => stores.filter((S) => S.ch && S.leaf != null).map((S) => {
      const [x, z] = doorOf(S);
      return { name: S.ch.name, x, z, open: !shut[S.n], opens: S.ch.hours ? fmtH(S.ch.hours[0]) : null };
    }),
    walk, shop,
  };
}

let POOL;
function poolTexture() {
  return (POOL ??= (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 40, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,250,235,.42)'); r.addColorStop(0.5, 'rgba(255,245,225,.14)'); r.addColorStop(1, 'rgba(255,240,220,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })());
}
