import test from 'node:test';
import assert from 'node:assert/strict';
import {isoCurrencyIn} from '../packages/runtime-api/src/commercial-canonical';

// M10.1 invariant: "the" is never a currency; the stated ISO code or named currency is.
test('M10.1: the contract currency is the stated ISO code or named currency, never a word',()=>{
  assert.equal(isoCurrencyIn('the Saudi Riyal (SAR)'),'SAR');
  assert.equal(isoCurrencyIn('the UAE Dirham'),'AED');
  assert.equal(isoCurrencyIn('AED and are exclusive of VAT unless expressly stated otherwise'),'AED');
  assert.equal(isoCurrencyIn('the currency stated in the Appendix'),null,'no currency stated: unknown, never THE');
  assert.equal(isoCurrencyIn('USD'),'USD');
});
