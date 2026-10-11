import { test, expect } from '@playwright/test';

test.describe('Flujo de Autenticación y Protección de Vistas', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar sessionStorage antes de cada prueba
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
  });

  test('redirige a pantalla de login cuando no hay sesión activa', async ({ page }) => {
    await page.goto('/#/agenda');
    // Debe mostrar la tarjeta de login
    await expect(page.locator('#login-card')).toBeVisible();
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
  });

  test('inicia sesión con credenciales y accede al dashboard clínico', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-card')).toBeVisible();

    // Llenar formulario
    await page.fill('#login-email', 'demo@clinica.mx');
    await page.fill('#login-password', 'demo1234');
    await page.click('#login-submit');

    // Debe acceder al consultorio y mostrar el topbar con el saludo al doctor
    await expect(page.locator('.greeting-title')).toBeVisible();
    await expect(page.locator('.greeting-title')).toContainText('Hola, Dr.');

    // Verificar que el sidebar esté disponible
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('permite cerrar sesión y bloquea las vistas protegidas', async ({ page }) => {
    // Iniciar sesión
    await page.goto('/');
    await page.fill('#login-email', 'demo@clinica.mx');
    await page.fill('#login-password', 'demo1234');
    await page.click('#login-submit');
    await expect(page.locator('.greeting-title')).toBeVisible();

    // Cerrar sesión desde el sidebar
    await page.click('.sidebar .logout');

    // Debe retornar inmediatamente a la pantalla de login
    await expect(page.locator('#login-card')).toBeVisible();

    // Intentar ir a pacientes por URL directa debe redirigir a login
    await page.goto('/#/pacientes');
    await expect(page.locator('#login-card')).toBeVisible();
  });
});
