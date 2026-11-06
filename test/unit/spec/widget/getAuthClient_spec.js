import { OktaAuth } from '@okta/okta-auth-js';
import getAuthClient from 'widget/getAuthClient';
import config from 'config/config.json';
import DelayUtil from 'util/delay';


describe('widget/getAuthClient', () => {
  it('creates auth client if one is not passed through widget options', () => {
    const authClient = getAuthClient(OktaAuth, {authParams: { issuer: 'https://foo.bar'}});
    expect(authClient.options.issuer).toEqual('https://foo.bar');
    expect(authClient instanceof OktaAuth).toBe(true);
  });

  it('creates auth client with predefined flow', () => {
    const authClient = getAuthClient(OktaAuth, {
      issuer: 'https://foo.bar',
      flow: 'register'
    });
    expect(authClient.idx.getFlow()).toEqual('register');
  });

  it('retries IDX requests that fail with a transient network error', async () => {
    const authClient = getAuthClient(OktaAuth, {authParams: { issuer: 'https://foo.bar'}});
    const headers = new Map([['content-type', 'application/json']]);
    const fetchResponse = {
      ok: true,
      status: 200,
      headers: { get: (key) => headers.get(key.toLowerCase()), entries: () => headers.entries() },
      json: () => Promise.resolve({ stateHandle: 'abc' }),
    };
    const originalFetch = window.fetch;
    window.fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(fetchResponse);
    jest.spyOn(DelayUtil, 'delay').mockResolvedValue();

    try {
      const result = await authClient.options.httpRequestClient('POST', 'https://foo.bar/idp/idx/identify', { headers: {} });
      expect(result).toMatchObject({ status: 200, responseJSON: { stateHandle: 'abc' } });
      expect(window.fetch).toHaveBeenCalledTimes(2);
    } finally {
      window.fetch = originalFetch;
      DelayUtil.delay.mockRestore();
    }
  });

  it('does not wrap an httpRequestClient provided via authParams', () => {
    const httpRequestClient = jest.fn();
    const authClient = getAuthClient(OktaAuth, {authParams: { issuer: 'https://foo.bar', httpRequestClient }});
    expect(authClient.options.httpRequestClient).toBe(httpRequestClient);
  });

  it('returns auth client passed via widget options', () => {
    const mockAuthClient = {
      options: {
        issuer: 'https://options.foo.bar',
      },
      _oktaUserAgent: {
        addEnvironment: jest.fn()
      }
    };

    const authClient = getAuthClient(OktaAuth, {
      authParams: { issuer: 'https://foo.bar'},
      authClient: mockAuthClient
    });
    expect(authClient.options.issuer).toEqual('https://options.foo.bar');
  });

  it('updates auth client\'s user agent with SIW version', () => {
    const mockAuthClient = {
      _oktaUserAgent: {
        addEnvironment: jest.fn()
      }
    };

    getAuthClient(OktaAuth, {
      authClient: mockAuthClient
    });
    expect(mockAuthClient._oktaUserAgent.addEnvironment).toHaveBeenCalledWith(`okta-signin-widget-${config.version}`);
  });

  it('throws an error when provided auth client doesn\'t have UA helper', () => {
    expect(() => getAuthClient(OktaAuth, { authClient: {} })).toThrowError('The passed in authClient should be version 5.4.0 or above.');
  });
});
