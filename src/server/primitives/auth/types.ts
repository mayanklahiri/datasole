/**
 * Auth handler configuration types for server-side credential verification.
 */
export type { AuthResult, AuthContext, AuthCredentials } from '../../../shared/types';

export interface AuthHandlerConfig {
  required?: boolean;
  allowAnonymous?: boolean;
}
