import type { Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/public/screenshots');

export async function saveScreenshot(page: Page, name: string): Promise<string> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}
