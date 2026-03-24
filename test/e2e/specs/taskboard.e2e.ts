import { test, expect } from '@playwright/test';

import { snap } from '../helpers/screenshots';
import { ServerHarness } from '../helpers/server-harness';

test.describe('Task Board', () => {
  const harness = new ServerHarness();

  test.beforeAll(async () => {
    await harness.start();
  });

  test.afterAll(async () => {
    await harness.stop();
  });

  test('RPC addTask and moveTask work end-to-end', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    const addResult = (await page.evaluate(() =>
      window.__rpc('addTask', { title: 'Test task' }),
    )) as { id: string };
    expect(addResult.id).toBeTruthy();
    expect(typeof addResult.id).toBe('string');

    await snap(page, testInfo, 'taskboard-task-added');

    const moveResult = (await page.evaluate(
      (id: string) => window.__rpc('moveTask', { taskId: id, column: 'done' }),
      addResult.id,
    )) as { ok: boolean };
    expect(moveResult.ok).toBe(true);

    await snap(page, testInfo, 'taskboard-task-moved');

    await page.evaluate(() => window.__disconnect());
  });

  test('board state sync via server setState', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    await page.evaluate(() => window.__subscribeState('taskboard'));

    await harness.getDatasoleServer().setState('taskboard', {
      columns: ['todo', 'in-progress', 'done'],
      tasks: [{ id: 'task-1', title: 'E2E task', column: 'todo' }],
    });

    await page.waitForFunction(
      () =>
        window.__stateUpdates.some(
          (u: { key: string; state: Record<string, unknown> }) => u.key === 'taskboard',
        ),
      null,
      { timeout: 5000 },
    );

    const updates = await page.evaluate(() => window.__stateUpdates);
    const boardUpdate = updates.find(
      (u: { key: string; state: Record<string, unknown> }) => u.key === 'taskboard',
    );
    expect(boardUpdate).toBeDefined();
    const tasks = boardUpdate!.state['tasks'] as Array<{ title: string }>;
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.title).toBe('E2E task');

    await snap(page, testInfo, 'taskboard-state-synced');

    await page.evaluate(() => window.__disconnect());
  });

  test('chat event roundtrip via server broadcast', async ({ page }, testInfo) => {
    await page.goto(harness.getUrl());
    await page.waitForSelector('#status', { state: 'attached' });

    await page.evaluate(() => window.__connect());
    await page.waitForFunction(() => window.__getConnectionState() === 'connected');

    await page.evaluate(() => window.__subscribeEvent('chat:message'));
    await page.waitForTimeout(200);

    await page.evaluate(() => window.__emitEvent('chat:send', { text: 'board msg' }));

    await page.waitForFunction(() => window.__events.length > 0, null, {
      timeout: 5000,
    });

    const events = await page.evaluate(() => window.__events);
    expect((events[0]!.data as { text: string }).text).toBe('board msg');

    await snap(page, testInfo, 'taskboard-chat-event');

    await page.evaluate(() => window.__disconnect());
  });
});
