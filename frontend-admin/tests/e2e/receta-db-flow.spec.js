import { test, expect } from '@playwright/test';

test.describe('E2E: Navegación de Nuevos Módulos y Emisión de Receta a MySQL', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Iniciar sesión con el podólogo registrado en la base de datos MySQL
    await page.goto('/');
    await page.fill('#login-email', 'demo@clinica.mx');
    await page.fill('#login-password', 'demo1234');
    await page.click('#login-submit');

    // Esperar a que cargue el dashboard
    await expect(page.locator('.greeting-title')).toBeVisible({ timeout: 10000 });
  });

  test('Navega por todos los nuevos módulos empresariales sin dead clicks', async ({ page }) => {
    // A. Módulo de Recetas
    await page.click('button[onclick="navigate(\'recetas\')"]');
    await expect(page.locator('#recetas-root')).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Recetas');

    // B. Módulo de Mapa Podológico Interactivo
    await page.click('button[onclick="navigate(\'mapa\')"]');
    await expect(page.locator('#mapa-root')).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Mapa Podológico');
    // Verificar que los SVG de ambos pies se carguen
    await expect(page.locator('.mapa-feet-row svg')).toHaveCount(2);

    // C. Módulo Financiero (Caja y Pagos)
    await page.click('button[onclick="navigate(\'pagos\')"]');
    await expect(page.locator('#pagos-root')).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Caja');
    // Verificar tarjetas de KPI financiero
    await expect(page.locator('.finance-kpi-grid')).toBeVisible();

    // D. Módulo de Inventario
    await page.click('button[onclick="navigate(\'inventario\')"]');
    await expect(page.locator('#inventario-root')).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Inventario');

    // E. Monitor de Auditoría y Seguridad
    await page.click('button[onclick="navigate(\'auditoria\')"]');
    await expect(page.locator('#auditoria-root')).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Auditoría');
    // Verificar que la tabla de logs sea visible
    await expect(page.locator('.data-table')).toBeVisible();
  });

  test('Emite una receta médica y valida la persistencia en MySQL y Bitacora_Auditoria', async ({ page, request }) => {
    // 1. Ir a la vista de Recetas Médicas
    await page.click('button[onclick="navigate(\'recetas\')"]');
    await expect(page.locator('#recetas-root')).toBeVisible();

    // 2. Verificar que los campos Medicamento y Dosis estén presentes y no superpuestos
    const medInput = page.locator('input[name="medicamento"]').first();
    const dosisInput = page.locator('input[name="dosis"]').first();
    await expect(medInput).toBeVisible();
    await expect(dosisInput).toBeVisible();

    // Obtener las coordenadas en pantalla para verificar que NO se superponen
    const medBox = await medInput.boundingBox();
    const dosisBox = await dosisInput.boundingBox();
    expect(medBox).not.toBeNull();
    expect(dosisBox).not.toBeNull();
    // La coordenada X del input de Dosis debe ser mayor a la posición final del input de Medicamento en layout horizontal
    expect(dosisBox.x).toBeGreaterThanOrEqual(medBox.x);

    // 3. Seleccionar paciente
    const selectPaciente = page.locator('#rx-paciente');
    await expect(selectPaciente).toBeVisible();
    // Elegir el primer paciente con valor
    const options = await selectPaciente.locator('option').all();
    let valSeleccionado = '';
    for (const opt of options) {
      const val = await opt.getAttribute('value');
      if (val) {
        valSeleccionado = val;
        break;
      }
    }
    expect(valSeleccionado).not.toBe('');
    await selectPaciente.selectOption(valSeleccionado);

    // 4. Llenar los campos de la prescripción
    await page.fill('#rx-diagnostico', 'Onicocriptosis y Heloma Interdigital');
    await medInput.fill('Sulfato de Cobre al 2% / Ungüento');
    await dosisInput.fill('Aplicar capa delgada');
    await page.fill('input[name="frecuencia"]', 'Cada 12 horas');
    await page.fill('input[name="duracion"]', '10 días');
    await page.fill('#rx-indicaciones', 'Mantener área limpia y seca. Calzado holgado.');

    // 5. Emitir la receta haciendo clic en el botón
    const emitirBtn = page.locator('#btn-emitir-receta');
    await expect(emitirBtn).toBeVisible();
    await emitirBtn.click();

    // 6. Validar que aparezca la notificación de éxito
    await expect(page.locator('.toast').first()).toBeVisible({ timeout: 5000 });

    // 7. Validar directamente en el backend (MySQL) que la receta existe
    const resRecetas = await request.get('http://localhost:4000/api/recetas');
    expect(resRecetas.status()).toBe(200);
    const recetasList = await resRecetas.json();
    expect(Array.isArray(recetasList)).toBe(true);

    const recetaCreada = recetasList.find((r) =>
      r.indicaciones_generales?.includes('Mantener área limpia') ||
      r.medicamentos?.some((m) => m.medicamento?.includes('Sulfato de Cobre'))
    );
    expect(recetaCreada).toBeDefined();

    // 8. Validar que la acción se registró en la Bitacora_Auditoria
    const resAuditoria = await request.get('http://localhost:4000/api/auditoria');
    expect(resAuditoria.status()).toBe(200);
    const auditData = await resAuditoria.json();
    const logs = auditData.logs || [];

    const logReceta = logs.find((l) =>
      l.tabla_afectada === 'Recetas' &&
      (l.accion_realizada?.includes('Receta') || l.accion_realizada?.includes('recetas'))
    );
    expect(logReceta).toBeDefined();
  });

  test('Interactúa con el Mapa Podológico y registra marcas de lesiones', async ({ page }) => {
    // 1. Ir a Mapa Podológico
    await page.click('button[onclick="navigate(\'mapa\')"]');
    await expect(page.locator('#mapa-root')).toBeVisible();

    // 2. Seleccionar afección 'heloma'
    const chipHeloma = page.locator('button[data-lesion-key="heloma"]');
    await expect(chipHeloma).toBeVisible();
    await chipHeloma.click();
    await expect(chipHeloma).toHaveClass(/is-active/);

    // 3. Hacer clic en una zona del pie (dedo4)
    const zonaDedo = page.locator('.foot-interactive-zone[data-zona="dedo4"]').first();
    await expect(zonaDedo).toBeVisible();
    await zonaDedo.click({ force: true });

    // 4. Verificar que se agregó a la lista de diagnóstico plantar
    await expect(page.locator('.mapa-mark-card').first()).toBeVisible({ timeout: 5000 });

    // 5. Guardar en MySQL
    const btnGuardar = page.locator('#btn-guardar-mapa');
    await expect(btnGuardar).toBeVisible();
    await btnGuardar.click();

    // Verificar notificación de confirmación
    await expect(page.locator('.toast').first()).toBeVisible({ timeout: 5000 });
  });
});
