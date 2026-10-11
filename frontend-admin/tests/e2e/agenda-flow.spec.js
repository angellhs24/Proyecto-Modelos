import { test, expect } from '@playwright/test';

test.describe('Flujo de Agenda Inteligente', () => {
  test.beforeEach(async ({ page }) => {
    // Autenticar previamente en sessionStorage
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.setItem('efc.session', JSON.stringify({
        token: null,
        demo: true,
        podologo: {
          cedula: '0000001',
          nombre: 'Demo',
          ape_paterno: 'Podólogo',
          nombreCompleto: 'Demo Podólogo',
          email: 'demo@clinica.mx'
        },
        lastActivity: Date.now()
      }));
    });
    await page.goto('/#/agenda');
  });

  test('renderiza el calendario FullCalendar y sus controles de vista', async ({ page }) => {
    await expect(page.locator('#agenda-root')).toBeVisible();
    await expect(page.locator('#calendar')).toBeVisible();

    // Comprobar que los botones de FullCalendar existen (Hoy, Mes, Semana, etc.)
    await expect(page.locator('.fc-today-button')).toBeVisible();
    await expect(page.locator('.fc-dayGridMonth-button')).toBeVisible();
    await expect(page.locator('.fc-timeGridWeek-button')).toBeVisible();
  });

  test('abre modal de nueva cita y busca paciente', async ({ page }) => {
    await page.click('#btn-nueva-cita');
    await expect(page.locator('#modal-cita')).toBeVisible();

    // Escribir en el buscador de paciente
    await page.fill('#cita-buscar', 'Carlos');
    await expect(page.locator('#cita-resultados')).toBeVisible();

    // Seleccionar el resultado disponible
    const primerResultado = page.locator('#cita-resultados li').first();
    await expect(primerResultado).toBeVisible();
    await primerResultado.click();
    await expect(page.locator('#cita-paciente-sel')).toBeVisible();
  });

  test('detecta choque de horarios al coincidir con una cita existente', async ({ page }) => {
    const fechaTest = '2026-11-20';
    const horaTest = '10:00';

    await page.click('#btn-nueva-cita');
    await expect(page.locator('#modal-cita')).toBeVisible();

    // Inyectar cita conflictiva en agendaStore con el modal ya abierto
    await page.evaluate(({ f, h }) => {
      const debug = window.Modules?._debug?.();
      const start = new Date(`${f}T${h}:00`);
      const end = new Date(start.getTime() + 30 * 60000);
      const citaConflicto = {
        id: 'test-9999',
        id_cita: 9999,
        fecha_hora_inicio: `${f} ${h}`,
        hora: h,
        ampm: 'AM',
        paciente_nombre: 'Paciente Conflicto',
        paciente: 'Paciente Conflicto',
        estado: 'Confirmada',
        id_clinica: 14,
        fk_clinica_id: 14,
        start,
        end,
        podologo: '0000001'
      };

      window.state?.appointments?.unshift(citaConflicto);
      if (debug?.agendaStore) {
        debug.agendaStore.upsert(citaConflicto);
      }
    }, { f: fechaTest, h: horaTest });

    // Seleccionar paciente
    await page.fill('#cita-buscar', 'Rosa');
    await expect(page.locator('#cita-resultados')).toBeVisible();
    await page.click('#cita-resultados li:first-child');

    // Asignar fecha y hora que coincide con la cita conflictiva
    await page.fill('#cita-fecha', fechaTest);
    await page.fill('#cita-hora', horaTest);
    await page.dispatchEvent('#cita-hora', 'input');

    // Debe mostrar la alerta visual de choque de horario
    await expect(page.locator('#aviso-choque')).toBeVisible();
    await expect(page.locator('#aviso-choque')).toContainText('Choque de horario');
  });
});
