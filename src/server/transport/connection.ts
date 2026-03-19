import type { AuthContext } from '../../shared/types';

import type { ConnectionContext } from './connection-context';
import { DefaultConnectionContext } from './connection-context';

export interface ConnectionInfo {
  id: string;
  remoteAddress: string;
  connectedAt: number;
  auth: AuthContext | null;
}

export class Connection {
  readonly info: ConnectionInfo;
  readonly context: ConnectionContext;

  constructor(info: ConnectionInfo) {
    this.info = info;
    this.context = new DefaultConnectionContext({
      connectionId: info.id,
      auth: info.auth,
      remoteAddress: info.remoteAddress,
    });
  }

  async send(_data: Uint8Array): Promise<void> {
    // TODO: send binary frame over ws connection
    throw new Error('Not implemented');
  }

  close(_code?: number, _reason?: string): void {
    // TODO: close ws connection
  }
}
