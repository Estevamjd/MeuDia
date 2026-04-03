import { test, expect } from '@playwright/test';

test.describe('PWA', () => {
  test('deve servir o manifest.json', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('MeuDia');
    expect(manifest.short_name).toBe('MeuDia');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/inicio');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('deve servir o service worker', async ({ page }) => {
    const response = await page.goto('/sw.js');
    expect(response?.status()).toBe(200);
    const contentType = response?.headers()['content-type'];
    expect(contentType).toContain('javascript');
  });

  test('deve ter meta tags PWA no HTML', async ({ page }) => {
    await page.goto('/login');

    // Manifest link
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');

    // Theme color
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute('content');

    // Apple web app capable
    const appleCapable = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleCapable).toHaveAttribute('content', 'yes');
  });

  test('ícones devem estar acessíveis', async ({ page }) => {
    const icon192 = await page.goto('/icons/icon-192.svg');
    expect(icon192?.status()).toBe(200);

    const icon512 = await page.goto('/icons/icon-512.svg');
    expect(icon512?.status()).toBe(200);
  });
});
