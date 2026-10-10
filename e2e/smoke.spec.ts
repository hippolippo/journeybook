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

test('asset-driven stickers and frames: recolour, presets and particles', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();

  // recolourable sticker defined entirely by asset JSON
  await page.locator('.peditor .chip[title="Sticker: Dreamy moon"]').click();
  await expect(page.locator('.square-page .el__sticker-svg')).toHaveCount(1);
  await page.locator('.peditor .chip--wide', { hasText: 'Midnight' }).click();
  const body = await page
    .locator('.square-page .el', { has: page.locator('.el__sticker-svg') })
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--c-body').trim());
  expect(body).toBe('#cfe0ea');

  // particle system on a sticker (shape referenced by bare file name)
  await page.locator('.peditor .chip[title="Sticker: Heart burst"]').click();
  await expect(page.locator('.square-page .fx-spark').first()).toBeVisible();

  // asset-driven frame with recolour slots
  await page
    .locator('.peditor input[type=file]')
    .setInputFiles({ name: 'shot.svg', mimeType: 'image/svg+xml', buffer: SAMPLE_SVG });
  await expect(page.locator('.peditor .frame__img')).toHaveCount(1);
  await page.getByRole('button', { name: /Edit image/ }).click();
  await page.locator('.imgedit .frame-chip', { hasText: 'Stitched' }).click();
  await expect(page.locator('.imgedit .el__inner--frame-art')).toHaveCount(1);
  await expect(page.locator('.imgedit .frame__overlay')).toHaveCount(1);
});

test('asset-driven layered paper: tile, border, corners and recolour', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/book/b4');
  await page.locator('.page-slot__edit').first().click();

  await page.locator('.peditor .swatch[title="Meadow"]').click();
  await expect(page.locator('.peditor .paper-surface__border')).toHaveCount(1);
  await expect(page.locator('.peditor .paper-surface__corner')).toHaveCount(4);
  await expect(page.locator('.peditor .square-page')).toHaveCSS('background-image', /data:image\/svg\+xml/);

  await page.locator('.peditor .chip--wide', { hasText: 'Rose' }).click();
  const edge = await page
    .locator('.peditor .square-page')
    .evaluate((el) => getComputedStyle(el).getPropertyValue('--c-edge').trim());
  expect(edge).toBe('#e6dcf0');
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

test('room editor: Done skips the save dialog when nothing changed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.editor')).toBeVisible();
  await page.getByTitle('Collapse').click();
  await expect(page.locator('.editor--collapsed')).toBeVisible();
  await page.getByTitle('Expand').click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  // No changes -> closes immediately, no dialog.
  await expect(page.locator('.editor')).toHaveCount(0);
  await expect(page.locator('.dialog')).toHaveCount(0);
});

test('room editor: Done prompts to save when there are changes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.editor .swatch').first().click(); // change the wall
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.editor')).toHaveCount(0);
});

test('room editor: clear room removes every item (undoable)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.room-item').first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear room' }).click();
  await expect(page.locator('.room-item')).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.room-item').first()).toBeVisible();
});

test('room editor: only left and right docks are offered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.editor__dock')).toHaveCount(2);
  await expect(page.locator('.editor__dock[title="Dock left"]')).toHaveCount(1);
  await expect(page.locator('.editor__dock[title="Dock right"]')).toHaveCount(1);
  const text = await page.locator('.editor__docks').innerText();
  expect(text.replace(/\s/g, '')).toBe('LR');
});

test('room editor: collapse arrow points away from the docked edge', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  // Docked right (default): expanded points right, collapsed points left.
  await expect(page.getByTitle('Collapse')).toHaveText('›');
  await page.getByTitle('Collapse').click();
  await expect(page.getByTitle('Expand')).toHaveText('‹');
  // Docked left: mirrored.
  await page.getByTitle('Expand').click();
  await page.getByTitle('Dock left').click();
  await expect(page.getByTitle('Collapse')).toHaveText('‹');
  await page.getByTitle('Collapse').click();
  await expect(page.getByTitle('Expand')).toHaveText('›');
});

test('asset-defined decor: effects, presets and night glow', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await expect(page.locator('.palette__item', { hasText: 'Paper lantern' })).toBeVisible();

  // Adding selects the item (which hides the catalog), so deselect to keep browsing.
  await page.locator('.palette__item', { hasText: 'Paper lantern' }).first().click();
  await page.mouse.click(30, 30);
  await page.locator('.palette__item', { hasText: 'Trailing plant' }).first().click();
  await page.mouse.click(30, 30);
  await page.locator('.palette__item', { hasText: 'Chai cup' }).first().click();
  await expect(page.locator('.room-item[data-catalog=trailing-plant] .fx--sway')).toHaveCount(1);
  await expect(page.locator('.room-item[data-catalog=chai-cup] .fx-smoke')).toHaveCount(3);

  await page.mouse.click(30, 30);
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

test('surface items attach to furniture and follow it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();

  const desk = page.locator('.room-item[data-catalog=desk]').first();
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const beforeDesk = (await desk.boundingBox())!;
  const beforeLaptop = (await laptop.boundingBox())!;

  // Drag the desk to the right; the attached laptop should move with it.
  const cx = beforeDesk.x + beforeDesk.width / 2;
  const cy = beforeDesk.y + beforeDesk.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 8 });
  await page.mouse.up();

  const afterDesk = (await desk.boundingBox())!;
  const afterLaptop = (await laptop.boundingBox())!;
  // No start/end jump: both move by the drag distance, not more.
  expect(Math.abs(afterDesk.x - beforeDesk.x - 120)).toBeLessThan(20);
  expect(Math.abs(afterLaptop.x - beforeLaptop.x - 120)).toBeLessThan(25);
});

test('dragging an attached item follows the pointer without jumping', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const before = (await laptop.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = (await laptop.boundingBox())!;
  expect(Math.abs(after.x - before.x - 40)).toBeLessThan(12);
});

test('dragging an attached item off its host detaches it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  // Attached children are nested inside their host so host transforms cascade.
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(true);
  const before = (await laptop.boundingBox())!;
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 500, cy, { steps: 10 });
  await page.mouse.up();
  // Detached: no longer nested inside the desk.
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(false);
});

test('a trinket dropped on a wall shelf attaches to it', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const shelf = page.locator('.room-item[data-catalog=wall-shelf]').first();
  const shelfBox = (await shelf.boundingBox())!;
  const mugPalette = page.locator('.palette__item[title="Coffee cup"]').first();
  await mugPalette.scrollIntoViewIfNeeded();
  const pbox = (await mugPalette.boundingBox())!;
  await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(shelfBox.x + shelfBox.width / 2, shelfBox.y + 8, { steps: 10 });
  await page.mouse.up();

  const mugOnShelf = page.locator('.room-item[data-catalog=wall-shelf] .room-item[data-catalog=coffee-cup]');
  await expect(mugOnShelf).toHaveCount(1);
  const mbox = (await mugOnShelf.boundingBox())!;
  const center = mbox.x + mbox.width / 2;
  expect(center).toBeGreaterThan(shelfBox.x - 5);
  expect(center).toBeLessThan(shelfBox.x + shelfBox.width + 5);
});

test('surface items can be dragged from the floor up onto the wall', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.palette__item[title="Coffee cup"]').first().click();
  const mug = page.locator('.room-item[data-catalog=coffee-cup]').last();
  const before = (await mug.boundingBox())!;
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, 150, { steps: 10 });
  await page.mouse.up();
  const after = (await mug.boundingBox())!;
  // Now sitting on the wall (above the wall/floor line).
  expect(after.y + after.height / 2).toBeLessThan(900 * 0.74);
  const left = await mug.evaluate((el) => (el as HTMLElement).style.left);
  expect(left).not.toContain('calc');
});

test('item depth is one absolute scale from the wall to the floor', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const zOf = (sel: string) => page.locator(sel).first().evaluate((el) => Number(getComputedStyle(el).zIndex));
  const wall = await zOf('.room-item[data-catalog=wall-shelf]');
  const desk = await zOf('.room-item[data-catalog=desk]');
  const mug = await zOf('.room-item[data-catalog=coffee-cup]');
  expect(wall).toBeLessThan(desk);
  expect(desk).toBeLessThan(mug);

  // A surface item can be pushed all the way behind the wall items.
  await page.locator('.room-item[data-catalog=coffee-cup]').first().click();
  const depth = page.locator('.editor .field', { hasText: 'Depth' }).locator('input[type=number]');
  await depth.fill('4');
  await depth.press('Enter');
  // Select something else so the mug isn't lifted by the editor.
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  expect(await zOf('.room-item[data-catalog=coffee-cup]')).toBe(4);
});

test('a buried item can be picked from the item list without leaving its depth', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.room-item[data-catalog=coffee-cup]').first().click();
  const depth = page.locator('.editor .field', { hasText: 'Depth' }).locator('input[type=number]');
  await depth.fill('4');
  await depth.press('Enter');

  await page.locator('.item-list__row', { hasText: 'Coffee cup' }).first().click();
  const sel = page.locator('.room-item[data-catalog=coffee-cup].room-item--selected');
  await expect(sel).toHaveCount(1);
  // Selecting does not lift the item off its own depth.
  const z = await sel.evaluate((el) => Number(getComputedStyle(el).zIndex));
  expect(z).toBe(4);
});

test('dragging shows a translucent preview while the item keeps its own depth', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.room-item[data-catalog=coffee-cup]').first().click();
  const depth = page.locator('.editor .field', { hasText: 'Depth' }).locator('input[type=number]');
  await depth.fill('4');
  await depth.press('Enter');

  const mug = page.locator('.room-item[data-catalog=coffee-cup]').first();
  const box = (await mug.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 30, cy, { steps: 4 });
  await expect(page.locator('.room-item--ghost')).toHaveCount(1);
  expect(await mug.evaluate((el) => Number(getComputedStyle(el).zIndex))).toBe(4);
  await page.mouse.up();
  await expect(page.locator('.room-item--ghost')).toHaveCount(0);
});

test('clicking repeatedly cycles selection through overlapping items', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const win = (await page.locator('.room-item[data-catalog=window]').first().boundingBox())!;
  const curtain = (await page.locator('.room-item[data-catalog=curtain]').nth(1).boundingBox())!;
  const x0 = Math.max(win.x, curtain.x);
  const x1 = Math.min(win.x + win.width, curtain.x + curtain.width);
  const y0 = Math.max(win.y, curtain.y);
  const y1 = Math.min(win.y + win.height, curtain.y + curtain.height);
  expect(x1).toBeGreaterThan(x0);
  expect(y1).toBeGreaterThan(y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  await page.mouse.click(cx, cy);
  const first = await page.locator('.room-item--selected').getAttribute('data-item-id');
  await page.mouse.click(cx, cy);
  const second = await page.locator('.room-item--selected').getAttribute('data-item-id');
  expect(second).not.toBe(first);
});

test('attached items keep the same size on a wall shelf and a floor desk', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  const plants = page.locator('.room-item[data-catalog=plant]');
  await expect(plants).toHaveCount(2);
  const shelfPlant = (await plants.nth(0).boundingBox())!;
  const deskPlant = (await plants.nth(1).boundingBox())!;
  expect(Math.abs(shelfPlant.height - deskPlant.height)).toBeLessThan(3);
});

test('attached items sit within their host footprint', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  const desk = (await page.locator('.room-item[data-catalog=desk]').first().boundingBox())!;
  const plant = (await page.locator('.room-item[data-catalog=plant]').nth(1).boundingBox())!;
  const center = plant.x + plant.width / 2;
  expect(center).toBeGreaterThan(desk.x);
  expect(center).toBeLessThan(desk.x + desk.width);
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

test('room editor: selected item shows scale and rotate handles, click away deselects', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  await expect(page.locator('.room-item--selected .pe-handle--br')).toHaveCount(1);
  await expect(page.locator('.room-item--selected .pe-rot')).toHaveCount(1);
  // Click empty wall space to deselect.
  await page.mouse.click(600, 400);
  await expect(page.locator('.room-item--selected')).toHaveCount(0);
});

test('room editor: on-canvas scale handle resizes while keeping the aspect ratio', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  // Use a mid-screen item so its bottom-right handle is on screen.
  await page.locator('.item-list__row', { hasText: 'Wall clock' }).first().click();
  const xField = page.locator('.editor .field', { hasText: 'X' }).locator('input[type=number]');
  await xField.fill('0.5');
  await xField.press('Enter');
  const item = page.locator('.room-item[data-catalog=wall-clock]').first();
  const before = (await item.boundingBox())!;
  const handle = (await page.locator('.room-item--selected .pe-handle--br').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 45, handle.y + 45, { steps: 6 });
  await page.mouse.up();
  const after = (await item.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 10);
  expect(Math.abs(after.width / after.height - before.width / before.height)).toBeLessThan(0.05);
});

test('room editor: attached items rotate and scale with their host', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const start = (await laptop.boundingBox())!;

  const rotField = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rotField.fill('30');
  await rotField.press('Enter');
  const rotated = (await laptop.boundingBox())!;
  // Rotating the host moves the attached child around the host.
  expect(Math.abs(rotated.x - start.x) + Math.abs(rotated.y - start.y)).toBeGreaterThan(5);

  const sizeField = page.locator('.editor .field', { hasText: 'Size' }).locator('input[type=number]');
  await sizeField.fill('1.5');
  await sizeField.press('Enter');
  const scaled = (await laptop.boundingBox())!;
  expect(scaled.height).toBeGreaterThan(rotated.height + 2);
});

test('room editor: depth list shows thumbnails and can be reordered', async ({ page }) => {  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const topRows = page.locator('ul.item-list:not(.item-list--children) > li > .item-list__row');
  await expect(topRows.first().locator('.room-thumb')).toHaveCount(1);
  const before = await topRows.locator('.item-list__label').allTextContents();
  // Drag the wall shelf (row 3) up in front of the desk (row 1).
  const shelf = page.locator('.item-list__row', { hasText: 'Wall shelf' }).first();
  await shelf.scrollIntoViewIfNeeded();
  const sbox = (await shelf.boundingBox())!;
  const target = (await topRows.first().boundingBox())!;
  await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sbox.x + sbox.width / 2, target.y + 2, { steps: 8 });
  await page.mouse.up();
  const after = await topRows.locator('.item-list__label').allTextContents();
  expect(after[0]).toBe('Wall shelf');
  expect(after).not.toEqual(before);
});

test('room editor: delete, undo and keyboard nudge', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const before = await page.locator('.room-item').count();
  await page.locator('.item-list__row', { hasText: 'Rug' }).first().click();
  await page.keyboard.press('Delete');
  await expect(page.locator('.room-item')).toHaveCount(before - 1);
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.room-item')).toHaveCount(before);

  const rug = page.locator('.room-item[data-catalog=rug]').first();
  await page.locator('.item-list__row', { hasText: 'Rug' }).first().click();
  const start = (await rug.boundingBox())!;
  await page.keyboard.press('ArrowRight');
  const nudged = (await rug.boundingBox())!;
  expect(nudged.x).toBeGreaterThan(start.x);
});

test('room editor: environment hides on selection, the item list always shows', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const env = page.locator('.editor section', { hasText: 'Time of day' });
  const list = page.getByText('Items (front to back)');
  // The item list is always the first section in the panel.
  await expect(page.locator('.editor__body > section').first()).toContainText('Items (front to back)');
  await expect(env).toBeVisible();
  await expect(list).toBeVisible();

  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  await expect(env).toHaveCount(0);
  await expect(page.getByText('Wall', { exact: true })).toHaveCount(0);
  await expect(list).toBeVisible();
  await expect(page.locator('.editor__body > section').first()).toContainText('Items (front to back)');
  await expect(page.getByText('Selected: Desk')).toBeVisible();

  await page.mouse.click(600, 400);
  await expect(env).toBeVisible();
});

test('room editor: dragging an attached item tracks the screen and its preview lines up', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  // Rotate the desk, then pick its laptop up.
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('20');
  await rot.press('Enter');
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const start = (await laptop.boundingBox())!;
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;
  const a = (20 * Math.PI) / 180;
  const ax = Math.cos(a);
  const ay = Math.sin(a);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Move along the desk's axis: it stays attached, and the preview lines up.
  await page.mouse.move(cx + 40 * ax, cy + 40 * ay, { steps: 8 });
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(true);
  let real = (await laptop.boundingBox())!;
  let ghost = (await page.locator('.room-item--ghost').boundingBox())!;
  expect(Math.abs(real.x - ghost.x)).toBeLessThan(3);
  expect(Math.abs(real.y - ghost.y)).toBeLessThan(3);
  // Pull it off the desk: it turns free mid-drag and the preview still lines up.
  await page.mouse.move(cx + 40 * ax, cy + 40 * ay - 220, { steps: 10 });
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(false);
  real = (await laptop.boundingBox())!;
  ghost = (await page.locator('.room-item--ghost').boundingBox())!;
  expect(Math.abs(real.x - ghost.x)).toBeLessThan(3);
  expect(Math.abs(real.y - ghost.y)).toBeLessThan(3);
  await page.mouse.up();
  // It moved with the pointer in screen space.
  const end = (await laptop.boundingBox())!;
  expect(Math.abs(end.x + end.width / 2 - cx - 40 * ax)).toBeLessThan(20);
  expect(Math.abs(end.y + end.height / 2 - cy - (40 * ay - 220))).toBeLessThan(20);
});

test('room editor: dropping an item onto rotated furniture does not jump', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('30');
  await rot.press('Enter');
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const start = (await laptop.boundingBox())!;
  const sx = start.x + start.width / 2;
  const sy = start.y + start.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Off the desk, then back onto its centre.
  await page.mouse.move(sx, sy - 200, { steps: 8 });
  await page.mouse.move(259, 783, { steps: 8 });
  const before = (await laptop.boundingBox())!;
  await page.mouse.up();
  const after = (await laptop.boundingBox())!;
  // It rotates to match the furniture, but its centre must not jump.
  expect(Math.abs(after.x + after.width / 2 - (before.x + before.width / 2))).toBeLessThan(2);
  expect(Math.abs(after.y + after.height / 2 - (before.y + before.height / 2))).toBeLessThan(2);
});

test('room editor: moving an attached item along its host does not jump', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('30');
  await rot.press('Enter');
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const start = (await laptop.boundingBox())!;
  const sx = start.x + start.width / 2;
  const sy = start.y + start.height / 2;
  const a = (30 * Math.PI) / 180;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Slide along the desk's axis so it stays attached, then release on the desk.
  await page.mouse.move(sx + 70 * Math.cos(a), sy + 70 * Math.sin(a), { steps: 8 });
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(true);
  const before = (await laptop.boundingBox())!;
  await page.mouse.up();
  const after = (await laptop.boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - (before.x + before.width / 2))).toBeLessThan(2);
  expect(Math.abs(after.y + after.height / 2 - (before.y + before.height / 2))).toBeLessThan(2);
});

test('room editor: re-placing an attached item does not compound its rotation', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('30');
  await rot.press('Enter');
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  const a = (30 * Math.PI) / 180;
  await page.locator('.item-list__row', { hasText: 'Laptop' }).first().click();
  const rotInput = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  const initial = await rotInput.inputValue();

  for (let i = 0; i < 3; i++) {
    const b = (await laptop.boundingBox())!;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 20 * Math.cos(a), cy + 20 * Math.sin(a), { steps: 5 });
    await page.mouse.up();
  }
  await page.locator('.item-list__row', { hasText: 'Laptop' }).first().click();
  expect(await rotInput.inputValue()).toBe(initial);
});

test('room editor: removing an item from rotated furniture restores its rotation', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('40');
  await rot.press('Enter');
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  await page.locator('.item-list__row', { hasText: 'Laptop' }).first().click();
  const rotInput = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  const stored = await rotInput.inputValue();
  const start = (await laptop.boundingBox())!;
  const sx = start.x + start.width / 2;
  const sy = start.y + start.height / 2;
  // Drag it off the desk and drop it, then it should keep its own rotation.
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 240, { steps: 10 });
  await page.mouse.up();
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(false);
  await page.locator('.item-list__row', { hasText: 'Laptop' }).first().click();
  expect(await rotInput.inputValue()).toBe(stored);
});

test('room editor: shows a live attach preview and a badge while over a host', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Desk' }).first().click();
  const rot = page.locator('.editor .field', { hasText: 'Rot°' }).locator('input[type=number]');
  await rot.fill('30');
  await rot.press('Enter');
  await page.mouse.click(30, 30); // deselect so the palette shows

  // Place a loose mug away from the desk.
  const palette = page.locator('.palette__item[title="Coffee cup"]').first();
  await palette.scrollIntoViewIfNeeded();
  const pbox = (await palette.boundingBox())!;
  await page.mouse.move(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await page.mouse.down();
  await page.mouse.move(900, 300, { steps: 10 });
  await page.mouse.up();

  const mug = page.locator('.room-item[data-catalog=coffee-cup]').last();
  const b = (await mug.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(259, 783, { steps: 10 }); // over the desk centre
  await expect(page.locator('.room-item__attach-badge')).toHaveCount(1);
  // Previewed in its attached orientation: host 30° + mug's own -4°.
  expect(await mug.evaluate((el) => (el as HTMLElement).style.transform)).toContain('rotate(26deg)');
  await page.mouse.up();
  expect(await mug.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(true);
});

test('room editor: rotating a loose item pivots around its centre', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  await page.locator('.item-list__row', { hasText: 'Wall clock' }).first().click();
  const xField = page.locator('.editor .field', { hasText: 'X' }).locator('input[type=number]');
  await xField.fill('0.5');
  await xField.press('Enter');
  const clock = page.locator('.room-item[data-catalog=wall-clock]').first();
  const start = (await clock.boundingBox())!;
  const c0 = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const rot = (await page.locator('.room-item--selected .pe-rot').boundingBox())!;
  await page.mouse.move(rot.x + rot.width / 2, rot.y + rot.height / 2);
  await page.mouse.down();
  await page.mouse.move(rot.x + rot.width / 2 + 70, rot.y + rot.height / 2 + 30, { steps: 8 });
  await page.mouse.up();
  const after = (await clock.boundingBox())!;
  const c1 = { x: after.x + after.width / 2, y: after.y + after.height / 2 };
  expect(Math.abs(c1.x - c0.x)).toBeLessThan(4);
  expect(Math.abs(c1.y - c0.y)).toBeLessThan(4);
});

test('room editor: shows a minus badge while removing an item from furniture', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const laptop = page.locator('.room-item[data-catalog=laptop]').first();
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(true);
  const b = (await laptop.boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy - 220, { steps: 10 }); // pull it off the desk
  await expect(page.locator('.room-item__remove-badge')).toHaveCount(1);
  await expect(page.locator('.room-item__attach-badge')).toHaveCount(0);
  await page.mouse.up();
  expect(await laptop.evaluate((el) => !!el.closest('[data-catalog=desk]'))).toBe(false);
});

test('room editor: attached items are draggable within their host in the list', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const deskLi = page
    .locator('.item-list > li')
    .filter({ has: page.locator('.item-list__row', { hasText: 'Desk' }) });
  const kids = deskLi.locator('.item-list--children > li > .item-list__row');
  const before = await kids.locator('.item-list__label').allTextContents();
  expect(before.length).toBeGreaterThan(1);
  const src = kids.nth(0);
  const dst = kids.nth(1);
  await src.scrollIntoViewIfNeeded();
  const sb = (await src.boundingBox())!;
  const db = (await dst.boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  // Drop below the second child (its lower half) to place after it.
  await page.mouse.move(db.x + db.width / 2, db.y + db.height - 2, { steps: 8 });
  await page.mouse.up();
  const after = await kids.locator('.item-list__label').allTextContents();
  expect(after[0]).toBe(before[1]);
  expect(after[1]).toBe(before[0]);
});

test('room editor: the item list has no horizontal scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const overflow = await page
    .locator('ul.item-list')
    .first()
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('room editor: dragging a layer shows a floating preview and disables text selection', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  const rows = page.locator('ul.item-list:not(.item-list--children) > li > .item-list__row');
  const shelf = page.locator('.item-list__row', { hasText: 'Wall shelf' }).first();
  await shelf.scrollIntoViewIfNeeded();
  const sb = (await shelf.boundingBox())!;
  const target = (await rows.first().boundingBox())!;
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width / 2, target.y + 2, { steps: 5 });
  await expect(page.locator('.layer-drag-ghost')).toBeVisible();
  await expect(page.locator('.layer-drag-ghost')).toContainText('Wall shelf');
  await page.mouse.up();
  await expect(page.locator('.layer-drag-ghost')).toHaveCount(0);
  expect(await shelf.evaluate((el) => getComputedStyle(el).userSelect)).toBe('none');
});

test('room editor: the sidebar hides its scrollbars', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByTitle('Edit room').click();
  expect(await page.locator('.editor__body').evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');
  expect(await page.locator('.item-list').first().evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');
});



