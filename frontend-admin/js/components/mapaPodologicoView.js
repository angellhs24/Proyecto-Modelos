/**
 * Módulo de Odontograma / Mapa Podológico Interactivo
 * Permite marcar afecciones por zona plantar en Pie Derecho e Izquierdo
 * y persiste las lesiones directamente en la tabla Detalles_Mapa_Podologico de MySQL.
 */
import { esc } from '../utils/html.js';
import { mapaPodologicoApi, pacientesApi, consultasApi } from '../api/index.js';
import { pageHeader } from './shellView.js';
import { notify, skeleton } from './ui.js';
import { LADOS, ZONAS, AFECCIONES, getAfeccion } from '../domain/footMap.js';

export function renderMapaShell() {
  return '<section class="module" id="mapa-root" aria-live="polite"></section>';
}

const SILHOUETTE =
  'M12 126 C60 98 140 88 190 106 C200 150 196 190 190 212 C170 236 146 246 140 285 ' +
  'C136 340 152 396 102 410 C56 420 40 384 42 340 C44 292 28 254 14 214 C2 182 4 150 12 126 Z';

const DEDOS_CONFIG = [
  { id: 'dedo1', cx: 146, cy: 52, rx: 28, ry: 38, uniaId: 'unia1', ux: 146, uy: 34, urx: 15, ury: 11 },
  { id: 'dedo2', cx: 105, cy: 60, rx: 16, ry: 27, uniaId: 'unia2', ux: 105, uy: 44, urx: 9, ury: 7 },
  { id: 'dedo3', cx: 76, cy: 74, rx: 14, ry: 24, uniaId: 'unia3', ux: 76, uy: 59, urx: 8, ury: 6.5 },
  { id: 'dedo4', cx: 51, cy: 92, rx: 13, ry: 21, uniaId: 'unia4', ux: 51, uy: 77, urx: 7.5, ury: 6 },
  { id: 'dedo5', cx: 28, cy: 116, rx: 12, ry: 19, uniaId: 'unia5', ux: 28, uy: 102, urx: 7, ury: 5.5 }
];

const ZONAS_CUERPO = [
  { id: 'antepie_interno', x: 100, y: 100, w: 100, h: 100 },
  { id: 'antepie_central', x: 62, y: 100, w: 38, h: 100 },
  { id: 'antepie_externo', x: 0, y: 100, w: 62, h: 100 },
  { id: 'arco', x: 75, y: 200, w: 125, h: 100 },
  { id: 'borde_lateral', x: 0, y: 200, w: 75, h: 100 },
  { id: 'talon', x: 0, y: 300, w: 200, h: 130 }
];

/**
 * @param {HTMLElement} root
 * @param {{ clinicName: Function }} ctx
 */
export function mountMapa(root, ctx = {}) {
  const S = {
    status: 'loading',
    pacientes: [],
    expedienteSeleccionado: '',
    consultaId: '',
    lesionActiva: 'onicocriptosis', // key por defecto
    // marcas: Array de { zonaKey: 'D.dedo1', lado: 'D', zona: 'dedo1', zonaNombre: 'Hallux Derecho', tipo_lesion: 'Onicocriptosis', color: '#7c3aed', observaciones: '', dbId?: number }
    marcas: [],
    isSaving: false
  };

  async function load() {
    try {
      const pacs = await pacientesApi.list();
      S.pacientes = Array.isArray(pacs) ? pacs : [];
      if (S.pacientes.length > 0 && !S.expedienteSeleccionado) {
        S.expedienteSeleccionado = String(S.pacientes[0].No_expediente || S.pacientes[0].expediente || '');
      }

      if (S.expedienteSeleccionado) {
        await cargarMarcasPaciente(S.expedienteSeleccionado);
      }
      S.status = 'ready';
    } catch (err) {
      console.error('Error al inicializar mapa:', err);
      S.status = 'ready';
    }
    paint();
  }

  async function cargarMarcasPaciente(exp) {
    try {
      const guardadas = await mapaPodologicoApi.list({ expediente: exp });
      S.marcas = guardadas.map((g) => {
        const af = AFECCIONES.find((a) => a.nombre.toLowerCase() === (g.tipo_lesion || '').toLowerCase()) || {
          color: '#c85a32'
        };
        return {
          zonaKey: g.zona_pie,
          zonaNombre: g.zona_pie,
          tipo_lesion: g.tipo_lesion,
          color: af.color,
          observaciones: g.observaciones || '',
          dbId: g.Mapa_id || g.id
        };
      });
    } catch (err) {
      console.warn('Error al cargar marcas guardadas:', err);
      S.marcas = [];
    }
  }

  function getNombreZonaLegible(lado, zonaId) {
    const ladoStr = lado === 'D' ? 'Derecho' : 'Izquierdo';
    const nombreBase = ZONAS[zonaId] || zonaId;
    return `${nombreBase} (${ladoStr})`;
  }

  function renderFootSvg(lado) {
    const flip = lado === 'I' ? 'transform="translate(200 0) scale(-1 1)"' : '';
    const clipId = `clip-mapa-${lado}`;

    const marcasMap = new Map();
    S.marcas.forEach((m) => {
      marcasMap.set(m.zonaKey, m);
    });

    const getZoneAttributes = (zonaId) => {
      const zonaKey = `${lado}.${zonaId}`;
      const marca = marcasMap.get(zonaKey) || marcasMap.get(getNombreZonaLegible(lado, zonaId));
      const isSelected = !!marca;
      const fillStyle = isSelected ? `style="--active-lesion-color: ${marca.color}; fill: ${marca.color} !important;"` : '';
      const cls = `foot-interactive-zone ${isSelected ? 'is-selected' : ''}`;
      const label = esc(getNombreZonaLegible(lado, zonaId));
      return `class="${cls}" ${fillStyle} data-lado="${lado}" data-zona="${zonaId}" data-zonakey="${zonaKey}" aria-label="${label}"`;
    };

    const bodySvg = ZONAS_CUERPO.map(
      (z) =>
        `<rect ${getZoneAttributes(z.id)} x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" clip-path="url(#${clipId})"><title>${esc(ZONAS[z.id])}</title></rect>`
    ).join('');

    const dedosSvg = DEDOS_CONFIG.map(
      (d) => `
      <ellipse ${getZoneAttributes(d.id)} cx="${d.cx}" cy="${d.cy}" rx="${d.rx}" ry="${d.ry}"><title>${esc(ZONAS[d.id])}</title></ellipse>
      <ellipse ${getZoneAttributes(d.uniaId)} cx="${d.ux}" cy="${d.uy}" rx="${d.urx}" ry="${d.ury}"><title>${esc(ZONAS[d.uniaId])}</title></ellipse>
    `
    ).join('');

    return `
      <div style="text-align:center;">
        <h4 style="font-size:14px; color:var(--secondary); margin-bottom:10px;">
          <i class="fa-solid fa-shoe-prints" style="color:var(--primary);"></i> ${LADOS[lado]}
        </h4>
        <svg viewBox="0 0 200 440" style="width:200px; height:440px; filter:drop-shadow(0 4px 12px rgba(0,0,0,0.06));">
          <defs>
            <clipPath id="${clipId}"><path d="${SILHOUETTE}"/></clipPath>
          </defs>
          <g ${flip}>
            <path d="${SILHOUETTE}" fill="#fdfbf9" stroke="#d5c8be" stroke-width="2" pointer-events="none"/>
            ${bodySvg}
            <path d="${SILHOUETTE}" fill="none" stroke="#2b221e" stroke-width="1.2" opacity="0.4" pointer-events="none"/>
            ${dedosSvg}
          </g>
        </svg>
      </div>
    `;
  }

  function paint() {
    if (S.status === 'loading') {
      root.innerHTML =
        pageHeader({
          title: 'Mapa Podológico Interactivo',
          icon: 'fa-shoe-prints',
          subtitle: 'Odontograma podológico y mapeo de afecciones plantares'
        }) + skeleton(6);
      return;
    }

    const lesionActual = getAfeccion(S.lesionActiva) || AFECCIONES[0];

    root.innerHTML = `
      ${pageHeader({
        title: 'Mapa Podológico Interactivo (Odontograma)',
        icon: 'fa-shoe-prints',
        subtitle: 'Exploración plantar anatómica con persistencia directa en MySQL',
        actions: `
          <button type="button" class="efc-btn efc-btn--primary" id="btn-guardar-mapa" ${S.isSaving ? 'disabled' : ''}>
            <i class="fa-solid ${S.isSaving ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}" aria-hidden="true"></i> Guardar en Base de Datos
          </button>
          <button type="button" class="efc-btn efc-btn--ghost" id="btn-limpiar-mapa">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Limpiar Marcas
          </button>
        `
      })}

      <!-- SELECTOR DE PACIENTE Y PALETA DE LESIONES -->
      <div class="panel glass-panel" style="padding:18px 24px; margin-bottom:20px;">
        <div style="display:grid; grid-template-columns: 1.2fr 2fr; gap:20px; align-items:center;">
          <label class="field" style="margin:0;">
            <span style="font-size:12px; font-weight:700; color:var(--secondary);"><i class="fa-solid fa-user-injured"></i> Paciente Activo:</span>
            <select id="mapa-paciente-select" style="padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              ${S.pacientes
                .map(
                  (p) => `
                <option value="${esc(p.No_expediente || p.expediente || p.id_paciente)}" ${String(p.No_expediente || p.expediente) === String(S.expedienteSeleccionado) ? 'selected' : ''}>
                  ${esc(p.Nombres ? `${p.Nombres} ${p.ape_paterno}` : p.nombre_completo || 'Paciente')} · Exp: ${esc(p.No_expediente || p.expediente)}
                </option>`
                )
                .join('')}
            </select>
          </label>

          <div>
            <span style="font-size:12px; font-weight:700; color:var(--secondary); display:block; margin-bottom:8px;">
              <i class="fa-solid fa-palette"></i> Tipo de Lesión Activa (Haz clic y luego toca la zona del pie):
            </span>
            <div class="lesion-palette">
              ${AFECCIONES.map(
                (af) => `
                <button type="button" class="lesion-chip ${S.lesionActiva === af.key ? 'is-active' : ''}" data-lesion-key="${esc(af.key)}">
                  <span class="lesion-dot" style="background:${esc(af.color)};"></span>
                  <span>${esc(af.nombre)}</span>
                </button>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- LAYOUT DEL MAPA Y PANEL LATERAL DE LESIONES REGISTRADAS -->
      <div class="mapa-layout">
        <!-- ZONA DE MAPA VISUAL SVG -->
        <div class="mapa-canvas-box glass-panel">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:16px;">
            <span style="font-size:12px; color:var(--text-muted);">
              <i class="fa-solid fa-circle-info"></i> Toca una zona del pie para registrar <strong>${esc(lesionActual.nombre)}</strong>. Toca de nuevo para desmarcar.
            </span>
            <span class="pill pill--ok">${S.marcas.length} zonas marcadas</span>
          </div>

          <div class="mapa-feet-row">
            ${renderFootSvg('D')}
            ${renderFootSvg('I')}
          </div>
        </div>

        <!-- PANEL LATERAL DE LISTA DE LESIONES -->
        <div class="panel glass-panel" style="padding:18px; display:flex; flex-direction:column;">
          <h4 style="font-size:15px; color:var(--secondary); margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
            <span><i class="fa-solid fa-clipboard-list" style="color:var(--primary);"></i> Diagnóstico Plantar</span>
            <span class="pill pill--ok">${S.marcas.length}</span>
          </h4>

          ${
            S.marcas.length === 0
              ? `<div style="text-align:center; padding:40px 10px; color:var(--text-muted); font-size:12.5px;">
                   <i class="fa-regular fa-hand-pointer" style="font-size:28px; margin-bottom:10px; opacity:0.5;"></i>
                   <p>Selecciona una afección y toca cualquier parte del pie derecho o izquierdo para mapear la lesión.</p>
                 </div>`
              : `
            <ul class="mapa-marks-list">
              ${S.marcas
                .map(
                  (m, idx) => `
                <li class="mapa-mark-card">
                  <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                      <span class="lesion-dot" style="background:${esc(m.color)};"></span>
                      <strong style="font-size:12.5px; color:var(--secondary);">${esc(m.tipo_lesion)}</strong>
                    </div>
                    <small style="color:var(--text-muted); display:block; font-size:11px;">
                      ${esc(m.zonaNombre || m.zonaKey)}
                    </small>
                    <input 
                      type="text" 
                      placeholder="Observaciones clínicas..." 
                      value="${esc(m.observaciones || '')}" 
                      data-obs-idx="${idx}"
                      style="margin-top:6px; padding:4px 8px; font-size:11px; width:100%; border-radius:4px; border:1px solid var(--border);"
                    >
                  </div>
                  <button type="button" class="efc-btn efc-btn--ghost efc-btn--icon" data-del-marca="${idx}" title="Eliminar marca">
                    <i class="fa-solid fa-xmark" style="color:var(--accent-rose);"></i>
                  </button>
                </li>`
                )
                .join('')}
            </ul>
          `
          }
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Cambio de paciente
    root.querySelector('#mapa-paciente-select')?.addEventListener('change', async (e) => {
      S.expedienteSeleccionado = e.target.value;
      notify('Cargando mapa podológico del paciente...');
      await cargarMarcasPaciente(S.expedienteSeleccionado);
      paint();
    });

    // Selección de afección activa
    root.querySelectorAll('[data-lesion-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        S.lesionActiva = btn.dataset.lesionKey;
        paint();
      });
    });

    // Clics interactivos en zonas del pie
    root.querySelectorAll('.foot-interactive-zone').forEach((zoneEl) => {
      zoneEl.addEventListener('click', () => {
        const lado = zoneEl.dataset.lado;
        const zonaId = zoneEl.dataset.zona;
        const zonaKey = zoneEl.dataset.zonakey;
        const nombreLegible = getNombreZonaLegible(lado, zonaId);

        const af = getAfeccion(S.lesionActiva) || AFECCIONES[0];

        // Revisar si ya está marcada esa zona
        const idxExistente = S.marcas.findIndex(
          (m) => m.zonaKey === zonaKey || m.zonaNombre === nombreLegible
        );

        if (idxExistente !== -1) {
          // Si tenía la misma lesión, la quitamos (toggle)
          if (S.marcas[idxExistente].tipo_lesion === af.nombre) {
            S.marcas.splice(idxExistente, 1);
          } else {
            // Si tenía otra, actualizamos a la nueva lesión
            S.marcas[idxExistente].tipo_lesion = af.nombre;
            S.marcas[idxExistente].color = af.color;
          }
        } else {
          // Agregar nueva marca
          S.marcas.push({
            zonaKey,
            zonaNombre: nombreLegible,
            tipo_lesion: af.nombre,
            color: af.color,
            observaciones: ''
          });
        }
        paint();
      });
    });

    // Eliminar marca individual
    root.querySelectorAll('[data-del-marca]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.delMarca, 10);
        S.marcas.splice(idx, 1);
        paint();
      });
    });

    // Observaciones por marca
    root.querySelectorAll('[data-obs-idx]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(input.dataset.obsIdx, 10);
        if (S.marcas[idx]) {
          S.marcas[idx].observaciones = e.target.value;
        }
      });
    });

    // Limpiar todas las marcas
    root.querySelector('#btn-limpiar-mapa')?.addEventListener('click', () => {
      if (S.marcas.length === 0) return;
      if (confirm('¿Deseas desmarcar todas las zonas del mapa actual?')) {
        S.marcas = [];
        paint();
      }
    });

    // Guardar en MySQL
    root.querySelector('#btn-guardar-mapa')?.addEventListener('click', async () => {
      if (!S.expedienteSeleccionado) {
        notify('Selecciona un paciente para guardar el mapa podológico');
        return;
      }

      if (S.marcas.length === 0) {
        notify('Marca al menos una zona en el pie antes de guardar');
        return;
      }

      S.isSaving = true;
      paint();

      try {
        const payload = {
          expediente: S.expedienteSeleccionado,
          lesiones: S.marcas.map((m) => ({
            zona_pie: m.zonaNombre || m.zonaKey,
            tipo_lesion: m.tipo_lesion,
            observaciones: m.observaciones || ''
          }))
        };

        const res = await mapaPodologicoApi.saveBatch(payload);
        notify('Mapa podológico guardado exitosamente en MySQL');
        await cargarMarcasPaciente(S.expedienteSeleccionado);
      } catch (err) {
        notify('Error al guardar mapa: ' + (err.message || 'Error de conexión'));
      } finally {
        S.isSaving = false;
        paint();
      }
    });
  }

  load();

  return {
    destroy: () => {},
    reload: load
  };
}
