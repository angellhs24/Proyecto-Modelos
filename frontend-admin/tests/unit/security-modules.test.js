import { sanitizeText, sanitizeNumber, sanitizeDeep, neutralizeText, isSafeEmail, isSafeExpediente } from '../../src/core/sanitize.js';
import { canAccessPage, can, normalizeRole, ROLES } from '../../src/core/rbac.js';
import { validateInsumo, validateMovimiento, aplicarMovimiento, estadoStock } from '../../src/domain/inventario.js';
import { validateReceta, normalizeReceta, buildRecetaDocument } from '../../src/domain/receta.js';
import { computeDashboard } from '../../src/domain/dashboard.js';

describe('Auditoría de Ciberseguridad & Validación de Entradas (XSS / RBAC)', () => {
  describe('Sanitización e Inmunización contra XSS', () => {
    test('neutraliza tags script, event handlers y vectores HTML peligrosos', () => {
      const malicious = '<script>alert("xss")</script>Hola <b onmouseover="alert(1)">Mundo</b>';
      const clean = sanitizeText(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert');
      expect(clean).not.toContain('onmouseover');
      expect(clean).toBe('Hola Mundo');
    });

    test('neutraliza comillas y caracteres de escape para evitar inyección en atributos o JS', () => {
      const vector = 'Juan " onclick="malicious()" \' `';
      const safe = neutralizeText(vector);
      expect(safe).not.toContain('"');
      expect(safe).not.toContain("'");
      expect(safe).not.toContain('`');
      expect(safe).not.toContain('onclick=');
    });

    test('sanitizeDeep limpia objetos recursivamente sin alterar campos secretos', () => {
      const payload = {
        nombre: '<svg onload=alert(1)>Carlos',
        notas: 'Paciente con dolor <iframe src="evil.com"></iframe>',
        password: 'PasswordConCarácteresEspeciales!',
      };
      const cleaned = sanitizeDeep(payload);
      expect(cleaned.nombre).toBe('Carlos');
      expect(cleaned.notas).toBe('Paciente con dolor');
      expect(cleaned.password).toBe('PasswordConCarácteresEspeciales!');
    });

    test('valida formatos seguros de email y expediente', () => {
      expect(isSafeEmail('doctor@clinica.mx')).toBe(true);
      expect(isSafeEmail('doctor<script>@clinica.mx')).toBe(false);
      expect(isSafeExpediente('2026140001')).toBe(true);
      expect(isSafeExpediente('2026"; DROP TABLE--')).toBe(false);
    });
  });

  describe('Control de Acceso Basado en Roles (RBAC)', () => {
    test('restringe acceso a módulos clínicos para el rol recepcion', () => {
      expect(canAccessPage(ROLES.RECEPCION, 'agenda')).toBe(true);
      expect(canAccessPage(ROLES.RECEPCION, 'agendar')).toBe(true);
      expect(canAccessPage(ROLES.RECEPCION, 'inventario')).toBe(true);
      expect(canAccessPage(ROLES.RECEPCION, 'consulta')).toBe(false);
      expect(canAccessPage(ROLES.RECEPCION, 'expediente')).toBe(false);
      expect(canAccessPage(ROLES.RECEPCION, 'recetas')).toBe(false);
    });

    test('concede acceso integral para el rol podólogo y administrador', () => {
      expect(canAccessPage(ROLES.PODOLOGO, 'consulta')).toBe(true);
      expect(canAccessPage(ROLES.PODOLOGO, 'recetas')).toBe(true);
      expect(canAccessPage(ROLES.PODOLOGO, 'expediente')).toBe(true);
      expect(can(ROLES.PODOLOGO, 'receta.emitir')).toBe(true);
      expect(can(ROLES.RECEPCION, 'receta.emitir')).toBe(false);
    });
  });

  describe('Integridad del Módulo de Inventario', () => {
    test('valida alta correcta de insumos y descarta stock negativo', () => {
      const valid = validateInsumo({
        nombre: 'Gasas estériles',
        categoria: 'Material de curación',
        unidad: 'paquete',
        stock: 20,
        stockMinimo: 5,
        costoUnitario: 35,
      });
      expect(valid.valid).toBe(true);

      const invalid = validateInsumo({
        nombre: '',
        categoria: 'Inexistente',
        unidad: 'pieza',
        stock: -10,
        stockMinimo: 0,
      });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors.nombre).toBeDefined();
    });

    test('impide salidas de inventario que superen el stock existente', () => {
      const insumo = { id: 'INS-01', nombre: 'Bisturí', stock: 5, unidad: 'pieza' };
      const res = validateMovimiento(insumo, { tipo: 'salida', cantidad: 10, motivo: 'Consulta' });
      expect(res.valid).toBe(false);
      expect(res.errors.cantidad).toContain('Stock insuficiente');
    });

    test('aplica movimiento y calcula stock resultante con precisión', () => {
      const insumo = { id: 'INS-01', nombre: 'Bisturí', stock: 10, unidad: 'pieza' };
      const res = aplicarMovimiento(insumo, { tipo: 'salida', cantidad: 3, motivo: 'Cirugía ungueal' });
      expect(res.insumo.stock).toBe(7);
      expect(res.movimiento.tipo).toBe('salida');
      expect(res.movimiento.cantidad).toBe(3);
    });
  });

  describe('Integridad del Módulo de Recetas y ECE Documental', () => {
    test('valida y construye prescripciones médicas con formato seguro', () => {
      const r = {
        folio: 'RX-20261009-0001',
        expediente: '2026140001',
        paciente: 'Carlos Mendoza',
        diagnostico: 'Heloma interdigital',
        medicamentos: [
          { medicamento: 'Ácido salicílico 10%', dosis: '1 gota', via: 'Tópica', frecuencia: 'Cada 24 h', duracion: '5 días' }
        ],
        podologo: { nombre: 'Dr. Ángel Hernández', cedula: '0000001' }
      };
      expect(validateReceta(r).valid).toBe(true);
      const html = buildRecetaDocument(r);
      expect(html).toContain('Heloma interdigital');
      expect(html).toContain('Ácido salicílico');
      expect(html).toContain('Cédula profesional 0000001');
    });
  });

  describe('Cálculo del Dashboard Analítico', () => {
    test('computa indicadores clave, tasas y citas de hoy correctamente', () => {
      const hoy = new Date();
      const dash = computeDashboard({
        appointments: [
          { Consulta_id: 1, fecha_hora: hoy.toISOString(), estado: 'Completada', motivo: 'Quiropodia' },
          { Consulta_id: 2, fecha_hora: hoy.toISOString(), estado: 'Cancelada', motivo: 'Revisión' },
        ],
        patients: [
          { id_paciente: 1, es_diabetico: true, es_hipertenso: false },
          { id_paciente: 2, es_diabetico: false, es_hipertenso: true },
        ],
        insumos: [
          { id: 'INS-1', nombre: 'Gasas', stock: 0, stockMinimo: 5, costoUnitario: 10 },
        ],
        now: hoy,
      });

      expect(dash.citasHoy).toBe(2);
      expect(dash.pacientesTotal).toBe(2);
      expect(dash.diabeticos).toBe(1);
      expect(dash.inventario.agotados).toBe(1);
      expect(dash.tasaAtencion).toBe(50);
      expect(dash.tasaCancelacion).toBe(50);
    });
  });
});
