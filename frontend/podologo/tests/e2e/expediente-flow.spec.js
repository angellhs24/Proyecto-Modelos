import { test, expect } from '@playwright/test';

test.describe('Flujo de Expediente Clínico Electrónico (ECE)', () => {
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
  });

  test('abre el expediente clínico desde la tabla de pacientes', async ({ page }) => {
    await page.goto('/#/pacientes');
    await expect(page.locator('.patients-list-table')).toBeVisible();

    // Localizar botón de expediente en la primera fila y hacer clic
    const btnExp = page.locator('.patients-list-table [data-testid^="btn-expediente-"]').first();
    await expect(btnExp).toBeVisible();
    await btnExp.click();

    // Debe abrir la vista del ECE y mostrar el encabezado con el número de expediente
    await expect(page.locator('#ece-root')).toBeVisible();
    await expect(page.locator('#ece-patient-name')).toBeVisible();
    await expect(page.locator('.ece-tabs')).toBeVisible();
  });

  test('interactúa con el mapa interactivo del pie y marca afecciones', async ({ page }) => {
    // Acceder directo al expediente demo
    await page.goto('/#/expediente/2026140001');
    await expect(page.locator('#ece-root')).toBeVisible();

    // Cambiar a la pestaña "Mapa del pie"
    await expect(page.locator('#tab-mapa')).toBeVisible();
    await page.click('#tab-mapa');
    await expect(page.locator('.footmap')).toBeVisible();
    await expect(page.locator('#footmap-stage')).toBeVisible();

    // Elegir una afección de la paleta (ej. Onicocriptosis)
    const chipOnico = page.locator('.af-chip[data-afeccion="onicocriptosis"]');
    await expect(chipOnico).toBeVisible();
    await chipOnico.click();
    await expect(chipOnico).toHaveClass(/is-on/);

    // Hacer clic en una zona del pie (dedo 1 pie derecho)
    const zonaDedo1 = page.locator('[data-zona-id="D.dedo1"]').first();
    await expect(zonaDedo1).toBeVisible();
    await zonaDedo1.click();

    // Debe mostrar la marca en la lista de marcas por guardar
    await expect(page.locator('#pending-list')).toBeVisible();
    await expect(page.locator('#pending-list')).toContainText('Onicocriptosis');
  });

  test('navega entre pestañas de diagnósticos, tratamientos y documentos', async ({ page }) => {
    await page.goto('/#/expediente/2026140001');
    await expect(page.locator('#ece-root')).toBeVisible();

    // Diagnósticos
    await expect(page.locator('#tab-diagnosticos')).toBeVisible();
    await page.click('#tab-diagnosticos');
    await expect(page.locator('#form-diagnostico')).toBeVisible();
    await expect(page.locator('#dx-padecimiento')).toBeVisible();

    // Tratamientos
    await expect(page.locator('#tab-tratamientos')).toBeVisible();
    await page.click('#tab-tratamientos');
    await expect(page.locator('#form-tratamiento')).toBeVisible();
    await expect(page.locator('#tx-procedimiento')).toBeVisible();

    // Documentos
    await expect(page.locator('#tab-documentos')).toBeVisible();
    await page.click('#tab-documentos');
    await expect(page.locator('#form-documento')).toBeVisible();
    await expect(page.locator('#dropzone')).toBeVisible();
  });
});
