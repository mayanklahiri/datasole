/**
 * Shared authentication types: credentials, results, and context.
 */
export interface AuthCredentials {
  /** Optional bearer token sent via query/auth handshake. */
  token?: string;
  /** Optional custom headers for non-browser transports. */
  headers?: Record<string, string>;
}

export interface AuthResult {
  /** Whether upgrade/authentication succeeded. */
  authenticated: boolean;
  /** Canonical user id attached to connection context. */
  userId?: string;
  /** Optional role list used for authorization checks. */
  roles?: string[];
  /** Optional metadata exposed via connection context. */
  metadata?: Record<string, unknown>;
}

export interface AuthContext {
  /** Authenticated user id. */
  userId: string;
  /** Authenticated user roles. */
  roles: string[];
  /** Auth metadata associated with current connection/session. */
  metadata: Record<string, unknown>;
}
