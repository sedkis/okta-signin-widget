import { RequestMock, RequestLogger } from 'testcafe';
import BasePageObject from '../framework/page-objects/BasePageObject';
import RegistrationPageObject from '../framework/page-objects/RegistrationPageObject';
import PostAuthKeepMeSignedInPageObject from '../framework/page-objects/PostAuthKeepMeSignedInPageObject';
import { renderWidget } from '../framework/shared';

import xhrIdentify from '../../../playground/mocks/data/idp/idx/identify';
import xhrEnrollProfileNew from '../../../playground/mocks/data/idp/idx/enroll-profile-new';
import xhrPostAuthKeepMeSignedIn from '../../../playground/mocks/data/idp/idx/post-auth-keep-me-signed-in';
import xhrSuccess from '../../../playground/mocks/data/idp/idx/success';
import { oktaDashboardContent } from '../framework/a11y';

// okta/okta-signin-widget#4132: Self-Service Registration (`flow: 'signup'`) with POST KMSI.
//
// Flow: introspect (identify) → auth-js auto-steps into select-enroll-profile → enroll-profile
//   → submit profile → keep-me-signed-in → success
//
// Gen2: with `flow: 'signup'`, auth-js runs remediations through RegistrationFlow, which does not
//   contain keep-me-signed-in. Before the fix, submitting the profile threw
//   "No remediation can match current flow ... Remediations: [keep-me-signed-in]".
const mock = RequestMock()
  .onRequestTo('http://localhost:3000/idp/idx/introspect')
  .respond(xhrIdentify)
  .onRequestTo('http://localhost:3000/idp/idx/enroll')
  .respond(xhrEnrollProfileNew)
  .onRequestTo('http://localhost:3000/idp/idx/enroll/new')
  .respond(xhrPostAuthKeepMeSignedIn)
  .onRequestTo('http://localhost:3000/idp/idx/keep-me-signed-in')
  .respond(xhrSuccess)
  .onRequestTo(/^http:\/\/localhost:3000\/app\/UserHome.*/)
  .respond(oktaDashboardContent);

const logger = RequestLogger(/idp\/idx/,
  {
    logRequestBody: true,
    stringifyRequestBody: true,
  }
);

fixture('Registration (flow: signup) with POST KMSI');

async function setup(t) {
  const registrationPage = new RegistrationPageObject(t);
  await registrationPage.navigateToPage({ render: false });
  await renderWidget({ flow: 'signup' });
  await t.expect(registrationPage.formExists()).eql(true);
  return registrationPage;
}

test
  .meta('gen3', false) // Gen3 uses auth-js GenericRemediator, so it is not limited by RegistrationFlow
  .requestHooks(logger, mock)('should show KMSI after submitting the registration form', async t => {
    const registrationPage = await setup(t);

    await registrationPage.fillFirstNameField('Jane');
    await registrationPage.fillLastNameField('Doe');
    await registrationPage.fillEmailField('jane.doe@example.com');
    await registrationPage.clickRegisterButton();

    await t.expect(logger.contains(record => record.request.url.match(/idp\/idx\/enroll\/new/))).eql(true);

    const kmsiPage = new PostAuthKeepMeSignedInPageObject(t);
    await t.expect(kmsiPage.getFormTitle()).eql('Keep me signed in');
    await t.expect(kmsiPage.getAcceptButtonText()).eql('Stay signed in');
    await t.expect(kmsiPage.getRejectButtonText()).eql('Don\'t stay signed in');

    await kmsiPage.clickAcceptButton();
    const pageUrl = await new BasePageObject(t).getPageUrl();
    await t.expect(pageUrl).contains('/app/UserHome');
  });
