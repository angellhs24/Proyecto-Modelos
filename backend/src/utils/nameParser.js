/**
 * Utilidad robusta para parsear nombres completos en español / hispanoamericanos
 * separando en Nombres, Primer Apellido (ape_paterno) y Segundo Apellido (ape_materno).
 * 
 * Soporta:
 * - Partículas compuestas de apellidos (de, del, la, las, los, san, santa, etc.)
 * - Nombres de pila compuestos (ej: Luis Angel, Ana Bertha, Maria Dolores, Daniel Alejandro)
 * - Apellidos compuestos (ej: De La Cruz, Del Rio, San Martin)
 */
function parseNombreCompleto(nombreCompleto = '') {
  const raw = (nombreCompleto || '').trim().replace(/\s+/g, ' ');
  if (!raw) {
    return { nombres: 'Paciente', apePaterno: 'Sin Apellido', apeMaterno: null };
  }

  // Preposiciones y artículos habituales en apellidos y nombres hispanos
  const particles = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'da', 'di', 'von', 'van', 'y']);

  const rawTokens = raw.split(' ');
  if (rawTokens.length === 1) {
    return { nombres: rawTokens[0], apePaterno: 'Sin Apellido', apeMaterno: null };
  }
  if (rawTokens.length === 2) {
    return { nombres: rawTokens[0], apePaterno: rawTokens[1], apeMaterno: null };
  }

  // Agrupar partículas compuestas (ej: "de la Cruz", "del Rio", "San Martin")
  const grouped = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const lower = rawTokens[i].toLowerCase();
    if (particles.has(lower) && i + 1 < rawTokens.length && grouped.length > 0) {
      let compound = rawTokens[i];
      while (i + 1 < rawTokens.length && particles.has(rawTokens[i + 1].toLowerCase())) {
        i++;
        compound += ' ' + rawTokens[i];
      }
      if (i + 1 < rawTokens.length) {
        i++;
        compound += ' ' + rawTokens[i];
      }
      grouped.push(compound);
    } else {
      grouped.push(rawTokens[i]);
    }
  }

  if (grouped.length === 2) {
    return { nombres: grouped[0], apePaterno: grouped[1], apeMaterno: null };
  }
  if (grouped.length === 3) {
    return { nombres: grouped[0], apePaterno: grouped[1], apeMaterno: grouped[2] };
  }

  // 4 o más bloques agrupados (ej: "Luis Angel Hernandez Santillan" o "Daniel Alejandro Ewald Soto"):
  // Los últimos 2 bloques son los apellidos paterno y materno; los anteriores son los nombres.
  const apeMaterno = grouped[grouped.length - 1];
  const apePaterno = grouped[grouped.length - 2];
  const nombres = grouped.slice(0, grouped.length - 2).join(' ');

  return { nombres, apePaterno, apeMaterno };
}

module.exports = {
  parseNombreCompleto
};
