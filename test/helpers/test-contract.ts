/**
 * Shared test contract for unit and e2e tests.
 */
import type { DatasoleContract } from '../../src/shared/contract';

export enum TestRpc {
  Echo = 'echo',
  Add = 'add',
  Error = 'error',
  Slow = 'slow',
  Boom = 'boom',
  Whoami = 'whoami',
  Ping = 'ping',
  SaveProgress = 'saveProgress',
  GetProgress = 'getProgress',
  AddTask = 'addTask',
  MoveTask = 'moveTask',
  TriggerAlert = 'triggerAlert',
  PushMetric = 'pushMetric',
  StartBroadcastFlood = 'startBroadcastFlood',
  StartStateMutationFlood = 'startStateMutationFlood',
  StartBinaryFrameFlood = 'startBinaryFrameFlood',
  EchoLargeJson = 'echoLargeJson',
  StartHeavyPayloadFlood = 'startHeavyPayloadFlood',
}

export enum TestEvent {
  ClientPing = 'client-ping',
  ServerPong = 'server-pong',
  ChatSend = 'chat:send',
  ChatMessage = 'chat:message',
  Chat = 'chat',
  Ev = 'ev',
  TestEvent = 'test-event',
  Notify = 'notify',
  ServerNotify = 'server-notify',
  CrdtOp = 'crdt:op',
  CrdtGet = 'crdt:get',
  CrdtState = 'crdt:state',
  BenchEvent = 'bench:event',
  BenchGameTick = 'bench:game-tick',
  BenchGameState = 'bench:game-state',
  BenchBinaryFrame = 'bench:binary-frame',
  BenchHeavyPayload = 'bench:heavy-payload',
}

export enum TestState {
  Board = 'board',
  Dashboard = 'dashboard',
  Key1 = 'key1',
  Obj = 'obj',
  Synced = 'synced',
  Shared = 'shared',
  BenchState = 'benchState',
}

export interface TaskItem {
  id: string;
  title: string;
  column: string;
}

export interface Board {
  columns: string[];
  tasks: TaskItem[];
}

export interface TestContract extends DatasoleContract {
  rpc: {
    [TestRpc.Echo]: { params: unknown; result: unknown };
    [TestRpc.Add]: { params: { a: number; b: number }; result: { sum: number } };
    [TestRpc.Error]: { params: unknown; result: never };
    [TestRpc.Slow]: { params: unknown; result: unknown };
    [TestRpc.Boom]: { params: unknown; result: never };
    [TestRpc.Whoami]: { params: unknown; result: string };
    [TestRpc.Ping]: { params: unknown; result: string };
    [TestRpc.SaveProgress]: { params: { level: number; score: number }; result: { ok: boolean } };
    [TestRpc.GetProgress]: { params: unknown; result: { level: number; score: number } };
    [TestRpc.AddTask]: { params: { title: string }; result: { id: string } };
    [TestRpc.MoveTask]: { params: { taskId: string; column: string }; result: { ok: boolean } };
    [TestRpc.TriggerAlert]: { params: { message: string }; result: { ok: boolean } };
    [TestRpc.PushMetric]: { params: { cpu: number }; result: { ok: boolean } };
    [TestRpc.StartBroadcastFlood]: {
      params: { durationMs: number; intervalMs?: number };
      result: { ok: boolean };
    };
    [TestRpc.StartStateMutationFlood]: {
      params: { durationMs: number; intervalMs?: number };
      result: { ok: boolean };
    };
    [TestRpc.StartBinaryFrameFlood]: {
      params: { durationMs: number; frameSizeBytes: number };
      result: { ok: boolean };
    };
    [TestRpc.EchoLargeJson]: { params: { payload: unknown }; result: { payload: unknown } };
    [TestRpc.StartHeavyPayloadFlood]: {
      params: { durationMs: number; payloadSizeKb?: number };
      result: { ok: boolean };
    };
  };
  events: {
    [TestEvent.ClientPing]: unknown;
    [TestEvent.ServerPong]: { echo: unknown };
    [TestEvent.ChatSend]: { text: string };
    [TestEvent.ChatMessage]: { text: string; seq: number };
    [TestEvent.Chat]: unknown;
    [TestEvent.Ev]: unknown;
    [TestEvent.TestEvent]: unknown;
    [TestEvent.Notify]: unknown;
    [TestEvent.ServerNotify]: unknown;
    [TestEvent.CrdtOp]: unknown;
    [TestEvent.CrdtGet]: unknown;
    [TestEvent.CrdtState]: unknown;
    [TestEvent.BenchEvent]: { seq: number; ts: number };
    [TestEvent.BenchGameTick]: { seq: number };
    [TestEvent.BenchGameState]: { seq: number; ack: boolean; ts: number };
    [TestEvent.BenchBinaryFrame]: { seq: number; frame: number[]; size: number };
    [TestEvent.BenchHeavyPayload]: { seq: number; ts: number; data: string; nested: unknown };
  };
  state: {
    [TestState.Board]: Board;
    [TestState.Dashboard]: unknown;
    [TestState.Key1]: unknown;
    [TestState.Obj]: unknown;
    [TestState.Synced]: unknown;
    [TestState.Shared]: unknown;
    [TestState.BenchState]: { counter: number; ts: number; payload: string };
  };
}
