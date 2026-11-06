/*
 * Copyright (c) 2022-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import { render } from 'preact';

import type { RenderResult } from '../../../types';
import type { WidgetProps } from '../types';
import OktaSignIn from '.';

let onSuccessWrapper: (res: RenderResult) => void;
jest.mock('preact', () => ({
  ...jest.requireActual<typeof import('preact')>('preact'),
  render: jest.fn(),
  h: jest.fn().mockImplementation((_, props: WidgetProps) => {
    // Extract the passsed globalSuccessFn prop so we can call it later to resolve the render promise
    onSuccessWrapper = props.globalSuccessFn ?? onSuccessWrapper;
  }),
}));

describe('OktaSignIn', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('id', 'test-container');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  it('should add translate="no" to the target element when renderEl is called', async () => {
    const options = {
      el: '#test-container',
      baseUrl: 'https://example.com',
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/redirect',
    };

    const widget = new OktaSignIn(options);

    const renderResult: Promise<RenderResult> = widget.renderEl({
      el: '#test-container',
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/redirect',
    });
    // Normally called by the Widget component but the component is mocked
    onSuccessWrapper({ status: 'SUCCESS' });

    await renderResult;

    expect(container.getAttribute('translate')).toBe('no');
    expect(render).toHaveBeenCalled();
  });

  it('should throw an error if the target element is not found', async () => {
    const options = {
      baseUrl: 'https://example.com',
      clientId: 'test-client-id',
      redirectUri: 'https://example.com/redirect',
    };

    const widget = new OktaSignIn(options);

    await expect(widget.renderEl({
      el: '#non-existent',
      clientId: options.clientId,
      redirectUri: options.redirectUri,
    })).rejects.toThrow('could not find element #non-existent');
    expect(render).not.toHaveBeenCalled();
  });
  it('should retry IDX requests that fail with a transient network error', async () => {
    const widget = new OktaSignIn({ baseUrl: 'https://example.com' });
    const response = { status: 200, responseText: '{}' };
    const originalFetch = window.fetch;
    const headers = new Map([['content-type', 'application/json']]);
    window.fetch = jest.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (key: string) => headers.get(key.toLowerCase()),
          entries: () => headers.entries(),
        },
        json: () => Promise.resolve({}),
      });
    try {
      const result = widget.authClient.options.httpRequestClient!(
        'POST',
        'https://example.com/idp/idx/identify',
        { headers: {} },
      );
      await expect(result).resolves.toMatchObject(response);
      expect(window.fetch).toHaveBeenCalledTimes(2);
    } finally {
      window.fetch = originalFetch;
    }
  });

  it('should not wrap an httpRequestClient provided via authParams', () => {
    const httpRequestClient = jest.fn();
    const widget = new OktaSignIn({ baseUrl: 'https://example.com', authParams: { httpRequestClient } });
    expect(widget.authClient.options.httpRequestClient).toBe(httpRequestClient);
  });
});
