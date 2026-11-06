import Settings from 'models/Settings';
import Bundles from 'util/Bundles';

describe('models/Settings', () => {
  let testContext;
  beforeEach(() => {
    const baseUrl = 'http://foo';
    const authClient = mockAuthClient(baseUrl);
    testContext = {
      authClient,
      baseUrl
    };
  });
  
  function mockAuthClient(baseUrl) {
    let flow;
    const authClient = {
      options: {},
      http: {
        setRequestHeader: () => {}
      },
      getIssuerOrigin: () => baseUrl,
      idx: {
        getFlow: () => flow,
        setFlow: jest.fn().mockImplementation((newFlow) => {
          flow = newFlow;
        }),
      }
    };
    return authClient;
  }

  describe('baseUrl', () => {
    it('cannot create settings without a baseUrl', () => {
      const fn = () => {
        return new Settings();
      };
      expect(fn).toThrowError('"baseUrl" is a required widget parameter');
    });
    it('accepts a baseUrl option and sets it in the model', () => {
      const baseUrl = 'http://foo';
      const settings = new Settings({ baseUrl });
      expect(settings.get('baseUrl')).toBe(baseUrl);
    });
    it('baseUrl can be inferred from issuer option', () => {
      const baseUrl = 'http://foo';
      const issuer = `${baseUrl}/oauth2/default`;
      const settings = new Settings({ issuer });
      expect(settings.get('baseUrl')).toBe(baseUrl);
    });
    it('baseUrl can be inferred from authParams.issuer option', () => {
      const baseUrl = 'http://foo';
      const issuer = `${baseUrl}/oauth2/default`;
      const settings = new Settings({ authParams: { issuer } });
      expect(settings.get('baseUrl')).toBe(baseUrl);
    });
    it('baseUrl can be inferred from authClient issuer', () => {
      const baseUrl = 'http://foo';
      const authClient = mockAuthClient(baseUrl);
      const settings = new Settings({ authClient });
      expect(settings.get('baseUrl')).toBe(baseUrl);
    });
  });

  describe('authClient', () => {
    it('can create settings without an authClient', () => {
      const { baseUrl } = testContext;
      const fn = () => {
        return new Settings({ baseUrl });
      };
      expect(fn).not.toThrow();
    });
    it('accepts an authClient option and sets it in the model', () => {
      const { authClient } = testContext;
      const settings = new Settings({ authClient });
      expect(settings.get('authClient')).toBe(authClient);
    });
    it('exposes authClient on the getAuthClient() method', () => {
      const { authClient } = testContext;
      const settings = new Settings({ authClient });
      expect(settings.getAuthClient()).toBe(authClient);
    });
    it('can set authClient using the setAuthClient() method', () => {
      const { authClient, baseUrl } = testContext;
      const settings = new Settings({ baseUrl });
      settings.setAuthClient(authClient);
      expect(settings.getAuthClient()).toBe(authClient);
      expect(settings.get('authClient')).toBe(authClient);
    });
  });

  describe('flow', () => {
    it('sets flow in authClient if authClient is passed to settings', () => {
      const { baseUrl } = testContext;
      const authClient = mockAuthClient(baseUrl);
      const flow = 'register';
      const settings = new Settings({
        baseUrl,
        flow,
        authClient,
      });
      expect(settings.getAuthClient()).toBe(authClient);
      expect(settings.getAuthClient().idx.setFlow).toHaveBeenCalledWith(flow);
      expect(settings.getAuthClient().idx.getFlow()).toBe(flow);
    });
  });

  describe('oauth2Enabled', () => {
    it('is false by default', () => {
      const { baseUrl } = testContext;
      const settings = new Settings({ baseUrl });
      expect(settings.get('oauth2Enabled')).toBe(false);
    });
    it('is true if clientId option is set', () => {
      const { baseUrl } = testContext;
      const settings = new Settings({ baseUrl, clientId: 'abc' });
      expect(settings.get('oauth2Enabled')).toBe(true);
    });
    it('is true if authClient.options.clientId is set', () => {
      const { baseUrl, authClient } = testContext;
      authClient.options.clientId = 'ABC';
      const settings = new Settings({ baseUrl, authClient });
      expect(settings.get('oauth2Enabled')).toBe(true);
    });
  });

  describe('languageCode', () => {
    const setup = (mock=[], options) => {
      const spy = jest.spyOn(navigator, 'languages', 'get').mockImplementation(() => mock);
      const config = {baseUrl: 'http://foo', ...options};
      const settings = new Settings(config);
      return { spy, settings };
    };

    it('defaults to `en` when navigator returns empty array', () => {
      const { spy, settings } = setup([]);
      expect(settings.get('languageCode')).toEqual('en');
      expect(spy).toHaveBeenCalled();
    });

    it('returns `fr` when navigator returns `fr-FR`', () => {
      const { spy, settings } = setup(['fr-FR']);
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns `fr` when navigator returns `fr`', () => {
      const { spy, settings } = setup(['fr']);
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns `fr` when navigator returns `FR`', () => {
      const { spy, settings } = setup(['FR']);
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns `fr` when navigator returns `FR-FR`', () => {
      const { spy, settings } = setup(['FR-FR']);
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns configured language (via string)', () => {
      const { spy, settings } = setup(['en-US'], {language: 'fr'});
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns configured language (via function)', () => {
      const { spy, settings } = setup(['en-US'], {language: () => 'fr'});
      expect(settings.get('languageCode')).toEqual('fr');
      expect(spy).toHaveBeenCalled();
    });

    it('returns unlisted configured language (via string)', () => {
      const { spy, settings } = setup(['en-US'], {language: 'fr-FR'});
      expect(settings.get('languageCode')).toEqual('fr-FR');
      expect(spy).toHaveBeenCalled();
    });

    // TODO: OKTA-491150 - special case, explicitly test Dutch (nl)
    it('special case: returns `nl-NL` when navigator returns `nl`', () => {
      const { spy, settings } = setup(['nl']);
      expect(settings.get('languageCode')).toEqual('nl-NL');
      expect(spy).toHaveBeenCalled();
    });

    // TODO: OKTA-491150 - special case, explicitly test Portuguese (pt)
    it('special case: returns `pt-BR` when navigator returns `pt`', () => {
      const { spy, settings } = setup(['pt']);
      expect(settings.get('languageCode')).toEqual('pt-BR');
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('countryCode and countries', () => {
    const create = (options = {}) => new Settings({ baseUrl: 'http://base', ...options });

    it('defaults to all countries and "US"', () => {
      const settings = create();
      expect(Object.keys(settings.get('countries')).length).toBeGreaterThan(200);
      expect(settings.get('countryCode')).toBe('US');
    });
    it('reflects country names loaded after Settings is created', () => {
      const settings = create({ supportedCountryCodes: ['US', 'FR'] });
      expect(settings.get('countries')).toEqual({ FR: 'France', US: 'United States' });
      const originalCountry = Bundles.country;
      Bundles.country = { ...originalCountry, US: 'États-Unis' };
      try {
        expect(settings.get('countries')).toEqual({ US: 'États-Unis', FR: 'France' });
      } finally {
        Bundles.country = originalCountry;
      }
    });
    it('uses defaultCountryCode when it is valid', () => {
      expect(create({ defaultCountryCode: 'GB' }).get('countryCode')).toBe('GB');
    });
    it('falls back to "US" when defaultCountryCode is invalid', () => {
      expect(create({ defaultCountryCode: 'FAKECODE' }).get('countryCode')).toBe('US');
    });
    it('restricts countries to supportedCountryCodes', () => {
      const settings = create({ supportedCountryCodes: ['us', 'CA', 'FAKECODE'] });
      expect(Object.keys(settings.get('countries'))).toEqual(['CA', 'US']);
      expect(settings.get('countryCode')).toBe('US');
    });
    it('shows all countries when none of supportedCountryCodes are valid', () => {
      const settings = create({ supportedCountryCodes: ['FAKECODE'] });
      expect(Object.keys(settings.get('countries')).length).toBeGreaterThan(200);
    });
    it('uses defaultCountryCode when it is supported', () => {
      expect(create({ supportedCountryCodes: ['US', 'CA'], defaultCountryCode: 'CA' }).get('countryCode')).toBe('CA');
    });
    it('falls back to "US" when defaultCountryCode is not supported', () => {
      expect(create({ supportedCountryCodes: ['US', 'CA'], defaultCountryCode: 'GB' }).get('countryCode')).toBe('US');
    });
    it('falls back to the first supported country when neither defaultCountryCode nor "US" are supported', () => {
      expect(create({ supportedCountryCodes: ['GB', 'FR'], defaultCountryCode: 'DE' }).get('countryCode')).toBe('FR');
    });
  });

  describe('backToSignInUri', () => {
    it('can be set using `signOutLink`', () => {
      const settings = new Settings({ baseUrl: 'http://base', signOutLink: 'http://foo' });
      expect(settings.get('backToSignInUri')).toBe('http://foo');
    });
    it('can be set using `backToSignInLink`', () => {
      const settings = new Settings({ baseUrl: 'http://base', backToSignInLink: 'http://foo' });
      expect(settings.get('backToSignInUri')).toBe('http://foo');
    });
    it('`backToSignInLink` takes precedence over `signOutLink`', () => {
      const settings = new Settings({ baseUrl: 'http://base', backToSignInLink: 'http://foo', signOutLink: 'http://bar' });
      expect(settings.get('backToSignInUri')).toBe('http://foo');
    });
  });
});