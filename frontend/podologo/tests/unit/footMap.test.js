import {
  describeMark,
  parseMapTag,
  stripMapMeta,
  marksToDiagnosticos,
  diagnosticosToMarks,
  toggleMark
} from '../../js/domain/footMap.js';

describe('Odontograma Podológico (Mapa del Pie)', () => {
  test('describeMark genera descripción legible de lado y zona', () => {
    expect(describeMark('D.dedo1')).toBe('Pie derecho — Hallux (dedo 1)');
    expect(describeMark('I.talon')).toBe('Pie izquierdo — Talón');
  });

  test('toggleMark agrega o retira marcas en zonas seleccionadas', () => {
    let marcas = [];
    marcas = toggleMark(marcas, 'D.dedo1', 'onicocriptosis');
    expect(marcas).toEqual([{ id: 'D.dedo1', afeccion: 'onicocriptosis' }]);

    // Si se presiona de nuevo con la misma afección, se retira
    marcas = toggleMark(marcas, 'D.dedo1', 'onicocriptosis');
    expect(marcas).toEqual([]);

    // Si se presiona con otra afección, se reemplaza
    marcas = toggleMark(marcas, 'D.dedo1', 'onicocriptosis');
    marcas = toggleMark(marcas, 'D.dedo1', 'hiperqueratosis');
    expect(marcas).toEqual([{ id: 'D.dedo1', afeccion: 'hiperqueratosis' }]);
  });

  test('marksToDiagnosticos agrupa por afección y genera payloads compatibles con MySQL', () => {
    const marcas = [
      { id: 'D.dedo1', afeccion: 'onicocriptosis' },
      { id: 'I.dedo1', afeccion: 'onicocriptosis' },
      { id: 'D.talon', afeccion: 'hiperqueratosis' }
    ];

    const diagnósticos = marksToDiagnosticos(marcas, 'CONS-001', 'Dolor moderado');
    expect(diagnósticos.length).toBe(2);

    const onico = diagnósticos.find(d => d.padecimiento === 'Onicocriptosis');
    expect(onico).toBeDefined();
    expect(onico.fk_consulta_id).toBe('CONS-001');
    expect(onico.pie_derecho).toBe(true);
    expect(onico.pie_izquierdo).toBe(true);
    expect(onico.tipo_diagnostico).toBe('Patología ungueal');
    expect(onico.detalles_adicionales).toContain('[mapa:D.dedo1,I.dedo1]');

    const hiper = diagnósticos.find(d => d.padecimiento === 'Hiperqueratosis');
    expect(hiper).toBeDefined();
    expect(hiper.pie_derecho).toBe(true);
    expect(hiper.pie_izquierdo).toBe(false);
  });

  test('parseMapTag y diagnosticosToMarks reconstruyen las marcas guardadas', () => {
    const rawDx = [
      {
        Diagnostico_id: 'DX-1',
        fk_consulta_id: 'CONS-001',
        padecimiento: 'Onicocriptosis',
        detalles_adicionales: 'Nota de prueba\n[mapa:D.dedo1,D.unia1]'
      }
    ];

    const marcas = diagnosticosToMarks(rawDx);
    expect(marcas.length).toBe(2);
    expect(marcas[0].id).toBe('D.dedo1');
    expect(marcas[0].afeccion).toBe('onicocriptosis');
    expect(marcas[1].id).toBe('D.unia1');

    expect(stripMapMeta(rawDx[0].detalles_adicionales)).toBe('Nota de prueba');
  });
});
