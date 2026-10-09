import { expect, test } from '@playwright/test';

test('home loads and opens the scrapbooks organizer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome back, you two')).toBeVisible();
  await page.locator('.hero-book').click();
  await expect(page.locator('.crumb').first()).toHaveText('Scrapbooks');
  await expect(page.locator('.tile').first()).toBeVisible();
});

test('creates a folder', async ({ page }) => {
  await page.goto('/scrapbooks');
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.locator('.create-form input').fill('Test Folder');
  await page.locator('.create-form button[type="submit"]').click();
  await expect(page.locator('.folder__title', { hasText: 'Test Folder' })).toBeVisible();
});

test('opens a book and shows the square-page spread', async ({ page }) => {
  await page.goto('/book/b4');
  await expect(page.locator('.square-page').first()).toBeVisible();
  await expect(page.locator('.page-nav__label')).toContainText('pages 1–2 of 4');
});

test('room editor toggles on and off', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.editor')).toBeVisible();
  await page.getByTitle('Done editing').click();
  await expect(page.locator('.editor')).toHaveCount(0);
});
