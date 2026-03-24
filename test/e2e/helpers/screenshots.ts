/**
 * E2E screenshot capture with pixelmatch baseline comparison; writes to `.screenshots/` and copies
 * desktop viewport shots into the docs tree for tutorials.
 *
 * Baselines are write-once: they are only written when no baseline exists or when viewport
 * dimensions change. Sub-threshold rendering drift is tolerated without rewriting, so that
 * screenshots remain stable across runs on the same machine.
 */
import type { Page, TestInfo } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../.screenshots');
const MAX_DIFF_RATIO = 0.01;

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function viewportTag(testInfo: TestInfo): string {
  return testInfo.project.name || 'default';
}

/**
 * Capture a keyed screenshot with animations frozen. If a baseline exists,
 * compare pixels and fail if the diff exceeds MAX_DIFF_RATIO. If no baseline
 * exists, write it and pass. Sub-threshold drift is tolerated without
 * rewriting the baseline or docs copy.
 */
export async function snap(page: Page, testInfo: TestInfo, key: string): Promise<void> {
  const tag = viewportTag(testInfo);
  const filename = `${key}--${tag}.png`;
  ensureDir(SCREENSHOT_DIR);
  const baselinePath = path.join(SCREENSHOT_DIR, filename);

  const buffer = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });

  if (!existsSync(baselinePath)) {
    writeFileSync(baselinePath, buffer);
    if (tag === 'desktop') {
      copyToDocsScreenshots(key, buffer);
    }
    return;
  }

  const baseline = PNG.sync.read(readFileSync(baselinePath));
  const current = PNG.sync.read(buffer);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    writeFileSync(baselinePath, buffer);
    if (tag === 'desktop') {
      copyToDocsScreenshots(key, buffer);
    }
    return;
  }

  const { width, height } = baseline;
  const diff = new PNG({ width, height });
  const mismatchCount = pixelmatch(baseline.data, current.data, diff.data, width, height, {
    threshold: 0.1,
  });

  const totalPixels = width * height;
  const diffRatio = mismatchCount / totalPixels;

  if (diffRatio > MAX_DIFF_RATIO) {
    const diffPath = path.join(SCREENSHOT_DIR, `${key}--${tag}--diff.png`);
    writeFileSync(diffPath, PNG.sync.write(diff));
    writeFileSync(baselinePath.replace('.png', '--actual.png'), buffer);
    throw new Error(
      `Screenshot "${key}" (${tag}) differs by ${(diffRatio * 100).toFixed(2)}% ` +
        `(${mismatchCount}/${totalPixels} pixels). Diff saved to ${diffPath}`,
    );
  }

  // Sub-threshold or zero diff: baseline and docs copy remain untouched.
  // To regenerate baselines, delete .screenshots/ and re-run.
}

function copyToDocsScreenshots(key: string, buffer: Buffer): void {
  const docsDir = path.resolve(__dirname, '../../../docs/public/screenshots');
  ensureDir(docsDir);
  writeFileSync(path.join(docsDir, `${key}.png`), buffer);
}

/**
 * Legacy wrapper kept for backward compat. Delegates to snap().
 */
export async function saveScreenshot(
  page: Page,
  name: string,
  testInfo?: TestInfo,
): Promise<string> {
  if (testInfo) {
    await snap(page, testInfo, name);
  }
  const docsDir = path.resolve(__dirname, '../../../docs/public/screenshots');
  ensureDir(docsDir);
  const filePath = path.join(docsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true, animations: 'disabled', caret: 'hide' });
  return filePath;
}
