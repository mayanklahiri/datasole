/**
 * Manages authentication credentials and HTTP upgrade headers for WebSocket connections.
 */

import type { AuthCredentials } from '../../shared/types';

export class AuthProvider {
  private credentials: AuthCredentials = {};

  /** Set bearer token used during upgrade/auth handshake. */
  setToken(token: string): void {
    this.credentials.token = token;
  }

  /** Merge custom headers used by non-browser transports. */
  setHeaders(headers: Record<string, string>): void {
    this.credentials.headers = { ...this.credentials.headers, ...headers };
  }

  /** Return a defensive copy of configured credentials. */
  getCredentials(): AuthCredentials {
    return { ...this.credentials };
  }

  /** Build HTTP headers for upgrade requests in non-browser environments. */
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
