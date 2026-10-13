import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decimalToUnits, formatUnits } from './amounts';

test('lamports and six-decimal tokens preserve exact amounts', () => {
  assert.equal(decimalToUnits('0.000000001', 9), '1');
  assert.equal(decimalToUnits('1.234567', 6), '1234567');
  assert.equal(decimalToUnits('9007199254740993.000001', 6), '9007199254740993000001');
});
test('unsupported precision and ambiguous amounts cannot become transactions', () => {
  for (const input of ['0', '-1', '1e6', '1,2', '.5', '1.0000001', 'NaN']) assert.throws(() => decimalToUnits(input, 6));
});
test('formatting preserves zero and base-unit precision', () => {
  assert.equal(formatUnits('0', 9), '0');
  assert.equal(formatUnits('1', 9), '0.000000001');
  assert.equal(formatUnits('1000000000', 6), '1 000');
  assert.equal(formatUnits('unknown', 9), 'No disponible');
});
