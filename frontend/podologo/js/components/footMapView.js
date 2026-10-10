/** Mapa interactivo del pie (vista plantar) — SVG con zonas seleccionables. */
import { esc } from '../utils/html.js';
import { AFECCIONES, ZONAS, LADOS, getAfeccion, markId, COLOR_OTRA } from '../domain/footMap.js';

const SIL =
  'M12 126 C60 98 140 88 190 106 C200 150 196 190 190 212 C170 236 146 246 140 285 ' +
  'C136 340 152 396 102 410 C56 420 40 384 42 340 C44 292 28 254 14 214 C2 182 4 150 12 126 Z';

const TOES = [
  ['dedo1', 146, 52, 28, 38, 'unia1', 146, 34, 15, 11],
  ['dedo2', 105, 60, 16, 27, 'unia2', 105, 44, 9, 7],
  ['dedo3', 76, 74, 14, 24, 'unia3', 76, 59, 8, 6.5],
  ['dedo4', 51, 92, 13, 21, 'unia4', 51, 77, 7.5, 6],
  ['dedo5', 28, 116, 12, 19, 'unia5', 28, 102, 7, 5.5],
];

const BODY_ZONES = [
  ['antepie_interno', 100, 100, 100, 100],
  ['antepie_central', 62, 100, 38, 100],
  ['antepie_externo', 0, 100, 62, 100],
  ['arco', 75, 200, 125, 100],
  ['borde_lateral', 0, 200, 75, 100],
  ['talon', 0, 300, 200, 130],
];

function zoneAttrs(lado, zona, ctx, extraClass = '') {
  const id = markId(lado, zona);
  const pending = ctx.pending.get(id);
  const saved = ctx.saved.get(id);
  let fill = '';
  let cls = `foot-zone ${extraClass}`.trim();
  let state = '';
  if (pending) {
    const af = getAfeccion(pending.afeccion);
    fill = `style="--zone-fill:${af ? af.color : COLOR_OTRA}"`;
    cls += ' is-pending';
    state = `${af ? af.nombre : ''} (sin guardar)`;
  } else if (saved) {
    fill = `style="--zone-fill:${saved.color}"`;
    cls += ' is-saved';
    state = saved.nombre;
  }
  if (ctx.active === id) cls += ' is-active';
  const label = `${LADOS[lado]} — ${ZONAS[zona]}${state ? `: ${state}` : ''}`;
  return `class="${cls}" ${fill} data-zona-id="${id}" role="button" tabindex="0" aria-pressed="${!!(pending || saved)}" aria-label="${esc(label)}"`;
}

export function renderFootSvg(lado, ctx) {
  const flip = lado === 'I' ? 'transform="translate(200 0) scale(-1 1)"' : '';
  const clipId = `clip-foot-${lado}`;
  const body = BODY_ZONES.map(
    ([z, x, y, w, h]) =>
      `<rect ${zoneAttrs(lado, z, ctx)} x="${x}" y="${y}" width="${w}" height="${h}" clip-path="url(#${clipId})"><title>${esc(ZONAS[z])}</title></rect>`
  ).join('');
  const toes = TOES.map(
    ([d, cx, cy, rx, ry, u, ux, uy, urx, ury]) => `
      <ellipse ${zoneAttrs(lado, d, ctx)} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"><title>${esc(ZONAS[d])}</title></ellipse>
      <ellipse ${zoneAttrs(lado, u, ctx, 'foot-nail')} cx="${ux}" cy="${uy}" rx="${urx}" ry="${ury}"><title>${esc(ZONAS[u])}</title></ellipse>`
  ).join('');

  return `
  <figure class="foot-figure" data-lado="${lado}">
    <svg viewBox="0 0 200 440" class="foot-svg" role="group" aria-label="${LADOS[lado]}, vista plantar">
      <defs><clipPath id="${clipId}"><path d="${SIL}"/></clipPath></defs>
      <g ${flip}>
        <path d="${SIL}" class="foot-outline"/>
        ${body}
        <path d="${SIL}" class="foot-outline foot-outline--stroke"/>
        ${toes}
      </g>
    </svg>
    <figcaption>${LADOS[lado]}</figcaption>
  </figure>`;
}

/**
 * @param {{ saved: Array, pending: Array<{id,afeccion}>, afeccionActiva: string, active?: string }} s
 */
export function renderFootMap(s) {
  const saved = new Map();
  s.saved.forEach((m) => saved.set(m.id, m)); // la última marca de la zona gana
  const pending = new Map(s.pending.map((m) => [m.id, m]));
  const ctx = { saved, pending, active: s.active || null };

  const palette = AFECCIONES.map(
    (a) => `
    <button type="button" class="af-chip${s.afeccionActiva === a.key ? ' is-on' : ''}" data-afeccion="${a.key}" style="--af:${a.color}" aria-pressed="${s.afeccionActiva === a.key}">
      <span class="af-dot"></span>${esc(a.nombre)}
    </button>`
  ).join('');

  return `
  <div class="footmap">
    <div class="af-palette" role="group" aria-label="Afecciones">${palette}</div>
    <div class="footmap-stage glass-soft" id="footmap-stage">
      ${renderFootSvg('D', ctx)}
      ${renderFootSvg('I', ctx)}
    </div>
    <p class="footmap-hint"><i class="fa-regular fa-hand-pointer"></i> Elige una afección y toca una zona del pie para marcarla. Toca de nuevo para quitarla.</p>
  </div>`;
}
