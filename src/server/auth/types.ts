export type { AuthResult, AuthContext, AuthCredentials } from '../../shared/types';

export interface AuthHandlerConfig {
  required?: boolean;
  allowAnonymous?: boolean;
}
