import FormController from 'v2/controllers/FormController';

describe('v2/controllers/FormController', () => {
  describe('handleSwitchForm', () => {
    let appState;
    let beforeHook;
    let afterHook;
    let order;

    beforeEach(() => {
      order = [];
      beforeHook = jest.fn(() => {
        order.push('before');
        return Promise.resolve();
      });
      afterHook = jest.fn(() => {
        order.push('after');
        return Promise.resolve();
      });

      appState = {
        get: jest.fn(() => null),
        unset: jest.fn(),
        set: jest.fn(() => {
          order.push('set:currentFormName');
        }),
        hooks: {
          getHook: jest.fn(() => ({ before: [beforeHook], after: [afterHook] })),
        },
      };
    });

    function callHandler(formName) {
      // Invoke the prototype method directly with a minimal fake `this` —
      // handleSwitchForm only depends on `this.options.appState`, and this
      // avoids spinning up Backbone routing/view machinery.
      return FormController.prototype.handleSwitchForm.call(
        { options: { appState } },
        formName,
      );
    }

    it('runs before/after hooks registered for the target form', async () => {
      await callHandler('select-authenticator-authenticate');

      expect(appState.hooks.getHook).toHaveBeenCalledWith('select-authenticator-authenticate');
      expect(beforeHook).toHaveBeenCalledTimes(1);
      expect(afterHook).toHaveBeenCalledTimes(1);
    });

    it('runs the before hook, then changes currentFormName, then runs the after hook', async () => {
      await callHandler('select-authenticator-authenticate');

      expect(order).toEqual(['before', 'set:currentFormName', 'after']);
      expect(appState.set).toHaveBeenCalledWith('currentFormName', 'select-authenticator-authenticate');
    });

    it('still changes currentFormName when no hook is registered for the target form', async () => {
      appState.hooks.getHook.mockReturnValue(undefined);

      await callHandler('select-authenticator-authenticate');

      expect(appState.set).toHaveBeenCalledWith('currentFormName', 'select-authenticator-authenticate');
      expect(beforeHook).not.toHaveBeenCalled();
      expect(afterHook).not.toHaveBeenCalled();
    });

    it('does not throw when appState has no hooks model', async () => {
      delete appState.hooks;

      await expect(callHandler('select-authenticator-authenticate')).resolves.not.toThrow();
      expect(appState.set).toHaveBeenCalledWith('currentFormName', 'select-authenticator-authenticate');
    });

    it('clears existing messages before switching forms', async () => {
      appState.get.mockImplementation((key) => (key === 'messages' ? [{}] : null));

      await callHandler('select-authenticator-authenticate');

      expect(appState.unset).toHaveBeenCalledWith('messages');
    });
  });
});

describe('v2/controllers/FormController handleSaveForm configured flow reset', () => {
  let authClient;
  let savedMeta;
  let fakeThis;

  function createModel(formName, json = {}) {
    return {
      get: jest.fn((key) => (key === 'formName' ? formName : undefined)),
      toJSON: jest.fn(() => ({ ...json })),
      trigger: jest.fn(),
    };
  }

  function setup(flow) {
    let currentFlow = flow;
    savedMeta = { flow, interactionHandle: 'fake-interaction-handle' };
    authClient = {
      idx: {
        getFlow: jest.fn(() => currentFlow),
        setFlow: jest.fn((newFlow) => { currentFlow = newFlow; }),
        getSavedTransactionMeta: jest.fn(() => savedMeta),
        saveTransactionMeta: jest.fn((meta) => { savedMeta = meta; }),
        proceed: jest.fn(() => Promise.resolve({ requestDidSucceed: true })),
      },
    };
    const settings = {
      get: jest.fn(() => undefined),
      getAuthClient: jest.fn(() => authClient),
      postRegistrationSubmit: jest.fn((email, onSuccess) => onSuccess()),
    };
    fakeThis = {
      options: {
        settings,
        appState: {
          hasRemediationObject: jest.fn(() => true),
          get: jest.fn((key) => (key === 'idx' ? { context: { stateHandle: 'fake-state-handle' } } : undefined)),
        },
      },
      settings,
      toggleFormButtonState: jest.fn(),
      transformIdentifier: jest.fn((formName, payload) => payload),
      handleIdxResponse: jest.fn(() => Promise.resolve()),
      showFormErrors: jest.fn(() => Promise.resolve()),
    };
  }

  function callHandler(model) {
    return FormController.prototype.handleSaveForm.call(fakeThis, model);
  }

  it('resets the signup flow to default when submitting enroll-profile', async () => {
    setup('signup');
    await callHandler(createModel('enroll-profile', { userProfile: { email: 'jane@example.com' } }));

    expect(authClient.idx.setFlow).toHaveBeenCalledWith('default');
    expect(authClient.idx.saveTransactionMeta).toHaveBeenCalledWith({
      flow: 'default',
      interactionHandle: 'fake-interaction-handle',
    });
    expect(authClient.idx.proceed).toHaveBeenCalledWith(expect.objectContaining({
      step: 'enroll-profile',
      flow: 'default',
      stateHandle: 'fake-state-handle',
    }));
    expect(fakeThis.handleIdxResponse).toHaveBeenCalled();
  });

  it('does not change the flow when submitting enroll-profile in the default flow', async () => {
    setup('default');
    await callHandler(createModel('enroll-profile'));

    expect(authClient.idx.setFlow).not.toHaveBeenCalled();
    expect(authClient.idx.saveTransactionMeta).not.toHaveBeenCalled();
    expect(authClient.idx.proceed.mock.calls[0][0]).not.toHaveProperty('flow');
  });

  it('does not change the signup flow for forms other than enroll-profile', async () => {
    setup('signup');
    await callHandler(createModel('select-enroll-profile'));

    expect(authClient.idx.setFlow).not.toHaveBeenCalled();
    expect(authClient.idx.proceed.mock.calls[0][0]).not.toHaveProperty('flow');
  });

  it('still resets the resetPassword flow to default when submitting reset-authenticator', async () => {
    setup('resetPassword');
    await callHandler(createModel('reset-authenticator'));

    expect(authClient.idx.setFlow).toHaveBeenCalledWith('default');
    expect(authClient.idx.saveTransactionMeta).toHaveBeenCalledWith(expect.objectContaining({ flow: 'default' }));
    expect(authClient.idx.proceed).toHaveBeenCalledWith(expect.objectContaining({
      step: 'reset-authenticator',
      flow: 'default',
    }));
  });
});
