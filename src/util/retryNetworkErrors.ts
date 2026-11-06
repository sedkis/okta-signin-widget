/*!
 * Copyright (c) 2026, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import type { HttpRequestClient } from '@okta/okta-auth-js';
import DelayUtil from './delay';

// Messages browsers use when `fetch` rejects before any HTTP response is received
// (Chrome/Edge, Safari, Firefox, React Native respectively).
const NETWORK_ERROR_PATTERN = /Failed to fetch|Load failed|NetworkError|Network request failed/i;
const IDX_PATH_PATTERN = /\/idp\/idx\//;

export const MAX_NETWORK_ERROR_RETRIES = 2;
export const NETWORK_ERROR_RETRY_DELAY_MS = 300;

/**
 * True when `fetch` itself rejected (e.g. Chrome `net::ERR_HTTP2_PROTOCOL_ERROR`,
 * connection reset) and no HTTP response was received. HTTP error responses
 * (4xx/5xx) and aborted requests are not considered transient network errors.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { name, message, status } = error as { name?: string; message?: string; status?: unknown };
  if (typeof status === 'number' || name === 'AbortError') {
    return false;
  }
  return name === 'TypeError' || isNetworkErrorMessage(message);
}

export function isNetworkErrorMessage(message: unknown): boolean {
  return typeof message === 'string' && NETWORK_ERROR_PATTERN.test(message);
}

export function isIdxRequest(url: string): boolean {
  return typeof url === 'string' && IDX_PATH_PATTERN.test(url);
}

/**
 * Wraps an auth-js `httpRequestClient` so that IDX requests failing with a transient,
 * transport-level network error are retried a limited number of times before the
 * error is surfaced to the user as "Failed to fetch".
 */
export function withNetworkErrorRetry(
  httpRequestClient: HttpRequestClient,
  maxRetries = MAX_NETWORK_ERROR_RETRIES,
): HttpRequestClient {
  return (method, url, options) => {
    const attempt = (retryCount: number) => httpRequestClient(method, url, options)
      .catch(async (error) => {
        if (retryCount >= maxRetries || !isIdxRequest(url) || !isTransientNetworkError(error)) {
          throw error;
        }
        await DelayUtil.delay(NETWORK_ERROR_RETRY_DELAY_MS * (retryCount + 1));
        return attempt(retryCount + 1);
      });
    return attempt(0);
  };
}
