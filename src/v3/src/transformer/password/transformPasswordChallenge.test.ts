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

import { getStubFormBag, getStubTransactionWithNextStep } from 'src/mocks/utils/utils';
import {
  ButtonElement,
  ButtonType,
  FieldElement,
  HiddenInputElement,
  TitleElement,
  WidgetProps,
} from 'src/types';

import { transformPasswordChallenge } from './transformPasswordChallenge';

describe('Password Challenge Transformer Tests', () => {
  const transaction = getStubTransactionWithNextStep();
  const formBag = getStubFormBag();
  let widgetProps: WidgetProps;
  beforeEach(() => {
    formBag.uischema.elements = [
      { type: 'Field', options: { inputMeta: { name: 'credentials.passcode' } } } as FieldElement,
    ];
    transaction.context = {
      ...transaction.context,
      user: {
        type: 'string',
        value: {
          identifier: 'someuser@noemail.com',
        },
      },
    };
    widgetProps = {};
  });

  it('should add title & submt button elements to ui schema when transforming password challenge step', () => {
    const updatedFormBag = transformPasswordChallenge({ transaction, formBag, widgetProps });

    expect(updatedFormBag).toMatchSnapshot();
    expect(updatedFormBag.uischema.elements.length).toBe(4);
    expect(updatedFormBag.uischema.elements[0].type).toBe('Title');
    expect((updatedFormBag.uischema.elements[0] as TitleElement).options?.content)
      .toBe('oie.password.challenge.title');
    expect((updatedFormBag.uischema.elements[1] as HiddenInputElement).options.value)
      .toBe('someuser@noemail.com');
    expect((updatedFormBag.uischema.elements[2] as FieldElement).options.inputMeta.name)
      .toBe('credentials.passcode');
    expect((updatedFormBag.uischema.elements[3] as ButtonElement).label)
      .toBe('mfa.challenge.verify');
    expect((updatedFormBag.uischema.elements[3] as ButtonElement).type)
      .toBe('Button');
    expect((updatedFormBag.uischema.elements[3] as ButtonElement).options?.type)
      .toBe(ButtonType.SUBMIT);
  });

  describe('incorrect password error', () => {
    const incorrectPasswordMessage = {
      message: 'Password is incorrect',
      i18n: { key: 'incorrectPassword' },
      class: 'ERROR',
    };

    afterEach(() => {
      transaction.messages = undefined;
    });

    const getPasswordElement = (elements: unknown[]) => (elements as FieldElement[])
      .find((el) => el.options?.inputMeta?.name === 'credentials.passcode') as FieldElement;

    it('should add the incorrect password message to the password field so it renders in an error state', () => {
      transaction.messages = [incorrectPasswordMessage];
      const updatedFormBag = transformPasswordChallenge({ transaction, formBag, widgetProps });

      // @ts-expect-error OKTA-539834 - messages missing from type
      expect(getPasswordElement(updatedFormBag.uischema.elements).options.inputMeta.messages)
        .toEqual({ type: 'array', value: [incorrectPasswordMessage] });
      // top-level message is preserved for the form-level error banner
      expect(transaction.messages).toEqual([incorrectPasswordMessage]);
    });

    it('should not add field level messages for unrelated top-level messages', () => {
      transaction.messages = [{
        message: 'You do not have permission to perform the requested action.',
        i18n: { key: 'security.access_denied' },
        class: 'ERROR',
      }];
      const updatedFormBag = transformPasswordChallenge({ transaction, formBag, widgetProps });

      // @ts-expect-error OKTA-539834 - messages missing from type
      expect(getPasswordElement(updatedFormBag.uischema.elements).options.inputMeta.messages)
        .toBeUndefined();
    });

    it('should not override existing field level messages on the password field', () => {
      const fieldMessages = {
        type: 'array',
        value: [{ message: 'Some field error', i18n: { key: 'some.key' }, class: 'ERROR' }],
      };
      formBag.uischema.elements = [{
        type: 'Field',
        options: { inputMeta: { name: 'credentials.passcode', messages: fieldMessages } },
      } as unknown as FieldElement];
      transaction.messages = [incorrectPasswordMessage];
      const updatedFormBag = transformPasswordChallenge({ transaction, formBag, widgetProps });

      // @ts-expect-error OKTA-539834 - messages missing from type
      expect(getPasswordElement(updatedFormBag.uischema.elements).options.inputMeta.messages)
        .toEqual(fieldMessages);
    });
  });
});
