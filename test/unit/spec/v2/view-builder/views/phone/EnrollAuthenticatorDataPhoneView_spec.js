import EnrollAuthenticatorDataPhoneView from 'v2/view-builder/views/phone/EnrollAuthenticatorDataPhoneView';
import AppState from 'v2/models/AppState';
import Settings from 'models/Settings';

describe('v2/view-builder/views/phone/EnrollAuthenticatorDataPhoneView', function() {
  const createViewState = () => ({
    name: 'authenticator-enrollment-data',
    uiSchema: [
      {
        name: 'authenticator.methodType',
        type: 'radio',
        options: [
          { label: 'SMS', value: 'sms' },
          { label: 'Voice call', value: 'voice' },
        ],
        value: 'sms',
      },
      {
        name: 'authenticator.phoneNumber',
        type: 'text',
        label: 'Phone number',
      },
    ],
  });

  function render(settingsOptions = {}) {
    const appState = new AppState({ idx: { neededToProceed: [] } }, {});
    const settings = new Settings({
      baseUrl: 'http://localhost:3000',
      ...settingsOptions,
    });
    const view = new EnrollAuthenticatorDataPhoneView({
      appState,
      settings,
      currentViewState: createViewState(),
    });
    view.render();
    return view;
  }

  function getCountryOptions(view) {
    return view.$el.find('select[name="country"] option').toArray().map(option => option.value);
  }

  afterEach(function() {
    jest.restoreAllMocks();
  });

  it('shows all countries when supportedCountryCodes is not set', function() {
    const view = render();
    const countries = getCountryOptions(view);

    expect(countries.length).toBeGreaterThan(200);
    expect(view.model.get('country')).toBe('US');
    expect(view.$el.find('.phone-authenticator-enroll__phone-code').text()).toBe('+1');
  });

  it('only shows the countries in supportedCountryCodes', function() {
    const view = render({ supportedCountryCodes: ['US', 'ca', 'MX', 'INVALID'] });

    expect(getCountryOptions(view)).toEqual(['CA', 'MX', 'US']);
    expect(view.model.get('country')).toBe('US');
  });

  it('selects defaultCountryCode when it is one of the supported countries', function() {
    const view = render({ supportedCountryCodes: ['US', 'CA', 'MX'], defaultCountryCode: 'MX' });

    expect(view.model.get('country')).toBe('MX');
    expect(view.$el.find('.phone-authenticator-enroll__phone-code').text()).toBe('+52');
  });

  it('selects the first supported country when neither defaultCountryCode nor US is supported', function() {
    const view = render({ supportedCountryCodes: ['GB', 'FR'], defaultCountryCode: 'DE' });

    expect(getCountryOptions(view)).toEqual(['FR', 'GB']);
    expect(view.model.get('country')).toBe('FR');
    expect(view.$el.find('.phone-authenticator-enroll__phone-code').text()).toBe('+33');
  });

  it('formats the phone number with the calling code of the selected supported country', function() {
    const view = render({ supportedCountryCodes: ['GB', 'FR'] });
    view.model.set('authenticator.phoneNumber', '612345678');

    expect(view.model.toJSON().authenticator.phoneNumber).toBe('+33612345678');
  });
});
