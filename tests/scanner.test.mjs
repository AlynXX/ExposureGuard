import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, sampleText } from '../app/lib/exposure.ts';
const ofType = (text, type) => scanText(text).filter(f => f.type === type);

test('detects both language samples and preserves source', () => {
  for (const lang of ['pl', 'en']) {
    const results = scanText(sampleText[lang], 'file');
    for (const type of ['EMAIL', 'PHONE', 'DATE_OF_BIRTH', 'USERNAME']) assert.ok(results.some(f => f.type === type), type);
    assert.ok(results.every(f => f.source === 'file'));
  }
});
test('validates PESEL calendar and checksum together', () => {
  assert.equal(ofType('PESEL: 44051401458', 'PESEL').length, 1);
  assert.equal(ofType('PESEL: 44051401459', 'PESEL').length, 0);
  assert.equal(ofType('PESEL: 00000000000', 'PESEL').length, 0);
});
test('bank account followed by prose is recognised without fragment alarms', () => {
  const result = scanText('IBAN: PL61 1090 1014 0000 0712 1981 2874 to rachunek testowy.');
  assert.equal(result.filter(f => f.type === 'IBAN').length, 1);
  assert.equal(result.filter(f => ['PHONE', 'CARD'].includes(f.type)).length, 0);
});
test('cards pass Luhn, reject repeated placeholders and do not create phones', () => {
  const result = scanText('Test card: 4111 1111 1111 1111.');
  assert.equal(result.filter(f => f.type === 'CARD').length, 1);
  assert.equal(result.filter(f => f.type === 'PHONE').length, 0);
  assert.equal(ofType('0000 0000 0000 0000', 'CARD').length, 0);
  assert.equal(ofType('4111 1111 1111 1112', 'CARD').length, 0);
});
test('dates need birth context and valid calendar values', () => {
  assert.equal(ofType('Wydanie produktu 14.03.1997', 'DATE_OF_BIRTH').length, 0);
  assert.equal(ofType('Data urodzenia 31.02.1997', 'DATE_OF_BIRTH').length, 0);
  assert.equal(ofType('Born 29.02.2000', 'DATE_OF_BIRTH').length, 1);
  assert.equal(ofType('Born 29.02.2001', 'DATE_OF_BIRTH').length, 0);
});
test('phone formatting is deduplicated and surrounding number groups are rejected', () => {
  assert.equal(ofType('501 234 567, 501-234-567', 'PHONE').length, 1);
  assert.equal(ofType('1234 5678 9012 3456 7890', 'PHONE').length, 0);
  assert.equal(ofType('000000000', 'PHONE').length, 0);
});
test('email local part containing a separator does not create a username', () => {
  const result = scanText('anna.kowalska@example.com');
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'EMAIL');
  assert.notEqual(result[0].maskedValue, result[0].value);
});
