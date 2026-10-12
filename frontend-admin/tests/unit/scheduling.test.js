import {
  overlaps,
  findConflicts,
  findConflictPairs,
  suggestSlots,
  canTransition,
  validateCitaForm,
  buildAlerts,
  normalizeCita
} from '../../src/domain/scheduling.js';

describe('Dominio de Agenda Inteligente', () => {
  const citaA = {
    id: '1',
    start: new Date('2026-10-10T10:00:00'),
    end: new Date('2026-10-10T10:30:00'),
    duracionMin: 30,
    paciente: 'Carlos Mendoza',
    expediente: '101',
    podologo: 'CED001',
    estado: 'Confirmada'
  };

  const citaB = {
    id: '2',
    start: new Date('2026-10-10T11:00:00'),
    end: new Date('2026-10-10T11:30:00'),
    duracionMin: 30,
    paciente: 'Rosa Martinez',
    expediente: '102',
    podologo: 'CED001',
    estado: 'Programada'
  };

  test('overlaps detecta solapamiento temporal correcto', () => {
    // 10:00 a 10:30 choca con 10:15 a 10:45
    expect(overlaps(new Date('2026-10-10T10:00:00'), new Date('2026-10-10T10:30:00'), new Date('2026-10-10T10:15:00'), new Date('2026-10-10T10:45:00'))).toBe(true);
    // 10:00 a 10:30 NO choca con 10:30 a 11:00
    expect(overlaps(new Date('2026-10-10T10:00:00'), new Date('2026-10-10T10:30:00'), new Date('2026-10-10T10:30:00'), new Date('2026-10-10T11:00:00'))).toBe(false);
  });

  test('findConflicts detecta choque con mismo podólogo en el mismo intervalo', () => {
    const propuesta = {
      start: new Date('2026-10-10T10:15:00'),
      duracionMin: 30,
      podologo: 'CED001',
      expediente: '103'
    };
    const conflictos = findConflicts(propuesta, [citaA, citaB]);
    expect(conflictos.length).toBe(1);
    expect(conflictos[0].cita.id).toBe('1');
    expect(conflictos[0].mensaje).toContain('Horario ocupado por Carlos Mendoza');
  });

  test('findConflicts ignora citas canceladas', () => {
    const citaCancelada = { ...citaA, estado: 'Cancelada' };
    const propuesta = {
      start: new Date('2026-10-10T10:00:00'),
      duracionMin: 30,
      podologo: 'CED001',
      expediente: '103'
    };
    const conflictos = findConflicts(propuesta, [citaCancelada]);
    expect(conflictos.length).toBe(0);
  });

  test('findConflictPairs encuentra pares solapados en una lista', () => {
    const citaSolapada = {
      id: '3',
      start: new Date('2026-10-10T10:15:00'),
      end: new Date('2026-10-10T10:45:00'),
      duracionMin: 30,
      paciente: 'Pedro Gomez',
      podologo: 'CED001',
      estado: 'Programada'
    };
    const pares = findConflictPairs([citaA, citaSolapada, citaB]);
    expect(pares.length).toBe(1);
    expect(pares[0][0].id).toBe('1');
    expect(pares[0][1].id).toBe('3');
  });

  test('suggestSlots sugiere horarios libres válidos', () => {
    const slots = suggestSlots(new Date('2026-10-10T09:30:00'), [citaA, citaB], {
      podologo: 'CED001',
      limit: 2
    });
    expect(slots.length).toBe(2);
    // 09:30 está libre
    expect(slots[0].getHours()).toBe(9);
    expect(slots[0].getMinutes()).toBe(30);
    // 10:30 está libre (entre citaA y citaB)
    expect(slots[1].getHours()).toBe(10);
    expect(slots[1].getMinutes()).toBe(30);
  });

  test('canTransition valida transiciones legales de estado', () => {
    expect(canTransition('Programada', 'Confirmada')).toBe(true);
    expect(canTransition('Confirmada', 'Cancelada')).toBe(true);
    expect(canTransition('Realizada', 'Programada')).toBe(false); // Cita realizada no puede reabrirse
    expect(canTransition('Cancelada', 'Programada')).toBe(true); // Reactivación
  });

  test('validateCitaForm valida campos requeridos', () => {
    const ahora = new Date('2026-10-10T08:00:00');
    const invalido = validateCitaForm({ paciente: null, fecha: '', hora: '' }, ahora);
    expect(invalido.valid).toBe(false);
    expect(invalido.errors.paciente).toBeDefined();

    const valido = validateCitaForm({
      paciente: { expediente: '101' },
      fecha: '2026-10-10',
      hora: '10:00'
    }, ahora);
    expect(valido.valid).toBe(true);
    expect(valido.start).toBeInstanceOf(Date);
  });

  test('buildAlerts genera alertas de choque y citas vencidas', () => {
    const ahora = new Date('2026-10-10T10:15:00');
    const citas = [
      citaA, // 10:00 a 10:30 Confirmada (en curso / vencida de inicio)
      { ...citaA, id: '99', paciente: 'Elena', start: new Date('2026-10-10T10:10:00'), end: new Date('2026-10-10T10:40:00') }
    ];
    const alertas = buildAlerts(citas, ahora);
    expect(alertas.some(a => a.tipo === 'choque')).toBe(true);
  });
});
