/*!
 * Copyright (c) 2015-2016, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import _ from 'underscore';
import { loc } from './loc';
import bundles from './Bundles';
import countryCallingCodes from './countryCallingCodes';
const fn = {};

// () => [{ countryCode: countryName }], sorted by countryName
fn.getCountries = function() {
  const countries = _.omit(bundles.country, 'HM', 'BV', 'TF');
  // HM, BV, and TF do not have phone prefixes, so don't give the
  // user the option to choose these countries. FYI it appears that these
  // countries do not have calling codes because they are ~~uninhabited~~

  let collection = _.map(countries, function(name, code) {
    return { name: name, code: code };
  });

  // Sort it; figure out if there is a better way to do this (best would
  // be to sort it in the properties file!!)

  collection = _.sortBy(collection, 'name');
  const sorted = {};

  _.each(collection, function(country) {
    sorted[country.code] = country.name;
  });

  return sorted;
};

fn.getCountryCode = function(){

  const countries = _.omit(bundles.country, 'HM', 'BV', 'TF');
  // HM, BV, and TF do not have phone prefixes, so don't give the
  // user the option to choose these countries. FYI it appears that these
  // countries do not have calling codes because they are ~~uninhabited~~

  let collection = _.map(countries, function(name, code) {
    return { name: name, code: code };
  });

  collection = _.sortBy(collection, 'name');
  const sorted = {};

  _.each(collection, function(country) {
    sorted[country.code] = loc('country.option.label', 'login', [country.name, country.code]);
  });

  return sorted;
};

// Restricts getCountries() to the given ISO 3166-1 alpha-2 codes (case-insensitive).
// Returns all countries when no code is given or none of the codes are valid.
fn.getSupportedCountries = function(supportedCountryCodes) {
  const countries = fn.getCountries();
  if (!Array.isArray(supportedCountryCodes) || !supportedCountryCodes.length) {
    return countries;
  }
  const codes = supportedCountryCodes.map(code => String(code).toUpperCase());
  const supported = _.pick(countries, (name, code) => codes.includes(code));
  return _.isEmpty(supported) ? countries : supported;
};

// Returns defaultCountryCode if it is one of the supported countries, else 'US' if supported,
// else the first supported country.
fn.getDefaultCountryCode = function(defaultCountryCode, supportedCountryCodes) {
  const codes = Object.keys(fn.getSupportedCountries(supportedCountryCodes));
  if (codes.includes(defaultCountryCode)) {
    return defaultCountryCode;
  }
  return codes.includes('US') ? 'US' : codes[0];
};

fn.getCallingCodeForCountry = function(countryCode) {
  return countryCallingCodes[countryCode];
};

export default fn;
