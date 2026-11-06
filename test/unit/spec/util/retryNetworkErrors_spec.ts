import DelayUtil from '../../../../src/util/delay';
import {
  isIdxRequest,
  isTransientNetworkError,
  MAX_NETWORK_ERROR_RETRIES,
  withNetworkErrorRetry,
} from '../../../../src/util/retryNetworkErrors';

const IDX_URL = 'https://foo.okta.com/idp/idx/identify';
const httpResponse = { status: 200, responseText: '{}' };
const networkError = () => new TypeError('Failed to fetch');

describe('util/retryNetworkErrors', () => {
  beforeEach(() => {
    jest.spyOn(DelayUtil, 'delay').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isTransientNetworkError', () => {
    it.each([
      ['Chrome', new TypeError('Failed to fetch')],
      ['Safari', new TypeError('Load failed')],
      ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
      ['non-TypeError with network message', new Error('Network request failed')],
    ])('returns true for %s fetch rejection', (_, error) => {
      expect(isTransientNetworkError(error)).toBe(true);
    });

    it('returns false for HTTP error responses', () => {
      expect(isTransientNetworkError({ status: 0, responseText: '' })).toBe(false);
      expect(isTransientNetworkError({ status: 500, responseText: 'Failed to fetch' })).toBe(false);
    });

    it('returns false when reading a received response body fails', () => {
      expect(isTransientNetworkError(new TypeError('network error'))).toBe(false);
      expect(isTransientNetworkError(new TypeError('Error in body stream'))).toBe(false);
    });

    it('returns false for aborted requests and other errors', () => {
      const abort = new Error('The user aborted a request.');
      abort.name = 'AbortError';
      expect(isTransientNetworkError(abort)).toBe(false);
      expect(isTransientNetworkError(new Error('boom'))).toBe(false);
      expect(isTransientNetworkError(new TypeError('Cannot read properties of undefined'))).toBe(false);
      expect(isTransientNetworkError(undefined)).toBe(false);
    });
  });

  describe('isIdxRequest', () => {
    it('only matches IDX endpoints', () => {
      expect(isIdxRequest(IDX_URL)).toBe(true);
      expect(isIdxRequest('https://foo.okta.com/idp/idx/challenge/poll')).toBe(true);
      expect(isIdxRequest('https://foo.okta.com/oauth2/default/v1/token')).toBe(false);
      expect(isIdxRequest('https://foo.okta.com/api/v1/authn')).toBe(false);
    });
  });

  describe('withNetworkErrorRetry', () => {
    it('retries an IDX request after a transient network error', async () => {
      const client = jest.fn()
        .mockRejectedValueOnce(networkError())
        .mockResolvedValueOnce(httpResponse);
      const options = { headers: {}, data: { stateHandle: 'abc' } };

      await expect(withNetworkErrorRetry(client)('POST', IDX_URL, options)).resolves.toBe(httpResponse);
      expect(client).toHaveBeenCalledTimes(2);
      expect(client).toHaveBeenNthCalledWith(2, 'POST', IDX_URL, options);
      expect(DelayUtil.delay).toHaveBeenCalledTimes(1);
    });

    it('gives up after the max number of retries and rethrows the original error', async () => {
      const error = networkError();
      const client = jest.fn().mockRejectedValue(error);

      await expect(withNetworkErrorRetry(client)('POST', IDX_URL, {})).rejects.toBe(error);
      expect(client).toHaveBeenCalledTimes(MAX_NETWORK_ERROR_RETRIES + 1);
      expect((DelayUtil.delay as jest.Mock).mock.calls).toEqual([[300], [600]]);
    });

    it('does not retry HTTP error responses', async () => {
      const httpError = { status: 400, responseText: '{"errorSummary":"bad"}' };
      const client = jest.fn().mockRejectedValue(httpError);

      await expect(withNetworkErrorRetry(client)('POST', IDX_URL, {})).rejects.toBe(httpError);
      expect(client).toHaveBeenCalledTimes(1);
    });

    it('does not retry non-IDX requests', async () => {
      const client = jest.fn().mockRejectedValue(networkError());
      const url = 'https://foo.okta.com/oauth2/default/v1/token';

      await expect(withNetworkErrorRetry(client)('POST', url, {})).rejects.toThrow('Failed to fetch');
      expect(client).toHaveBeenCalledTimes(1);
    });

    it('passes successful responses through', async () => {
      const client = jest.fn().mockResolvedValue(httpResponse);
      await expect(withNetworkErrorRetry(client)('GET', IDX_URL, {})).resolves.toBe(httpResponse);
      expect(client).toHaveBeenCalledTimes(1);
    });
  });
});
