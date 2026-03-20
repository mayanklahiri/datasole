/**
 * Auth handler configuration types for server-side credential verification and anonymous access.
 */
export type { AuthResult, AuthContext, AuthCredentials } from '../../shared/types';

export interface AuthHandlerConfig {
  required?: boolean;
  allowAnonymous?: boolean;
}
