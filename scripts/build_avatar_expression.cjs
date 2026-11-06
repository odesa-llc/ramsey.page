// Bake the approved 40% closed-mouth smile and 10% facial softness into the SVG.
// Keep the ASCII grid, font, silhouette and stroke density intact.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'site/assets/ascii-face');
const source = fs.readFileSync(path.join(assets, 'ramsey-retro-selected-portrait.svg'), 'utf8');
const pattern = /<text x="([^"]+)" y="([^"]+)" fill="([^"]+)" opacity="([^"]+)">(.*?)<\/text>/g;
const marks = [...source.matchAll(pattern)].map(match => ({
  x: Number(match[1]), y: Number(match[2]), glyph: match[5],
  colour: [1, 3, 5].map(index => parseInt(match[3].slice(index, index + 2), 16)),
  raw: match[0],
}));
const softness = .10;
const smile = .40;
const smooth = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};
const face = marks.filter(mark => mark.y >= 231.5);
for (const mark of marks) {
  const radius = Math.hypot((mark.x - 248) / 190, (mark.y - 465) / 280);
  mark.weight = smooth(215, 285, mark.y) * (1 - .7 * smooth(.72, 1.12, radius));
  if (mark.weight === 0) { mark.softColour = mark.colour; continue; }
  const totals = [0, 0, 0]; let weights = 0;
  for (const neighbour of face) {
    const distance = (mark.x - neighbour.x) ** 2 + (mark.y - neighbour.y) ** 2;
    if (distance > 110 ** 2) continue;
    const weight = Math.exp(-distance / (2 * 43 ** 2));
    weights += weight;
    neighbour.colour.forEach((channel, index) => totals[index] += channel * weight);
  }
  mark.softColour = totals.map(channel => channel / weights);
}
const grid = new Map(marks.map(mark => [Math.round(mark.x / 12) + ':' + Math.round((mark.y - 36.5) / 19.5), mark]));
function sample(x, y, key, fallback) {
  const column = x / 12, row = (y - 36.5) / 19.5;
  const left = Math.floor(column), top = Math.floor(row), fx = column - left, fy = row - top;
  const neighbours = [[left, top, (1 - fx) * (1 - fy)], [left + 1, top, fx * (1 - fy)], [left, top + 1, (1 - fx) * fy], [left + 1, top + 1, fx * fy]];
  const colour = [0, 0, 0];
  for (const [cx, cy, weight] of neighbours) {
    const point = grid.get(cx + ':' + cy);
    (point ? point[key] : fallback).forEach((channel, index) => colour[index] += channel * weight);
  }
  return colour;
}
function warp(mark) {
  const dx = mark.x - 242, dy = mark.y - 550;
  const horizontal = 1 - smooth(76, 122, Math.abs(dx));
  const vertical = Math.exp(-.5 * (dy / 60) ** 2) * smooth(438, 492, mark.y) * (1 - smooth(610, 665, mark.y));
  const influence = horizontal * vertical;
  const lift = (28 * Math.min(1, Math.abs(dx) / 70) ** 1.7 - 2) * smile * influence;
  const roundness = Math.exp(-.5 * (dy / 26) ** 2) * horizontal * smile;
  return { x: 242 + dx * (1 + .075 * smile * influence), y: 550 + dy * (1 + .08 * roundness) - lift };
}
// The old preview could replace a dense # with a thin slash, creating pale holes.
// Allow only equivalent or denser character substitutions as the lips curve.
const density = glyph => glyph === '#' ? 3 : glyph === '=' ? 2 : 1;
let index = 0, changedGlyphs = 0, preventedPaleGaps = 0;
const mouthToneCells = [];
let result = source.replace(pattern, (whole, sx, sy, fill, opacity) => {
  const mark = marks[index++];
  let point = { x: mark.x, y: mark.y };
  for (let step = 0; step < 3; step++) {
    const warped = warp(point);
    point = { x: mark.x - (warped.x - point.x), y: mark.y - (warped.y - point.y) };
  }
  const original = sample(point.x, point.y, 'colour', mark.colour);
  const softened = sample(point.x, point.y, 'softColour', mark.softColour);
  const colour = original.map((channel, k) => Math.round(channel + (softened[k] - channel) * softness * mark.weight));
  assert(colour.every(channel => Number.isFinite(channel) && channel >= 0 && channel <= 255));
  const sampled = grid.get(Math.round(point.x / 12) + ':' + Math.round((point.y - 36.5) / 19.5));
  let glyph = sampled ? sampled.glyph : mark.glyph;
  if (density(glyph) < density(mark.glyph)) { glyph = mark.glyph; preventedPaleGaps++; }
  if (glyph !== mark.glyph) changedGlyphs++;
  assert(density(glyph) >= density(mark.glyph), 'Smile must not reduce ASCII stroke density');
  if (mark.y < 215) assert.deepEqual(colour, mark.colour, 'Hair must remain unchanged');
  const hex = '#' + colour.map(channel => channel.toString(16).padStart(2, '0')).join('');
  const mouthRadius = Math.hypot((mark.x - 242) / 112, (mark.y - 545) / 86);
  const gapWeight = 1 - smooth(.62, 1, mouthRadius);
  if (gapWeight > 0) mouthToneCells.push(`<rect x="${sx}" y="${mark.y - 15.5}" width="12" height="19.5" fill="${hex}" fill-opacity="${gapWeight.toFixed(3)}"/>`);
  return `<text x="${sx}" y="${sy}" fill="${hex}" opacity="${opacity}">${glyph}</text>`;
});
// Retain more of the base tone between glyphs; soften only this backing layer.
const mask = '<defs><filter id="smile-photo-feather" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="17"/></filter><filter id="smile-tone-feather" x="-30%" y="-40%" width="160%" height="180%"><feGaussianBlur stdDeviation="8.5"/></filter><mask id="smile-photo-mask" maskUnits="userSpaceOnUse" x="-20" y="-10" width="520" height="730"><rect x="-20" y="-10" width="520" height="730" fill="white"/><ellipse cx="242" cy="545" rx="112" ry="83" fill="black" opacity="0.08" filter="url(#smile-photo-feather)"/></mask></defs>';
result = result.replace(/(<g clip-path="url\(#portrait-clip\)"[^>]* opacity=")([\d.]+)("[^>]*>)([\s\S]*?)(<\/g>)/g,
  (_, before, opacity, after, content, close) => before + (Number(opacity) * (1 - .9 * softness)).toFixed(4) + after + '<g mask="url(#smile-photo-mask)">' + content + '</g>' + close);
result = result.replace(/(<svg[^>]*>)/, '$1' + mask);
// A faint, continuous skin-tone backing fills paper-white holes at the mouth.
// Feather the backing so individual cells never appear as visible cubes.
const toneLayer = '<g id="smile-gap-fill" clip-path="url(#portrait-clip)" opacity="0.10" filter="url(#smile-tone-feather)" aria-hidden="true">' + mouthToneCells.join('') + '</g>';
result = result.replace(/(?=<g font-family="Courier New,monospace")/, toneLayer);
assert(result.includes('id="smile-gap-fill"'), 'Mouth backing must sit below the ASCII characters');
result = result.replace('<title id="title">Ramsey — balanced detail ASCII avatar</title>', '<title id="title">Ramsey — gentle closed-mouth smile ASCII avatar</title>');
result = result.replace(/<desc>[\s\S]*?<\/desc>/, '<desc>Approved 40% closed-mouth smile, 10% facial softness. Original ASCII grid and stroke density preserved, with gently following moustache and continuous skin tone filling pale mouth gaps.</desc>');
const after = [...result.matchAll(pattern)];
assert.equal(after.length, marks.length, 'Character count must remain unchanged');
after.forEach((match, i) => {
  assert.equal(Number(match[1]), marks[i].x, 'ASCII columns must remain fixed');
  assert.equal(Number(match[2]), marks[i].y, 'ASCII rows must remain fixed');
});
const destination = path.join(assets, 'ramsey-retro-selected-portrait-smile.svg');
fs.writeFileSync(destination, result);
console.log(JSON.stringify({ destination, smile: 40, facialSoftness: 10, glyphs: marks.length, changedGlyphs, preventedPaleGaps, backedMouthCells: mouthToneCells.length, reducedStrokeDensity: 0 }));
