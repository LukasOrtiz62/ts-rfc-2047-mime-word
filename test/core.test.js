import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, encodeWord, needsEncoding } from '../src/core.js';

test('needsEncoding returns false for printable ASCII', () => {
  assert.equal(needsEncoding('Hello, world!'), false);
  assert.equal(needsEncoding(''), false);
  assert.equal(needsEncoding('\x20\x7e'), false);
});

test('needsEncoding returns true for non-ASCII and control characters', () => {
  assert.equal(needsEncoding('caf\u00e9'), true);
  assert.equal(needsEncoding('\x00'), true);
  assert.equal(needsEncoding('\x1f'), true);
  assert.equal(needsEncoding('\x7f'), true);
  assert.equal(needsEncoding('\u0100'), true);
});

test('encodeWord encodes a simple ASCII string', () => {
  const result = encodeWord('hello');
  assert.equal(result, '=?UTF-8?B?aGVsbG8=?=');
});

test('encodeWord encodes a non-ASCII string', () => {
  const result = encodeWord('caf\u00e9');
  assert.equal(result, '=?UTF-8?B?Y2Fmw6k=?=');
});

test('encodeWord uses the provided charset label', () => {
  const result = encodeWord('caf\u00e9', 'ISO-8859-1');
  assert.equal(result, '=?ISO-8859-1?B?Y2Fmw6k=?=');
});

test('encode returns the input unchanged when it is pure ASCII', () => {
  assert.equal(encode('Hello'), 'Hello');
  assert.equal(encode(''), '');
  assert.equal(encode('\x20\x7e'), '\x20\x7e');
});

test('encode produces a single encoded-word for short non-ASCII input', () => {
  assert.equal(encode('caf\u00e9'), '=?UTF-8?B?Y2Fmw6k=?=');
});

test('encode splits long input into multiple encoded-words', () => {
  // 60 characters of 'a' plus a non-ASCII character forces encoding.
  // The encoded output must be split because the base64 payload would
  // exceed the 75-character limit for a single encoded-word.
  const input = 'a'.repeat(60) + '\u00e9';
  const result = encode(input);
  const words = result.split(' ');
  assert.ok(words.length > 1, 'expected more than one encoded-word');
  for (const word of words) {
    assert.ok(word.length <= 75, `encoded-word too long: ${word.length}`);
    assert.ok(word.startsWith('=?UTF-8?B?'), 'wrong prefix');
    assert.ok(word.endsWith('?='), 'wrong suffix');
  }
});

test('encode splits on byte boundaries and can split multi-byte characters', () => {
  // This test documents the deliberate choice to split on bytes.
  // A 2-byte character (U+00E9) is placed so that it straddles the
  // boundary between two encoded-words.
  const input = 'a'.repeat(48) + '\u00e9' + 'b'.repeat(48);
  const result = encode(input);
  const words = result.split(' ');
  assert.ok(words.length > 1, 'expected more than one encoded-word');
  // The concatenation of decoded bytes must be valid UTF-8.
  const decoded = words.map((w) => {
    const b64 = w.slice('=?UTF-8?B?'.length, -2);
    return Buffer.from(b64, 'base64');
  });
  const combined = Buffer.concat(decoded);
  assert.equal(combined.toString('utf8'), input);
});

test('encode throws for a charset name that is too long', () => {
  const longCharset = 'X'.repeat(100);
  assert.throws(() => encode('caf\u00e9', longCharset), RangeError);
});

test('encodeWord and encode reject non-string input', () => {
  assert.throws(() => encodeWord(123), TypeError);
  assert.throws(() => encode(123), TypeError);
  assert.throws(() => needsEncoding(123), TypeError);
});

test('encodeWord rejects an empty charset', () => {
  assert.throws(() => encodeWord('caf\u00e9', ''), TypeError);
});
