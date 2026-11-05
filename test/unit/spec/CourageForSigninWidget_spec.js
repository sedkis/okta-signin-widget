import { Form, Model } from '@okta/courage';
import Settings from 'models/Settings';

describe('courage for signin widget', () => {
  let testContext;
  beforeEach(() => {
    testContext = {};
  });
  describe('Form', () => {
    beforeEach(() => {
      testContext.model = new Model();
      testContext.settings = new Settings({ baseUrl: 'http://localhost:3000' });
    });
    describe('scrollOnError', () => {
      it('is true by default', () => {
        const { model, settings } = testContext;
        const form = new Form({ model, settings });
        expect(form.getAttribute('scrollOnError')).toBe(true);
      });
      it('can be overriden by child definition', () => {
        const { model, settings } = testContext;
        const MyForm = Form.extend({
          scrollOnError: false
        });
        const form = new MyForm({ model, settings });
        expect(form.getAttribute('scrollOnError')).toBe(false);
      });
      it('can be set to false by global config option', () => {
        const { model, settings } = testContext;
        settings.set('features.scrollOnError', false);
        const form = new Form({ model, settings });
        expect(form.getAttribute('scrollOnError')).toBe(false);
      });
    });

    describe('saving state', () => {
      const createForm = (options = {}) => {
        const { model, settings } = testContext;
        const MyForm = Form.extend({
          hasSavingState: true,
          inputs: [
            { type: 'text', name: 'username', label: 'Username' },
            { type: 'password', name: 'password', label: 'Password' },
            { type: 'checkbox', name: 'rememberMe', placeholder: 'Keep me signed in' },
            { type: 'text', name: 'alreadyDisabled', label: 'Disabled', disabled: true },
          ],
          ...options,
        });
        const form = new MyForm({ model, settings });
        form.render();
        document.body.appendChild(form.el);
        return form;
      };
      const $input = (form, name) => form.$(`[name="${name}"]`);

      afterEach(() => {
        document.body.innerHTML = '';
      });

      it('makes text inputs readonly and disables other controls while saving', () => {
        const form = createForm();
        expect($input(form, 'username').prop('readOnly')).toBe(false);
        expect($input(form, 'rememberMe').prop('disabled')).toBe(false);

        testContext.model.trigger('request');

        expect(form.$el.hasClass('o-form-saving')).toBe(true);
        expect($input(form, 'username').prop('readOnly')).toBe(true);
        expect($input(form, 'username').prop('disabled')).toBe(false);
        expect($input(form, 'password').prop('readOnly')).toBe(true);
        expect($input(form, 'rememberMe').prop('disabled')).toBe(true);
      });

      it('restores inputs when saving fails', () => {
        const form = createForm();
        testContext.model.trigger('request');
        testContext.model.trigger('error', testContext.model, { responseJSON: {} });

        expect(form.$el.hasClass('o-form-saving')).toBe(false);
        expect($input(form, 'username').prop('readOnly')).toBe(false);
        expect($input(form, 'password').prop('readOnly')).toBe(false);
        expect($input(form, 'rememberMe').prop('disabled')).toBe(false);
      });

      it('restores inputs when saving succeeds', () => {
        const form = createForm();
        form.__setSavingState();
        form.__clearSavingState();

        expect($input(form, 'username').prop('readOnly')).toBe(false);
        expect($input(form, 'rememberMe').prop('disabled')).toBe(false);
      });

      it('does not re-enable inputs that were disabled before saving', () => {
        const form = createForm();
        expect($input(form, 'alreadyDisabled').prop('disabled')).toBe(true);

        form.__setSavingState();
        form.__clearSavingState();

        expect($input(form, 'alreadyDisabled').prop('disabled')).toBe(true);
        expect($input(form, 'alreadyDisabled').prop('readOnly')).toBe(false);
      });

      it('restores focus to a disabled control after saving', () => {
        const form = createForm();
        $input(form, 'rememberMe').trigger('focus');
        expect(document.activeElement).toBe($input(form, 'rememberMe')[0]);

        form.__setSavingState();
        form.__clearSavingState();

        expect(document.activeElement).toBe($input(form, 'rememberMe')[0]);
      });

      it('does not lock inputs when hasSavingState is false', () => {
        const form = createForm({ hasSavingState: false });
        testContext.model.trigger('request');

        expect($input(form, 'username').prop('readOnly')).toBe(false);
        expect($input(form, 'rememberMe').prop('disabled')).toBe(false);
      });
    });
  });
});
