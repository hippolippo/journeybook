import { readFileSync } from 'node:fs';
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

test('double-tap zooms a page 2x and closes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/book/b4');
  const before = (await page.locator('.square-page').first().boundingBox())!.width;
  await page.locator('.page-slot').first().dblclick();
  const zoom = page.locator('.page-zoom');
  await expect(zoom).toBeVisible();
  const box = (await zoom.locator('.square-page').boundingBox())!;
  expect(Math.abs(box.width - before * 2)).toBeLessThan(3);
  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  await expect(zoom.locator('button')).toHaveCount(1);
  await zoom.locator('.page-zoom__close').click();
  await expect(page.locator('.page-zoom')).toHaveCount(0);
});

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSAsAmQMDXePm5QAAAABJRU5ErkJggg==',
  'base64',
);

test('page editor uploads to the album and edits a page', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  const before = await page.locator('.square-page .el').count();
  await page.locator('.page-slot__edit').first().click();
  await expect(page.locator('.peditor')).toBeVisible();
  await page
    .locator('.peditor input[type=file]')
    .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: TINY_PNG });
  await expect(page.locator('.album__item')).toHaveCount(1);
  await expect(page.locator('.peditor .frame__img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.peditor')).toHaveCount(0);
  await expect(page.locator('.square-page .el')).toHaveCount(before + 2);
  await expect(page.locator('.square-page .frame__img')).toHaveCount(1);
});

const SAMPLE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30"><rect width="40" height="30" fill="#f08a6b"/><circle cx="28" cy="9" r="5" fill="#fff3c4"/></svg>',
);

test('image editor: frame, 1:1 crop pan and effects', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await page
    .locator('.peditor input[type=file]')
    .setInputFiles({ name: 'shot.svg', mimeType: 'image/svg+xml', buffer: SAMPLE_SVG });
  await expect(page.locator('.peditor .frame__img')).toHaveCount(1);

  await page.getByRole('button', { name: /Edit image/ }).click();
  await expect(page.locator('.imgedit')).toBeVisible();

  // crop pan (on the default square frame, so the 3:2 image has overflow to reveal)
  const win = (await page.locator('.imgedit .frame__window').boundingBox())!;
  const img1 = (await page.locator('.imgedit .frame__img').boundingBox())!;
  await page.mouse.move(win.x + win.width / 2, win.y + win.height / 2);
  await page.mouse.down();
  await page.mouse.move(win.x + win.width / 2 - 30, win.y + win.height / 2, { steps: 4 });
  await page.mouse.up();
  const img2 = (await page.locator('.imgedit .frame__img').boundingBox())!;
  expect(Math.abs(img2.x - img1.x)).toBeGreaterThan(15);

  await page.locator('.imgedit .frame-chip', { hasText: 'Film' }).click();
  await expect(page.locator('.imgedit .el__inner--frame-film')).toHaveCount(1);

  await page.locator('.imgedit .chip--wide', { hasText: 'B&W' }).click();
  const filter = await page
    .locator('.imgedit .frame__img')
    .evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('saturate(0)');

  await page.locator('.imgedit input[placeholder="Preset name…"]').fill('Mine');
  await page.getByRole('button', { name: 'Save preset' }).click();
  await expect(page.locator('.imgedit .chip--wide', { hasText: 'Mine' })).toHaveCount(1);

  await page.locator('.imgedit').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.imgedit')).toHaveCount(0);
});

test('note editor: write, pen, paper and effects', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('button', { name: /Edit note/ }).click();
  await expect(page.locator('.noteedit')).toBeVisible();

  // the preview uses the real note renderer, defaults centred horizontally
  const centred = await page
    .locator('.noteedit .note__text')
    .evaluate((el) => getComputedStyle(el).textAlign);
  expect(centred).toBe('center');

  await page.locator('.noteedit .text-input').fill('Hello note');
  await page.locator('.noteedit .pen-chip', { hasText: 'Marker' }).click();
  await page.locator('.noteedit .chip--wide', { hasText: 'Lined' }).click();

  const style = await page.locator('.noteedit .note__text').evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      family: s.fontFamily,
      bg: getComputedStyle(el.parentElement as HTMLElement).backgroundImage,
    };
  });
  expect(style.family).toContain('Permanent Marker');
  expect(style.bg).toContain('repeating-linear-gradient');

  await page.locator('.noteedit').getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.peditor .note__text')).toContainText('Hello note');
});

test('note editor: height, scale and font are independent', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await page.getByRole('button', { name: 'Note', exact: true }).click();
  await page.getByRole('button', { name: /Edit note/ }).click();
  await expect(page.locator('.noteedit')).toBeVisible();

  const box = () => page.locator('.noteedit .note-box').boundingBox();
  const font = () =>
    page
      .locator('.noteedit .note__text')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const start = (await box())!;
  const startFont = await font();

  // vertical handle changes height, horizontal movement is ignored
  let h = (await page.locator('.noteedit .note-handle').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 80, h.y + h.height / 2, { steps: 4 });
  await page.mouse.up();
  expect((await box())!.height).toBeCloseTo(start.height, 0);

  h = (await page.locator('.noteedit .note-handle').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 60, { steps: 4 });
  await page.mouse.up();
  expect((await box())!.height).toBeGreaterThan(start.height + 20);

  // wheel changes overall scale, not font
  const stage = (await page.locator('.noteedit .note-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2);
  await page.mouse.wheel(0, -300);
  expect((await box())!.width).toBeGreaterThan(start.width + 20);
  expect(await font()).toBe(startFont);

  // font size is manual only
  await page.locator('.noteedit input[type=number]').first().fill('40');
  await page.locator('.noteedit input[type=number]').first().dispatchEvent('change');
  expect(await font()).toBe(40);
});

test('layers pane: rename an item and use no emoji', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  const emoji = await page
    .locator('.layers')
    .evaluate((el) =>
      new RegExp('[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]', 'u').test(el.innerHTML),
    );
  expect(emoji).toBe(false);
  const label = page.locator('.layer-row__label').first();
  await label.dblclick();
  await page.locator('.layer-row__rename').fill('Hero');
  await page.locator('.layer-row__rename').press('Enter');
  await expect(page.locator('.layer-row__label').first()).toHaveText('Hero');
});

test('layers pane: select, delete with backspace, undo', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await expect(page.locator('.layer-group').first()).toBeVisible();
  const before = await page.locator('.peditor .el').count();
  await page.locator('.layer-row').first().click();
  await page.keyboard.press('Backspace');
  await expect(page.locator('.peditor .el')).toHaveCount(before - 1);
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.peditor .el')).toHaveCount(before);
});

test('locking an item removes its edit handles', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await page.locator('.layer-row', { hasText: 'Sparkle' }).click();
  await expect(page.locator('.peditor .pe-handle--br')).toHaveCount(1);
  await page.getByText('Lock item (finished)').click();
  await expect(page.locator('.peditor .pe-handle--br')).toHaveCount(0);
});

test('page editing is not available on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/book/b4');
  await expect(page.locator('.square-page').first()).toBeVisible();
  await expect(page.locator('.page-slot__edit')).toHaveCount(0);
  // no add buttons on mobile
  await expect(page.locator('.add-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add photo' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add page' })).toHaveCount(0);
});

test('book view: desktop shows add page + manage pages', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await expect(page.getByRole('button', { name: 'Add page' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Manage pages/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add photo' })).toHaveCount(0);

  await page.getByRole('button', { name: /Manage pages/ }).click();
  await page.locator('.pages-menu__row').last().locator('button[title="Remove page"]').click();
  await expect(page.locator('.page-nav__label')).toContainText('of 3');
});

test('publishing a book makes it read-only until unpublished', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/scrapbooks/f4');
  const tile = page.locator('.tile', { hasText: 'Lisbon' }).first();
  await expect(tile.locator('.book__draft')).toHaveCount(1);
  await tile.locator('.tile-menu').click();
  await page.locator('.tile-pop').getByText('Publish', { exact: true }).click();
  await expect(tile.locator('.book__draft')).toHaveCount(0);

  await page.goto('/book/b4');
  await expect(page.getByRole('button', { name: 'Unpublish' })).toBeVisible();
  await expect(page.locator('.tag--draft')).toHaveCount(0);
  await expect(page.locator('.page-slot__edit')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add page' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Manage pages/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.locator('.page-slot__edit').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add page' })).toBeVisible();
  await expect(page.locator('.tag--draft')).toHaveCount(1);
});

test('duplicate a book', async ({ page }) => {
  await page.goto('/scrapbooks/f4');
  const tile = page.locator('.tile', { hasText: 'Lisbon' }).first();
  await tile.locator('.tile-menu').click();
  await page.locator('.tile-pop').getByText('Duplicate').click();
  await expect(page.locator('.tile', { hasText: 'Lisbon (copy)' })).toHaveCount(1);
});

test('export a book to a file and import it back (with images)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();
  await page
    .locator('.peditor input[type=file]')
    .setInputFiles({ name: 'shot.svg', mimeType: 'image/svg+xml', buffer: SAMPLE_SVG });
  await expect(page.locator('.peditor .frame__img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.goto('/scrapbooks/f4');
  const tile = page.locator('.tile', { hasText: 'Lisbon' }).first();
  await tile.locator('.tile-menu').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.tile-pop').getByText('Export to file').click(),
  ]);
  const file = (await download.path())!;
  const data = JSON.parse(readFileSync(file, 'utf8')) as {
    format: string;
    media: { dataUrl: string }[];
  };
  expect(data.format).toBe('journeybook.book');
  expect(data.media.length).toBe(1);
  expect(data.media[0].dataUrl.startsWith('data:image')).toBe(true);

  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.locator('.book-head')).toContainText('Lisbon');
  await expect(page.locator('.square-page .frame__img')).toHaveCount(1);
});

test('room editor opens and closes via the leave dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.editor')).toBeVisible();
  await page.getByTitle('Collapse').click();
  await expect(page.locator('.editor--collapsed')).toBeVisible();
  await page.getByTitle('Expand').click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.editor')).toHaveCount(0);
});

test('asset-defined decor: effects, presets and night glow', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.palette__item', { hasText: 'Paper lantern' })).toBeVisible();

  await page.locator('.palette__item', { hasText: 'Paper lantern' }).first().click();
  await page.locator('.palette__item', { hasText: 'Trailing plant' }).first().click();
  await page.locator('.palette__item', { hasText: 'Chai cup' }).first().click();
  await expect(page.locator('.room-item[data-catalog=trailing-plant] .fx--sway')).toHaveCount(1);
  await expect(page.locator('.room-item[data-catalog=chai-cup] .fx-smoke')).toHaveCount(3);

  await page.locator('.editor select').first().selectOption('night');
  await expect(page.locator('.room-item[data-catalog=paper-lantern] .fx--glow')).toHaveCount(1);

  await page.locator('.palette__item', { hasText: 'Paper lantern' }).first().click();
  await page.locator('.editor .btn', { hasText: 'Rose' }).first().click();
  const glass = await page
    .locator('.room-item[data-catalog=paper-lantern]')
    .last()
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--c-glass').trim());
  expect(glass).toBe('#e88f9f');
});

test('repeating decor tiles across the wall and recolours', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.palette__item', { hasText: 'Fairy lights' }).first().click();
  await expect(page.locator('.room-item--repeat')).toHaveCount(1);
  const rep = await page
    .locator('.room-item[data-catalog=fairy-lights] .room-item__repeat')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundRepeat);
  expect(rep).toBe('repeat-x');
  await page.locator('.editor .btn', { hasText: 'Candy' }).first().click();
  const bg = await page
    .locator('.room-item[data-catalog=fairy-lights] .room-item__repeat')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('e88f9f');
});

test('places a catalog item and locks it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const before = await page.locator('.room-item').count();
  await page.locator('.palette__item', { hasText: 'Plant' }).first().click();
  await expect(page.locator('.room-item')).toHaveCount(before + 1);
  await page.getByLabel('Lock in place').check();
  await expect(page.locator('.room-item--locked')).toHaveCount(1);
});

function localDateTime(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test('home countdown opens the calendar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.locator('.countdown').click();
  await expect(page.locator('.calendar__tag')).toHaveText('Our Calendar');
  const overflow = await page
    .locator('.calendar')
    .evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('calendar: add a visit and count down to it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/calendar');
  await page.locator('.calendar__head').getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('.event-dialog')).toBeVisible();
  await page.locator('.event-dialog input[type=text]').first().fill('Trip to see her');
  await page.locator('.event-dialog input[type=datetime-local]').first().fill(localDateTime(10));
  await page.locator('.event-dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.event-dialog')).toHaveCount(0);
  await expect(page.locator('.calendar__banner')).toContainText("until you're together");
  await expect(page.locator('.event-card', { hasText: 'Trip to see her' }).first()).toBeVisible();
});

test('calendar: a visit in progress reads as together', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/calendar');
  await page.locator('.calendar__head').getByRole('button', { name: 'Add' }).click();
  await page.locator('.event-dialog input[type=text]').first().fill('Together weekend');
  await page.locator('.event-dialog input[type=datetime-local]').first().fill(localDateTime(-1));
  await page.locator('.event-dialog input[type=datetime-local]').nth(1).fill(localDateTime(1));
  await page.locator('.event-dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.calendar__banner')).toContainText("You're together right now");
});
