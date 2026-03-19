import type { AuthCredentials } from '../../shared/types';

export class AuthProvider {
  private credentials: AuthCredentials = {};

  setToken(token: string): void {
    this.credentials.token = token;
  }

  setHeaders(headers: Record<string, string>): void {
    this.credentials.headers = { ...this.credentials.headers, ...headers };
  }

  getCredentials(): AuthCredentials {
    return { ...this.credentials };
  }

  buildUpgradeHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.credentials.token) {
      headers['Authorization'] = `Bearer ${this.credentials.token}`;
    }
    if (this.credentials.headers) {
      Object.assign(headers, this.credentials.headers);
    }
    return headers;
  }
}
