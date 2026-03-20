/**
 * Client-facing type re-exports from shared and client modules.
 */

export type {
  RpcCallOptions,
  RpcResult,
  EventHandler,
  EventPayload,
  AuthCredentials,
  StatePatch,
  StateSnapshot,
  StateSubscription,
} from '../shared/types';

export type { TransportOptions } from './transport';
export type { DatasoleClient, DatasoleClientOptions, ConnectionState } from './client';
