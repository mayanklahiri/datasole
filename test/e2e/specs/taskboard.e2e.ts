import { test, expect } from '@playwright/test';

import { TestRpc, TestState, TestEvent } from '../../helpers/test-contract';
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
      ({ m, id }) => window.__rpc(m, { taskId: id, column: 'done' }),
      { m: TestRpc.MoveTask, id: addResult.id },
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

    await page.evaluate((k) => window.__subscribeState(k), TestState.E2ETaskboard);

    await harness.getDatasoleServer().primitives.live.setState(TestState.E2ETaskboard, {
      columns: ['todo', 'in-progress', 'done'],
      tasks: [{ id: 'task-1', title: 'E2E task', column: 'todo' }],
    });

    await page.waitForFunction(
      (key) =>
        window.__stateUpdates.some(
          (u: { key: string; state: Record<string, unknown> }) => u.key === key,
        ),
      TestState.E2ETaskboard,
      { timeout: 5000 },
    );

    const updates = await page.evaluate(() => window.__stateUpdates);
    const boardUpdate = [...updates]
      .reverse()
      .find(
        (u: { key: string; state?: { tasks?: Array<{ title: string }> } }) =>
          u.key === TestState.E2ETaskboard && u.state?.tasks?.some((t) => t.title === 'E2E task'),
      );
    expect(boardUpdate).toBeDefined();
    const tasks = boardUpdate!.state!['tasks'] as Array<{ title: string }>;
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

    await page.evaluate((ev) => window.__subscribeEvent(ev), TestEvent.ChatMessage);
    await page.waitForTimeout(200);

    await page.evaluate(([ev, data]) => window.__emitEvent(ev, data), [
      TestEvent.ChatSend,
      { text: 'board msg' },
    ] as [typeof TestEvent.ChatSend, { text: string }]);

    await page.waitForFunction(() => window.__events.length > 0, null, {
      timeout: 5000,
    });

    const events = await page.evaluate(() => window.__events);
    expect((events[0]!.data as { text: string }).text).toBe('board msg');

    await snap(page, testInfo, 'taskboard-chat-event');

    await page.evaluate(() => window.__disconnect());
  });
});
