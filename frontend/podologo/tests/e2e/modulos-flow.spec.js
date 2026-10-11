import { test, expect } from '@playwright/test';

test.describe('Flujo de Nuevos Módulos y Navegación Dinámica', () => {
  test.beforeEach(async ({ page }) => {
    // Iniciar sesión con el bypass de desarrollo
    await page.goto('/');
    await page.fill('#login-email', 'demo@clinica.mx');
    await page.fill('#login-password', 'demo1234');
    await page.click('#login-submit');
    await expect(page.locator('.greeting-title')).toBeVisible();
  });

  test('renderiza el Dashboard Analítico con KPIs y gráficos Glassmorphism', async ({ page }) => {
    // Validar contenedor del Dashboard
    const dashRoot = page.locator('#dashboard-root');
    await expect(dashRoot).toBeVisible();

    // Validar tarjetas de KPI
    await expect(page.locator('.kpi-grid')).toBeVisible();
    await expect(page.locator('.kpi')).toHaveCount(4);

    // Validar gráficos analíticos (barras CSS y Donut)
    await expect(page.locator('.bars')).toBeVisible();
    await expect(page.locator('.donut')).toBeVisible();

    // Validar panel de Agenda del turno
    await expect(page.locator('.agenda-item').first()).toBeVisible();
  });

  test('navega al Módulo de Inventario y permite filtrar insumos', async ({ page }) => {
    // Navegar mediante el sidebar
    await page.click('button[onclick="navigate(\'inventario\')"]');

    // Validar montaje de la vista de inventario
    const invRoot = page.locator('#inventario-root');
    await expect(invRoot).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Inventario');

    // Validar tabla de datos y botones de acción
    await expect(page.locator('.data-table')).toBeVisible();
    await expect(page.locator('#inv-buscar')).toBeVisible();

    // Filtrar por término
    await page.fill('#inv-buscar', 'Gasas');
    await expect(page.locator('#tabla-inventario tbody tr', { hasText: 'Gasas' })).toBeVisible();
  });

  test('navega al Módulo de Recetas Médicas con formulario ECE y exportación', async ({ page }) => {
    // Navegar mediante el sidebar
    await page.click('button[onclick="navigate(\'recetas\')"]');

    // Validar montaje de la vista de recetas
    const rxRoot = page.locator('#recetas-root');
    await expect(rxRoot).toBeVisible();
    await expect(page.locator('.page-title')).toContainText('Recetas médicas');

    // Validar campos del formulario
    await expect(page.locator('#rx-paciente')).toBeVisible();
    await expect(page.locator('#rx-diagnostico')).toBeVisible();
    await expect(page.locator('#form-receta button[type="submit"]')).toBeVisible();
  });
});
