/**
 * Type-safe contract system for datasole applications.
 *
 * Every datasole app defines an AppContract that specifies all RPC methods,
 * events, and state keys with their exact types. This contract is shared
 * between server and client for compile-time safety.
 */

/**
 * Base constraint for all datasole contracts.
 *
 * Example:
 * ```ts
 * interface AppContract extends DatasoleContract {
 *   rpc: { getUser: { params: { id: string }; result: User } };
 *   events: { 'chat:message': ChatMessage };
 *   state: { dashboard: DashboardState };
 * }
 * ```
 */
export interface DatasoleContract {
  rpc: Record<string, { params: unknown; result: unknown }>;
  events: Record<string, unknown>;
  state: Record<string, unknown>;
}

/**
 * Extract the params type for a given RPC method from a contract.
 *
 * Example: `RpcParams<AppContract, 'getUser'>` -> `{ id: string }`
 */
export type RpcParams<
  T extends DatasoleContract,
  K extends keyof T['rpc'] & string,
> = T['rpc'][K]['params'];

/**
 * Extract the result type for a given RPC method from a contract.
 *
 * Example: `RpcResult<AppContract, 'getUser'>` -> `User`
 */
export type RpcResult<
  T extends DatasoleContract,
  K extends keyof T['rpc'] & string,
> = T['rpc'][K]['result'];

/**
 * Extract the event payload type for a given event from a contract.
 *
 * Example: `EventData<AppContract, 'chat:message'>` -> `ChatMessage`
 */
export type EventData<
  T extends DatasoleContract,
  K extends keyof T['events'] & string,
> = T['events'][K];

/**
 * Extract the state value type for a given state key from a contract.
 *
 * Example: `StateValue<AppContract, 'dashboard'>` -> `DashboardState`
 */
export type StateValue<
  T extends DatasoleContract,
  K extends keyof T['state'] & string,
> = T['state'][K];
