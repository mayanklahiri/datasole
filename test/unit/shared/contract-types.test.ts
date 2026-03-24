import { describe, expectTypeOf, it } from 'vitest';

import { DatasoleClient } from '../../../src/client/client';
import { DatasoleServer } from '../../../src/server/server';
import type { EventData, RpcParams, RpcResult, StateValue } from '../../../src/shared/contract';
import type { TestContract, TestEvent, TestRpc, TestState } from '../../helpers/test-contract';

describe('contract type inference', () => {
  it('infers RPC params and result types from contract', () => {
    type AddParams = RpcParams<TestContract, TestRpc.Add>;
    type AddResult = RpcResult<TestContract, TestRpc.Add>;

    expectTypeOf<AddParams>().toEqualTypeOf<{ a: number; b: number }>();
    expectTypeOf<AddResult>().toEqualTypeOf<{ sum: number }>();
  });

  it('infers event and state value types from contract', () => {
    type ChatEvent = EventData<TestContract, TestEvent.ChatMessage>;
    type BoardState = StateValue<TestContract, TestState.Board>;

    expectTypeOf<ChatEvent>().toEqualTypeOf<{ text: string; seq: number }>();
    expectTypeOf<BoardState['columns']>().toEqualTypeOf<string[]>();
    expectTypeOf<BoardState['tasks'][number]['title']>().toEqualTypeOf<string>();
  });

  it('propagates contract types through DatasoleClient and DatasoleServer generics', () => {
    void new DatasoleClient<TestContract>({ url: 'ws://localhost:3000' });
    void new DatasoleServer<TestContract>();

    expectTypeOf<Parameters<DatasoleClient<TestContract>['rpc']>[0]>().toEqualTypeOf<
      keyof TestContract['rpc'] & string
    >();
    expectTypeOf<Parameters<DatasoleServer<TestContract>['broadcast']>[0]>().toEqualTypeOf<
      keyof TestContract['events'] & string
    >();
  });
});
