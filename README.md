# ts-rfc-2047-mime-word

Encodes non-ASCII text into RFC 2047 encoded-word strings for use in MIME message headers.

## Usage

```js
import { encode, encodeWord, needsEncoding } from 'ts-rfc-2047-mime-word';

needsEncoding('caf\u00e9');           // true
needsEncoding('hello');              // false

encodeWord('caf\u00e9');             // '=?UTF-8?B?Y2Fmw6k=?='
encode('caf\u00e9');                 // '=?UTF-8?B?Y2Fmw6k=?='
encode('hello');                     // 'hello'
```

`encode` returns the input unchanged when it contains only printable ASCII. Otherwise it returns one or more encoded-words joined by spaces, with each encoded-word at most 75 characters long.

## Why this exists

MIME headers must be 7-bit clean, but real-world names and subjects contain non-ASCII text. RFC 2047 defines a way to embed that text as `=?charset?encoding?data?=` tokens. This library implements the Base64 (`B`) encoding, which is simpler and more predictable than quoted-printable (`Q`). The trade-off is that Base64 output is larger, but it avoids the subtle escaping rules of `Q` and makes length calculations straightforward.

## The awkward edge

When the input is long enough to require multiple encoded-words, this library splits the UTF-8 byte stream on a fixed byte boundary. That can split a multi-byte character across two encoded-words. RFC 2047 permits this, because a decoder is expected to concatenate the decoded bytes before interpreting them as text. In practice, most decoders do the right thing, but some do not. If you need character-safe splitting, pre-split the input yourself before calling `encode`.

## API

### `needsEncoding(str)`

Returns `true` if `str` contains any character outside the printable ASCII range (0x20–0x7E), otherwise `false`. Throws `TypeError` if `str` is not a string.

### `encodeWord(str, charset = 'UTF-8')`

Encodes `str` as a single RFC 2047 encoded-word using Base64. The `charset` label is placed in the encoded-word; the bytes are always UTF-8. Throws `TypeError` for non-string input or an empty charset.

### `encode(str, charset = 'UTF-8')`

Returns `str` unchanged if it needs no encoding. Otherwise returns one or more encoded-words joined by spaces, splitting so that no encoded-word exceeds 75 characters. Throws `TypeError` for non-string input, and `RangeError` if the charset name is too long to fit within the 75-character limit.
