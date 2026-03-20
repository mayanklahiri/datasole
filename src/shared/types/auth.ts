/**
 * Shared authentication types: credentials, results, and context.
 */
export interface AuthCredentials {
  token?: string;
  headers?: Record<string, string>;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthContext {
  userId: string;
  roles: string[];
  metadata: Record<string, unknown>;
}
