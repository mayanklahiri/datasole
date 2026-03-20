/**
 * Captures browser console messages and page errors during Playwright tests.
 */
import type { Page, ConsoleMessage } from '@playwright/test';

export interface CapturedLog {
  type: string;
  text: string;
  timestamp: number;
}

export function captureConsoleLogs(page: Page): CapturedLog[] {
  const logs: CapturedLog[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now(),
    });
  });

  page.on('pageerror', (error) => {
    logs.push({
      type: 'error',
      text: error.message,
      timestamp: Date.now(),
    });
  });

  return logs;
}

export function hasErrors(logs: CapturedLog[]): boolean {
  return logs.some((l) => l.type === 'error');
}
