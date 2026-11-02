import assert from 'node:assert/strict';
import { classifyMessage, extractPhones } from '../src/orchestrators/classifyWhatsAppMessage.js';

const mixed = 'متوفر\nنيورال شراب\nلوكيلما 5\nمطلوب\nشريطين نيكسفار اقرب تاريخ';
const result = classifyMessage(mixed, 'fixture', '2026-11-02T09:00:00.000Z');
assert.ok(result, 'mixed buy/sell message should be classified');
assert.equal(result.drugTypes['نيكسفار'], 'buy', 'Nexavar after مطلوب must be a buy request');
assert.equal(result.drugTypes['نيورال'], 'sell', 'Neoral after متوفر must remain a sell offer');
assert.deepEqual(extractPhones('+201018984961'), ['01018984961']);
assert.deepEqual(extractPhones('+20 10 1898 4961'), ['01018984961'], 'formatted +20 sender numbers must be extracted');
assert.deepEqual(extractPhones('010-1898-4961'), ['01018984961'], 'formatted local sender numbers must be extracted');

const sameDrugBothSides = classifyMessage(
  'متوفر\nنيكسفار 200 مجم\nمطلوب\nنيكسفار 200 مجم',
  'fixture',
  '2026-11-02T09:00:00.000Z'
);
assert.deepEqual(
  sameDrugBothSides.drugMentions.filter((x) => x.drug === 'نيكسفار').map((x) => x.type),
  ['sell', 'buy'],
  'the same medicine listed in offer and request sections must create both contexts'
);

const arabicDigits = classifyMessage('مطلوب\nنيكسفار ٢٠٠ مجم', 'fixture', '2026-11-02T09:00:00.000Z');
assert.equal(arabicDigits.strengths['نيكسفار'], '200mg', 'Arabic-Indic strength digits must normalize');

const latin = classifyMessage('Available\nNexavar200 mg\nWanted\nNexavar200 mg', 'fixture', '2026-11-02T09:00:00.000Z');
assert.deepEqual(latin.drugMentions.filter((x) => x.drug === 'nexavar').map((x) => x.type), ['sell', 'buy']);

const buyerWithPrice = classifyMessage('مطلوب تارجوسيد 400 مجم بسعر 3,200 ج.م', 'fixture', '2026-11-02T09:00:00.000Z');
assert.equal(buyerWithPrice.type, 'buy', 'a price phrase must not flip a buyer request into an offer');
assert.equal(buyerWithPrice.status, 'request');
assert.equal(buyerWithPrice.price, 3200, 'Egyptian formatted prices must parse correctly');
assert.equal(buyerWithPrice.strengths['تارجوسيد'], '400mg');

const sellerWithEnglish = classifyMessage('Available Clexane 40 mg 1,250 جنيه', 'fixture', '2026-11-02T09:00:00.000Z');
assert.equal(sellerWithEnglish.type, 'sell');
assert.equal(sellerWithEnglish.price, 1250);
assert.equal(sellerWithEnglish.strengths.clexane, '40mg');

const genericName = classifyMessage('مطلوب Human Albumin 20% 1250.50 EGP', 'fixture', '2026-11-02T09:00:00.000Z');
assert.ok(genericName?.drugs.includes('human albumin'), 'multi-word generic medicine names should be extracted');
assert.equal(genericName.price, 1250.5);

const arabicOffer = classifyMessage('متوفر كليكسان ٤٠ مجم', 'fixture', '2026-11-02T09:00:00.000Z');
assert.equal(arabicOffer.strengths['كليكسان'], '40mg');

console.log('PASS: mixed contexts, request/offer integrity, Arabic/English drug extraction, strengths, prices, and Egyptian phone extraction');
