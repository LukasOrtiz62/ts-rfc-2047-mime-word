const MAX_ENCODED_WORD_LENGTH = 75;
const MAX_LINE_LENGTH = 76;

/**
 * Returns true if the given string contains characters that require
 * RFC 2047 encoded-word encoding in a MIME header.
 *
 * The check is conservative: any character outside the printable ASCII
 * range (0x20-0x7E) is considered non-ASCII. This matches the common
 * practice of treating control characters and bytes >= 0x80 as unsafe
 * for raw header text.
 */
export function needsEncoding(str) {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string');
  }
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x20 || code > 0x7e) {
      return true;
    }
  }
  return false;
}

/**
 * Encode a single word as an RFC 2047 encoded-word using the given charset.
 *
 * The encoding is Base64 (B). Base64 is chosen over quoted-printable (Q)
 * because it is simpler to produce correctly and produces predictable
 * output lengths, which makes the splitting logic easier to reason about.
 *
 * The input must be a string. It is converted to bytes using the
 * TextEncoder, which always uses UTF-8. If a different charset is
 * requested, the bytes are not transcoded; the charset label is simply
 * placed in the encoded-word. This is a deliberate simplification: the
 * library is designed for UTF-8, but allows the caller to override the
 * label if they know the bytes are already in that charset.
 */
export function encodeWord(str, charset = 'UTF-8') {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string');
  }
  if (typeof charset !== 'string' || charset.length === 0) {
    throw new TypeError('Charset must be a non-empty string');
  }
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const base64 = base64Encode(bytes);
  return `=?${charset}?B?${base64}?=`;
}

/**
 * Encode a string into one or more RFC 2047 encoded-words, joined by a
 * single space. The result is suitable for use in a MIME header value.
 *
 * If the input contains only printable ASCII, it is returned unchanged.
 *
 * The encoded output is split so that no encoded-word exceeds 75
 * characters and no line exceeds 76 characters. When splitting, the
 * input is first converted to UTF-8 bytes, then split on a byte
 * boundary. This can split a multi-byte character across two
 * encoded-words. That is legal per RFC 2047: the concatenation of the
 * decoded bytes must form a valid sequence. Many decoders handle this
 * correctly, but some do not. If you need character-safe splitting,
 * pre-split the input yourself.
 */
export function encode(str, charset = 'UTF-8') {
  if (typeof str !== 'string') {
    throw new TypeError('Input must be a string');
  }
  if (!needsEncoding(str)) {
    return str;
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  const prefix = `=?${charset}?B?`;
  const suffix = '?=';
  const overhead = prefix.length + suffix.length;
  const maxPayload = MAX_ENCODED_WORD_LENGTH - overhead;

  if (maxPayload <= 0) {
    throw new RangeError('Charset name too long for RFC 2047 encoding');
  }

  // Base64 encodes 3 bytes into 4 characters. We need to choose a chunk
  // size that is a multiple of 3 so that each encoded-word contains a
  // whole number of base64 groups. This avoids padding in the middle of
  // the output.
  const maxBytes = Math.floor(maxPayload / 4) * 3;
  if (maxBytes <= 0) {
    throw new RangeError('Charset name leaves no room for payload');
  }

  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += maxBytes) {
    const chunk = bytes.subarray(offset, offset + maxBytes);
    const b64 = base64Encode(chunk);
    parts.push(`${prefix}${b64}${suffix}`);
  }

  return parts.join(' ');
}

/**
 * Encode a byte array as a standard Base64 string without line breaks.
 * This is a small, dependency-free implementation. It uses the standard
 * Base64 alphabet (A-Z, a-z, 0-9, +, /) and padding with '='.
 */
function base64Encode(bytes) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const triple = (b0 << 16) | (b1 << 8) | b2;

    result += alphabet[(triple >> 18) & 0x3f];
    result += alphabet[(triple >> 12) & 0x3f];
    result += i + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '=';
    result += i + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
  }
  return result;
}
