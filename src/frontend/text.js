// Text normalisation shared by the ETL and the reader.
//
// The web register was imported from Jira with a Unicode encoding bug: UTF-8
// bytes were decoded as Windows-1252, so smart quotes, dashes, £, bullets, etc.
// arrive as mojibake ("â€™", "Â£", "â€"). fixMojibake reverses that exactly by
// re-reading each character's UTF-8 bytes as CP1252 — the inverse of how the
// import mangled them. It is a no-op on clean text (returns the input unless it
// contains the tell-tale â/Â/Ã bytes).

// Windows-1252 byte -> Unicode code point, for the 0x80–0x9F range that differs
// from Latin-1 (everything else maps to itself).
const CP1252 = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178,
};
const cp1252 = (bytes) => bytes.map((b) => String.fromCodePoint(CP1252[b] ?? b)).join('');

// Build the mojibake→correct map by re-mangling each target char the same way
// the import did: UTF-8 encode it, then read those bytes back as CP1252.
const TARGETS = ['‘', '’', '“', '”', '–', '—', '…', '•', '●', '£', '€', '™', '®', '©', ' ', ' ', '​'];
const MAP = TARGETS.map((c) => [cp1252([...Buffer.from(c, 'utf8')]), c]);
MAP.push(['â€', '”']); // orphaned close double-quote — the import dropped its 3rd byte
MAP.push(['Â', '']);    // stray Â left by a mangled non-breaking space
MAP.sort((a, b) => b[0].length - a[0].length); // longest match first

export function fixMojibake(s) {
  if (typeof s !== 'string' || !/[âÂÃ]/.test(s)) return s;
  for (const [moji, ch] of MAP) s = s.split(moji).join(ch);
  return s;
}
