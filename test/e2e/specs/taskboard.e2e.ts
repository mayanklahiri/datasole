import { test, expect } from '@playwright/test';

import { saveScreenshot } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

test.describe('Task Board', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('RPC addTask and moveTask work end-to-end', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => (window as any).__connect());
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    const addResult = await page.evaluate(() =>
      (window as any).__rpc('addTask', { title: 'Test task' }),
    );
    expect(addResult.id).toBeTruthy();
    expect(typeof addResult.id).toBe('string');

    const moveResult = await page.evaluate(
      (id: string) => (window as any).__rpc('moveTask', { taskId: id, column: 'done' }),
      addResult.id,
    );
    expect(moveResult.ok).toBe(true);

    await page.evaluate(() => (window as any).__disconnect());
  });

  test('board state sync via server setState', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => (window as any).__connect());
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    // Use a fresh key (not pre-set by server startup) to test state sync
    await page.evaluate(() => (window as any).__subscribeState('taskboard'));

    await harness.getDatasoleServer().setState('taskboard', {
      columns: ['todo', 'in-progress', 'done'],
      tasks: [{ id: 'task-1', title: 'E2E task', column: 'todo' }],
    });

    await page.waitForFunction(
      () => (window as any).__stateUpdates.some((u: any) => u.key === 'taskboard'),
      null,
      { timeout: 5000 },
    );

    const updates = await page.evaluate(() => (window as any).__stateUpdates);
    const boardUpdate = updates.find((u: any) => u.key === 'taskboard');
    expect(boardUpdate.state.tasks.length).toBe(1);
    expect(boardUpdate.state.tasks[0].title).toBe('E2E task');

    await saveScreenshot(page, 'tutorial-10-taskboard');
    await page.evaluate(() => (window as any).__disconnect());
  });

  test('chat event roundtrip via server broadcast', async ({ page }) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => (window as any).__connect());
    await page.waitForFunction(() => (window as any).__getConnectionState() === 'connected');

    await page.evaluate(() => (window as any).__subscribeEvent('chat:message'));
    await page.waitForTimeout(200);

    // Client sends chat:send, server handler broadcasts chat:message
    await page.evaluate(() => (window as any).__emitEvent('chat:send', { text: 'board msg' }));

    await page.waitForFunction(() => (window as any).__events.length > 0, null, {
      timeout: 5000,
    });

    const events = await page.evaluate(() => (window as any).__events);
    expect(events[0].data.text).toBe('board msg');

    await page.evaluate(() => (window as any).__disconnect());
  });
});
