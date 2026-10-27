import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const library = JSON.parse(
  readFileSync(fileURLToPath(new URL('./library.json', import.meta.url)), 'utf8'),
) as unknown;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    if (!localStorage.getItem('journeybook:v1')) {
      localStorage.setItem('journeybook:v1', JSON.stringify(data));
    }
  }, library);
});

test('notes: compose, save a draft, send and read it back', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  await page.locator('.hero-book--notes').click();
  await expect(page).toHaveURL(/\/notes$/);
  await expect(page.getByRole('heading', { name: 'Letters', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9]+\/edit$/);
  await expect(page.locator('.note-page')).toBeVisible();
  await expect(
    page.locator('.note-panel').getByRole('heading', { name: 'Page', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.note-page__grip')).toBeVisible();
  const composerBody = await page.locator('.note-compose__body').boundingBox();
  const settingsPanel = await page.locator('.note-panel').boundingBox();
  expect(composerBody).toBeTruthy();
  expect(settingsPanel).toBeTruthy();
  expect(settingsPanel!.height).toBeLessThan(composerBody!.height - 20);

  const editor = page.locator('.note-editor');
  await editor.click();
  await page.keyboard.type('Dear you,');
  await page.keyboard.press('Enter');
  await page.keyboard.type('I found the little bookshop with the green door today.');
  await expect(page.locator('.note-page__spill')).toHaveCount(1);

  // Paper, writing controls and page height are all available on the desktop panel.
  await expect(page.locator('.note-paper-swatch')).toHaveCount(7);
  await expect(page.locator('.note-paper-swatch').first()).toContainText('Sticky note');
  const gridPaper = page.locator('.note-paper-swatch').nth(2);
  await expect(gridPaper).toContainText('Grid');
  await gridPaper.click();
  await expect(gridPaper).toHaveClass(/is-on/);
  await expect(page.locator('.note-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page).toHaveURL(/\/notes\?tab=drafts$/);
  await expect(page.locator('.note-card')).toHaveCount(1);
  await expect(page.locator('.note-card')).toContainText('Dear you,');
  await expect(page.locator('.note-card')).not.toContainText('Draft');
  await expect(page.locator('.note-card .note-chip')).toHaveCount(0);
  await expect(page.locator('.note-card__who')).toHaveCount(0);
  await expect(page.locator('.note-card__preview')).toHaveCount(0);
  await expect(page.locator('.note-card__meta')).toContainText('Edited');

  await page.locator('.note-card').click();
  await expect(page.locator('.note-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Seal & send', exact: true }).first().click();
  await expect(page.locator('.note-dialog')).toBeVisible();
  await page.locator('.note-dialog').getByRole('button', { name: 'Seal & send' }).click();

  await expect(page).toHaveURL(/\/notes\?tab=outbox$/);
  await expect(page.locator('.notes-tab.is-on')).toContainText('Outbox');
  await expect(page.locator('.note-card')).toContainText('Sealed');
  await expect(page.locator('.note-card')).toContainText('Dear you,');
  await expect(page.locator('.note-card .note-env__seal-letter')).toHaveText('G');

  await page.locator('.note-card').click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9]+$/);
  await expect(page.locator('.note-read__line')).toContainText('Still sealed');
  await expect(page.locator('.note-read__bar')).toContainText('Sealed');
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--full/);
  await expect(page.locator('.note-page')).toBeVisible();

  const readWidth = await page.locator('.note-page-frame').boundingBox();
  await page.locator('.note-page').dblclick();
  await expect(page.locator('.note-zoom')).toBeVisible();
  const zoomWidth = await page.locator('.note-zoom .note-page-frame').boundingBox();
  expect(readWidth).toBeTruthy();
  expect(zoomWidth).toBeTruthy();
  expect(zoomWidth!.width).toBeGreaterThan(readWidth!.width);
  await page.locator('.note-zoom .page-zoom__close').click();
  await expect(page.locator('.note-zoom')).toHaveCount(0);

  await page.getByRole('button', { name: 'Pull back' }).click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9]+\/edit$/);
  await expect(page.locator('.note-chip')).toContainText('Draft');
});

test('mobile composer keeps every control on one row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  await assertSingleBarRow(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  const styleBox = await page.locator('.note-compose__style').boundingBox();
  const letterTabs = await page.locator('.note-segmented').boundingBox();
  expect(styleBox).toBeTruthy();
  expect(letterTabs).toBeTruthy();
  expect(styleBox!.x).toBeLessThan(letterTabs!.x);
  await page.getByRole('tab', { name: 'Envelope', exact: true }).click();
  const envelopeTabs = await page.locator('.note-segmented').boundingBox();
  expect(envelopeTabs).toBeTruthy();
  expect(Math.abs(envelopeTabs!.x - letterTabs!.x)).toBeLessThan(1);
  await page.getByRole('tab', { name: 'Letter', exact: true }).click();

  await page.locator('.note-editor').click();
  await page.keyboard.type('For you');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.locator('.note-dialog').getByRole('button', { name: 'Seal & send' }).click();
  await page.waitForURL(/\/notes\?tab=outbox$/);
  await page.locator('.note-card').first().click();
  await page.waitForURL(/\/notes\/[a-z0-9]+$/);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.waitForURL(/\/edit$/);

  await expect(page.locator('.note-compose__who .note-chip')).toHaveText('Sent · unopened');
  await assertSingleBarRow(page);
  await expect(page.locator('.note-primary-short')).toHaveText('Save');
});

async function assertSingleBarRow(page: Page): Promise<void> {
  await expect(page.locator('.note-compose__bar')).toBeVisible();
  await expect(page.locator('.note-backlink__label')).toBeHidden();
  await expect(page.locator('.note-style__label')).toBeHidden();
  await expect(page.locator('.note-primary-long')).toBeHidden();
  await expect(page.locator('.note-primary-short')).toBeVisible();
  await expect(page.locator('.note-compose__who .note-chip')).toBeVisible();
  await expect(page.locator('.note-compose__style')).toBeVisible();
  await expect(page.locator('.note-segmented')).toBeVisible();

  const metrics = await page.locator('.note-compose__bar').evaluate((bar) => {
    const r = bar.getBoundingClientRect();
    const tops = [...bar.children].map((child) => child.getBoundingClientRect().top);
    return {
      height: r.height,
      scrollWidth: bar.scrollWidth,
      clientWidth: bar.clientWidth,
      topSpread: Math.max(...tops) - Math.min(...tops),
    };
  });
  expect(metrics.height).toBeLessThan(60);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.topSpread).toBeLessThan(8);

  const recipient = await page.locator('.note-compose__to').evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(recipient.scrollWidth).toBeLessThanOrEqual(recipient.clientWidth + 1);

  const stagePadding = await page
    .locator('.note-compose__stage')
    .evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingBottom));
  expect(stagePadding).toBeGreaterThanOrEqual(100);
}

test('clicking the blank page places the caret at the nearest text', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  const editor = page.locator('.note-editor');
  await editor.click();
  await page.keyboard.type('First line');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Last line');

  const content = page.locator('.note-page__content:not(.note-page__spill)');
  const box = await content.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height - 50);
  await expect(editor).toBeFocused();
  await page.keyboard.type(' END');
  await expect(editor).toContainText('Last line END');

  const topBox = await content.boundingBox();
  expect(topBox).toBeTruthy();
  await page.mouse.click(topBox!.x + topBox!.width / 2, topBox!.y + 8);
  await page.keyboard.type('START ');
  await expect(editor).toContainText('START First line');
});

test('paper previews are zoomed out and kraft is textured', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  const linedPreview = page
    .locator('.note-paper-swatch')
    .filter({ hasText: 'Lined' })
    .locator('.note-paper-swatch__sheet');
  expect(
    await linedPreview.evaluate((element) => getComputedStyle(element).backgroundSize),
  ).toContain('8px');

  const kraft = page.locator('.note-paper-swatch').filter({ hasText: 'Kraft' });
  await kraft.click();
  const kraftPreview = kraft.locator('.note-paper-swatch__sheet');
  expect(
    await kraftPreview.evaluate((element) => getComputedStyle(element).backgroundImage),
  ).toContain('url(');
  expect(
    await kraftPreview.evaluate((element) => getComputedStyle(element).backgroundSize),
  ).toContain('47.5px');
  expect(
    await page
      .locator('.note-page')
      .evaluate((element) => getComputedStyle(element).backgroundImage),
  ).toContain('url(');
  expect(
    await page
      .locator('.note-page')
      .evaluate((element) => getComputedStyle(element).backgroundSize),
  ).toBe('190px 190px');
});

test('text remains selectable with the style sheet open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.locator('.note-editor').click();
  await page.keyboard.type('Hello');
  await page.getByRole('button', { name: 'Style' }).click();
  await page.getByRole('tab', { name: 'Pen', exact: true }).click();
  await expect(page.locator('.note-editor')).toHaveAttribute('inputmode', 'none');

  await page.locator('.note-editor').dblclick();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  const weight = await page.locator('.note-editor').evaluate((root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes('Hello')) {
        return walker.currentNode.parentElement
          ? getComputedStyle(walker.currentNode.parentElement).fontWeight
          : null;
      }
    }
    return null;
  });
  expect(weight).toBe('700');
});

test('keyboard inset scrolls the paper but not the app shell', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 500,
        width: 390,
        offsetTop: 0,
        offsetLeft: 0,
        scale: 1,
        pageTop: 0,
        pageLeft: 0,
        addEventListener() {},
        removeEventListener() {},
      },
    });
    window.dispatchEvent(new Event('resize'));
  });

  await expect
    .poll(() =>
      page
        .locator('.note-compose')
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--note-keyboard').trim(),
        ),
    )
    .not.toBe('0px');

  const shell = await page.locator('.app-shell').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, height: rect.height };
  });
  expect(Math.abs(shell.top)).toBeLessThan(2);
  expect(shell.height).toBeGreaterThan(830);
  expect(shell.height).toBeLessThan(850);

  await page.locator('.note-editor').click();
  for (let index = 0; index < 18; index += 1) {
    await page.keyboard.type(`Line ${index + 1}`);
    await page.keyboard.press('Enter');
  }
  await expect
    .poll(() =>
      page
        .locator('.note-compose__stage')
        .evaluate((element) => (element as HTMLElement).scrollTop),
    )
    .toBeGreaterThan(0);
});

test('color picker lifts selected text and bars on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.locator('.note-editor').click();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.type(`Line ${index + 1}`);
    await page.keyboard.press('Enter');
  }

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.note-editor');
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes('Line 10')) {
        node = walker.currentNode as Text;
        break;
      }
    }
    if (!node) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });

  await page.getByRole('button', { name: 'Style' }).click();
  await page.getByRole('tab', { name: 'Pen', exact: true }).click();
  const inkPicker = page.locator('input[aria-label="Custom ink colour"]');
  await inkPicker.dispatchEvent('pointerdown');
  await page.waitForTimeout(250);

  await expect(page.locator('.roombar')).toBeHidden();
  await expect(page.locator('.note-compose__bar')).toBeHidden();
  const target = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.note-compose__stage');
    return { scrollTop: stage?.scrollTop ?? 0 };
  });
  expect(target.scrollTop).toBeGreaterThan(0);

  await inkPicker.dispatchEvent('input');
  await inkPicker.dispatchEvent('change');
  await expect(page.locator('.roombar')).toBeHidden();
  await inkPicker.dispatchEvent('blur');
  await expect(page.locator('.roombar')).toBeVisible();
  await expect(page.locator('.note-compose__bar')).toBeVisible();
});

test('mobile envelope controls stay open and compact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.getByRole('tab', { name: 'Envelope', exact: true }).click();

  await expect(page.locator('.note-compose')).toHaveClass(/note-compose--panel-open/);
  await expect(page.locator('.note-compose__style')).toHaveCount(0);
  await expect(page.locator('.note-panel__sheet')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Done' })).toHaveCount(0);
  await expect(page.locator('.note-env-stage__caption')).toHaveCount(0);
  await expect(page.getByText('the first thing they see')).toHaveCount(0);
  await expect(page.locator('.note-hint')).toHaveCount(0);

  const stampHead = page.locator('.note-panel__head--stamp');
  await expect(stampHead).toContainText('Stamp');
  await expect(stampHead).toContainText('Stamp');
  await expect(stampHead).toContainText('Postmark');
  expect(
    await stampHead.evaluate((element) => Math.round(element.getBoundingClientRect().height)),
  ).toBeLessThan(40);

  const envelope = await page.locator('.note-env-stage__frame').boundingBox();
  const panel = await page.locator('.note-panel').boundingBox();
  expect(envelope).toBeTruthy();
  expect(panel).toBeTruthy();
  expect(envelope!.y + envelope!.height).toBeLessThan(panel!.y + 2);

  const envelopeDetails = await page.locator('.note-env').evaluate((element) => {
    const seal = element.querySelector<HTMLElement>('.note-env__seal');
    const after = getComputedStyle(element, '::after');
    const bounds = element.getBoundingClientRect();
    return {
      border: after.borderTopWidth,
      sealRatio: seal ? seal.getBoundingClientRect().width / bounds.width : 0,
    };
  });
  expect(envelopeDetails.border).not.toBe('0px');
  expect(envelopeDetails.sealRatio).toBeGreaterThan(0.17);
});

test('envelope colour picker stays lifted until dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.getByRole('tab', { name: 'Envelope', exact: true }).click();

  const tintPicker = page.locator('input[aria-label="Custom envelope tint"]');
  await tintPicker.dispatchEvent('pointerdown');
  await expect(page.locator('.roombar')).toBeHidden();
  const lifted = await page.locator('.note-env-stage__frame').boundingBox();
  expect(lifted).toBeTruthy();
  expect(lifted!.y).toBeLessThan(60);

  await tintPicker.dispatchEvent('input');
  await tintPicker.dispatchEvent('change');
  await expect(page.locator('.roombar')).toBeHidden();
  expect((await page.locator('.note-env-stage__frame').boundingBox())!.y).toBeLessThan(60);

  await tintPicker.dispatchEvent('blur');
  await expect(page.locator('.roombar')).toBeVisible();
});

test('mobile style sheet has remembered Paper and Pen tabs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.locator('.note-editor').click();
  await page.getByRole('button', { name: 'Style' }).click();
  await expect(page.locator('.note-editor')).toHaveAttribute('inputmode', 'none');
  await expect(page.locator('.note-editor')).toHaveAttribute('virtualkeyboardpolicy', 'manual');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  await expect(page.locator('.note-panel')).not.toContainText('Paper & pen');
  const tabs = page.locator('.note-panel__tab');
  await expect(tabs).toHaveCount(2);
  const paperTab = tabs.filter({ hasText: 'Paper' });
  const penTab = tabs.filter({ hasText: 'Pen' });
  const doneButton = page.locator('.note-panel__done');
  const [tabRow, doneRow] = await Promise.all([paperTab.boundingBox(), doneButton.boundingBox()]);
  expect(tabRow).toBeTruthy();
  expect(doneRow).toBeTruthy();
  expect(
    Math.abs(tabRow!.y + tabRow!.height / 2 - (doneRow!.y + doneRow!.height / 2)),
  ).toBeLessThan(4);
  await expect(paperTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.note-panel h2:visible')).toHaveText(['Paper']);
  const paperPanel = await page.locator('.note-panel').boundingBox();
  expect(paperPanel).toBeTruthy();
  expect(paperPanel!.height).toBeLessThan(844 * 0.52 - 10);

  await page.locator('.note-compose__stage').evaluate((element) => {
    (element as HTMLElement).scrollTop = (element as HTMLElement).scrollHeight;
  });
  const [pageFrame, openPanel] = await Promise.all([
    page.locator('.note-page-frame').boundingBox(),
    page.locator('.note-panel').boundingBox(),
  ]);
  expect(pageFrame).toBeTruthy();
  expect(openPanel).toBeTruthy();
  expect(pageFrame!.y + pageFrame!.height).toBeLessThan(openPanel!.y + 2);

  await penTab.click();
  await expect(penTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.note-panel h2:visible')).toHaveText(['Writing']);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const penPanel = await page.locator('.note-panel').boundingBox();
  expect(penPanel).toBeTruthy();
  expect(penPanel!.height).toBeLessThan(844 * 0.52 - 10);
  expect(Math.abs(penPanel!.height - paperPanel!.height)).toBeLessThan(1.5);

  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.note-editor')).toHaveAttribute('inputmode', 'text');
  await page.getByRole('button', { name: 'Style' }).click();
  await expect(penTab).toHaveAttribute('aria-selected', 'true');
});

test('styles apply at a collapsed cursor', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await page.locator('.note-editor').click();
  await page.keyboard.type('Plain ');

  await page.getByLabel('Font', { exact: true }).selectOption({ label: 'Serif' });
  await page.getByLabel('Font size', { exact: true }).selectOption('32');
  await page.getByRole('button', { name: 'Ink #8a3b3b' }).click();
  await page.getByRole('button', { name: 'Highlight #f5e6a8' }).click();
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page.keyboard.type('Styled');

  const styled = await styledText(page);
  expect(styled).not.toBeNull();
  expect(styled!.font).toContain('Fraunces');
  expect(styled!.size).toBe('32px');
  expect(styled!.color).toBe('rgb(138, 59, 59)');
  expect(styled!.weight).toBe('700');
  await expect(page.getByLabel('Font', { exact: true })).toHaveValue("'Fraunces', Georgia, serif");
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('32');
  await expect(page.locator('input[aria-label="Custom ink colour"]')).toHaveValue('#8a3b3b');
  await expect(page.locator('input[aria-label="Custom highlight colour"]')).toHaveValue('#f5e6a8');
  await expect(page.getByRole('button', { name: 'Ink #8a3b3b' })).toHaveClass(/is-on/);
  await expect(page.getByRole('button', { name: 'Highlight #f5e6a8' })).toHaveClass(/is-on/);
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toHaveClass(/is-on/);

  for (let index = 0; index < 30; index += 1) await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Font', { exact: true })).toHaveValue("'Caveat', cursive");
  await expect(page.getByLabel('Font size', { exact: true })).toHaveValue('22');
  await expect(page.locator('input[aria-label="Custom ink colour"]')).toHaveValue('#4a3b2e');
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).not.toHaveClass(/is-on/);
  await expect(page.getByRole('button', { name: 'No highlight' })).toHaveClass(/is-on/);
  const highlightSwatch = page
    .locator('label.note-swatch--custom')
    .filter({ has: page.locator('input[aria-label="Custom highlight colour"]') });
  expect(
    await highlightSwatch.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--sw').trim(),
    ),
  ).toBe('transparent');

  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page).toHaveURL(/\/notes\?tab=drafts$/);
  await page.locator('.note-card').first().click();
  await expect(page.locator('.note-editor')).toBeVisible();

  const reopened = await styledText(page);
  expect(reopened).toEqual(styled);
  expect(await page.locator('.note-editor').innerHTML()).not.toContain('\u200b');
});

test('resizing the page auto-scrolls at the bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  const stage = await page.locator('.note-compose__stage').boundingBox();
  const grip = await page.locator('.note-page__grip').boundingBox();
  const before = await page.locator('.note-page-frame').boundingBox();
  expect(stage).toBeTruthy();
  expect(grip).toBeTruthy();
  expect(before).toBeTruthy();

  const x = grip!.x + grip!.width / 2;
  await page.mouse.move(x, grip!.y + grip!.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, stage!.y + stage!.height - 24, { steps: 8 });

  await expect
    .poll(
      () =>
        page
          .locator('.note-compose__stage')
          .evaluate((element) => (element as HTMLElement).scrollTop),
      { timeout: 2000 },
    )
    .toBeGreaterThan(0);

  const after = await page.locator('.note-page-frame').boundingBox();
  expect(after).toBeTruthy();
  expect(after!.height).toBeGreaterThan(before!.height + 40);
  await page.mouse.up();
});

test('shrinking at the bottom freezes the scroll until the pointer reaches the top', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  const stage = page.locator('.note-compose__stage');
  const grip = page.locator('.note-page__grip');
  await expect(grip).toHaveCSS('touch-action', 'none');
  const stageBox = await stage.boundingBox();
  let gripBox = await grip.boundingBox();
  expect(stageBox).toBeTruthy();
  expect(gripBox).toBeTruthy();

  // Grow a tall page and leave the stage scrolled to its bottom.
  const x = gripBox!.x + gripBox!.width / 2;
  await page.mouse.move(x, gripBox!.y + gripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, stageBox!.y + stageBox!.height - 10, { steps: 8 });
  await expect
    .poll(() => stage.evaluate((element) => (element as HTMLElement).scrollTop), {
      timeout: 2500,
    })
    .toBeGreaterThan(0);
  await page.mouse.up();
  const tall = await page.locator('.note-page-frame').boundingBox();
  expect(tall).toBeTruthy();
  gripBox = await grip.boundingBox();
  expect(gripBox).toBeTruthy();

  // A short upward drag changes the height but leaves scrollTop frozen.
  const scrollBefore = await stage.evaluate((element) => (element as HTMLElement).scrollTop);
  await page.mouse.move(x, gripBox!.y + gripBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, stageBox!.y + 220, { steps: 4 });
  await page.waitForTimeout(250);
  expect(await stage.evaluate((element) => (element as HTMLElement).scrollTop)).toBeCloseTo(
    scrollBefore,
    0,
  );
  const short = await page.locator('.note-page-frame').boundingBox();
  expect(short).toBeTruthy();
  expect(short!.height).toBeLessThan(tall!.height - 20);

  // Near the top edge the stage follows the drag upward.
  await page.mouse.move(x, stageBox!.y + 24, { steps: 3 });
  await expect
    .poll(() => stage.evaluate((element) => (element as HTMLElement).scrollTop), {
      timeout: 2000,
    })
    .toBeLessThan(scrollBefore);
  await page.mouse.up();
});

test('note paper can use the full shell height for red overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveClass(/app-shell--full/);

  await page.locator('.note-editor').evaluate((el) => {
    el.innerHTML = Array.from(
      { length: 40 },
      (_, index) =>
        `<p>Line ${index + 1} with some words to fill the page and overflow below it.</p>`,
    ).join('');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.note-compose__stage');
    const spill = document.querySelector<HTMLElement>('.note-page__spill');
    if (!stage || !spill) return null;
    return {
      stageBottom: stage.getBoundingClientRect().bottom,
      spillBottom: spill.getBoundingClientRect().bottom,
      scrollHeight: stage.scrollHeight,
      clientHeight: stage.clientHeight,
      spillColor: getComputedStyle(spill).color,
    };
  });

  expect(metrics).not.toBeNull();
  expect(metrics!.stageBottom).toBeGreaterThan(850);
  expect(metrics!.spillBottom).toBeGreaterThan(metrics!.stageBottom);
  expect(metrics!.scrollHeight).toBeGreaterThan(metrics!.clientHeight);
  expect(metrics!.spillColor).toBe('rgb(180, 69, 60)');
});

test('page width stays fixed when the page height changes', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1200 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  const before = await page.locator('.note-page-frame').boundingBox();
  const grip = await page.locator('.note-page__grip').boundingBox();
  expect(before).toBeTruthy();
  expect(grip).toBeTruthy();

  const x = grip!.x + grip!.width / 2;
  const y = grip!.y + grip!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 180, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  const after = await page.locator('.note-page-frame').boundingBox();
  expect(after).toBeTruthy();
  expect(after!.width).toBeCloseTo(before!.width, 1);
  expect(after!.height).toBeGreaterThan(before!.height + 100);
});

test('custom colours apply to paper, ink and the envelope', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/notes');
  await page.getByRole('button', { name: 'New letter' }).first().click();
  await expect(page.locator('.note-page')).toBeVisible();

  await setColorInput(page, 'Custom paper tint', '#123456');
  await expect(page.locator('.note-page')).toHaveCSS('background-color', 'rgb(18, 52, 86)');

  await page.locator('.note-editor').click();
  await setColorInput(page, 'Custom ink colour', '#00aa55');
  await page.keyboard.type('Custom');
  const ink = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.note-editor');
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes('Custom')) {
        return walker.currentNode.parentElement
          ? getComputedStyle(walker.currentNode.parentElement).color
          : null;
      }
    }
    return null;
  });
  expect(ink).toBe('rgb(0, 170, 85)');

  await page.getByRole('tab', { name: 'Envelope', exact: true }).click();
  await setColorInput(page, 'Custom envelope tint', '#224466');
  await setColorInput(page, 'Custom wax seal colour', '#778899');
  await setColorInput(page, 'Custom stamp colour', '#aa3344');
  await setColorInput(page, 'Custom postmark colour', '#11bbcc');

  const envelopeStyles = await page.evaluate(() => {
    const envelope = document.querySelector<HTMLElement>('.note-env');
    const stamp = document.querySelector<HTMLElement>('.note-env__stamp');
    const seal = document.querySelector<HTMLElement>('.note-env__seal');
    return {
      envelope: envelope?.getAttribute('style') ?? '',
      stamp: stamp?.getAttribute('style') ?? '',
      seal: seal?.getAttribute('style') ?? '',
    };
  });
  expect(envelopeStyles.envelope).toContain('--env: #224466');
  expect(envelopeStyles.seal).toContain('--c-seal: #778899');
  expect(envelopeStyles.stamp).toContain('--c-paper: #aa3344');
  expect(envelopeStyles.stamp).toContain('--c-waves: #11bbcc');
});

async function setColorInput(page: Page, label: string, color: string): Promise<void> {
  await page.locator(`input[aria-label="${label}"]`).evaluate((el, value) => {
    (el as HTMLInputElement).value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, color);
}

async function styledText(page: Page): Promise<{
  font: string;
  size: string;
  color: string;
  weight: string;
} | null> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('.note-editor');
    if (!root) return null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes('Styled')) {
        node = walker.currentNode as Text;
        break;
      }
    }
    if (!node?.parentElement) return null;
    const style = getComputedStyle(node.parentElement);
    return {
      font: style.fontFamily,
      size: style.fontSize,
      color: style.color,
      weight: style.fontWeight,
    };
  });
}

test('mobile home stacks compact covers with readable labels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.home')).toBeVisible();
  const cards = page.locator('.hero-book');
  await expect(cards).toHaveCount(2);
  expect(
    await page
      .locator('.shelf')
      .evaluate((element) => getComputedStyle(element, '::after').content),
  ).toBe('none');
  const boxes = await cards.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    }),
  );
  expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom - 1);
  expect(boxes[0].width).toBeLessThanOrEqual(300);
  expect(boxes[0].height).toBeLessThanOrEqual(130);

  const label = await page.locator('.hero-book--notes .hero-book__label').boundingBox();
  const paper = await page.locator('.hero-book--notes .hero-book__paper').boundingBox();
  expect(label).toBeTruthy();
  expect(paper).toBeTruthy();
  expect(paper!.x).toBeGreaterThan(label!.x + label!.width - 1);
});
