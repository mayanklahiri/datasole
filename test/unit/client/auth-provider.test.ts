import { describe, it, expect } from 'vitest';

import { AuthProvider } from '../../../src/client/auth/auth-provider';

describe('AuthProvider', () => {
  it('starts with empty credentials', () => {
    const provider = new AuthProvider();
    const creds = provider.getCredentials();
    expect(creds).toEqual({});
  });

  describe('setToken()', () => {
    it('sets the token', () => {
      const provider = new AuthProvider();
      provider.setToken('my-token');
      expect(provider.getCredentials().token).toBe('my-token');
    });

    it('overwrites previous token', () => {
      const provider = new AuthProvider();
      provider.setToken('first');
      provider.setToken('second');
      expect(provider.getCredentials().token).toBe('second');
    });
  });

  describe('setHeaders()', () => {
    it('sets custom headers', () => {
      const provider = new AuthProvider();
      provider.setHeaders({ 'X-Api-Key': 'abc123' });
      expect(provider.getCredentials().headers).toEqual({ 'X-Api-Key': 'abc123' });
    });

    it('merges with existing headers', () => {
      const provider = new AuthProvider();
      provider.setHeaders({ 'X-Api-Key': 'abc' });
      provider.setHeaders({ 'X-Tenant': 'org1' });
      expect(provider.getCredentials().headers).toEqual({
        'X-Api-Key': 'abc',
        'X-Tenant': 'org1',
      });
    });

    it('overwrites duplicate header keys', () => {
      const provider = new AuthProvider();
      provider.setHeaders({ 'X-Key': 'old' });
      provider.setHeaders({ 'X-Key': 'new' });
      expect(provider.getCredentials().headers).toEqual({ 'X-Key': 'new' });
    });
  });

  describe('getCredentials()', () => {
    it('returns a copy (not a reference)', () => {
      const provider = new AuthProvider();
      provider.setToken('tok');
      const creds = provider.getCredentials();
      creds.token = 'mutated';
      expect(provider.getCredentials().token).toBe('tok');
    });
  });

  describe('buildUpgradeHeaders()', () => {
    it('returns empty object when no credentials set', () => {
      const provider = new AuthProvider();
      expect(provider.buildUpgradeHeaders()).toEqual({});
    });

    it('includes Authorization Bearer header when token is set', () => {
      const provider = new AuthProvider();
      provider.setToken('my-jwt');
      const headers = provider.buildUpgradeHeaders();
      expect(headers['Authorization']).toBe('Bearer my-jwt');
    });

    it('includes custom headers', () => {
      const provider = new AuthProvider();
      provider.setHeaders({ 'X-Custom': 'val' });
      const headers = provider.buildUpgradeHeaders();
      expect(headers['X-Custom']).toBe('val');
    });

    it('includes both token and custom headers', () => {
      const provider = new AuthProvider();
      provider.setToken('tok');
      provider.setHeaders({ 'X-Key': 'val' });
      const headers = provider.buildUpgradeHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer tok',
        'X-Key': 'val',
      });
    });
  });
});
