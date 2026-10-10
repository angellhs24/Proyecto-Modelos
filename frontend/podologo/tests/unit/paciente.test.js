import {
  normalizePaciente,
  normalizeConsulta,
  sortConsultas,
  validateDiagnostico,
  validateTratamiento,
  validateDocumento
} from '../../js/domain/paciente.js';

describe('Dominio de Paciente y Expediente Clínico', () => {
  test('normalizePaciente procesa campos MySQL y calcula edad', () => {
    const raw = {
      No_expediente: 2026140001,
      Nombres: 'Rosa Maria',
      ape_paterno: 'Martinez',
      ape_materno: 'Lopez',
      telefono: '5541238970',
      Fecha_nacimiento: '1970-05-15',
      Sexo: 'F',
      Calzado: 24.5,
      es_diabetico: 1,
      es_hipertenso: 0
    };

    const p = normalizePaciente(raw);
    expect(p.expediente).toBe('2026140001');
    expect(p.nombre).toBe('Rosa Maria Martinez Lopez');
    expect(p.sexo).toBe('Femenino');
    expect(p.calzado).toBe(24.5);
    expect(p.esDiabetico).toBe(true);
    expect(p.esHipertenso).toBe(false);
    expect(p.edad).toBeGreaterThan(45);
  });

  test('normalizeConsulta calcula IMC y clasifica estado ponderal', () => {
    const raw = {
      Consulta_id: 'C-001',
      fecha_hora: '2026-10-06 10:00:00',
      estado: 'Realizada',
      Peso: 70.0,
      Altura: 1.70
    };

    const c = normalizeConsulta(raw);
    expect(c.id).toBe('C-001');
    expect(c.imc.valor).toBe(24.2);
    expect(c.imc.clasificacion).toBe('Normal');
  });

  test('sortConsultas ordena por fecha descendente', () => {
    const lista = [
      { id: '1', fecha: new Date('2026-01-01') },
      { id: '2', fecha: new Date('2026-08-01') },
      { id: '3', fecha: new Date('2026-05-01') }
    ];
    const ord = sortConsultas(lista);
    expect(ord.map(x => x.id)).toEqual(['2', '3', '1']);
  });

  test('validadores de Diagnósticos, Tratamientos y Documentos', () => {
    // Diagnostico
    expect(validateDiagnostico({ fk_consulta_id: '', padecimiento: '' }).valid).toBe(false);
    expect(validateDiagnostico({ fk_consulta_id: 'C1', padecimiento: 'Heloma', pie_derecho: true }).valid).toBe(true);

    // Tratamiento
    expect(validateTratamiento({ fk_consulta_id: 'C1', procedimiento_servicio: '' }).valid).toBe(false);
    expect(validateTratamiento({
      fk_consulta_id: 'C1',
      procedimiento_servicio: 'Quiropodia',
      pie_izquierdo: true,
      fecha_inicio: '2026-10-10',
      fecha_fin: '2026-10-01' // fin menor que inicio
    }).valid).toBe(false);

    // Documento
    const fakeFile = { type: 'application/pdf', size: 1024 };
    expect(validateDocumento({ consultaId: '', tipo: '', file: null }).valid).toBe(false);
    expect(validateDocumento({ consultaId: 'C1', tipo: 'Consentimiento', file: fakeFile }).valid).toBe(true);
  });
});
