# PharmaLink Ready 2 — v2.0.3 (engine correction build)

## Implemented
- Kept the Ready 2 UI, navigation, styling, IndexedDB schema, and offline/PWA structure unchanged.
- Classifies each occurrence of a medicine against the nearest preceding buy/sell cue. If the same medicine appears in both the offer and request sections of one WhatsApp message, both sides are persisted as separate parsed entities instead of one side overwriting the other.
- Handles Latin medicine names immediately followed by a strength number (for example `Nexavar200 mg`).
- Extracts Egyptian mobile numbers even when the WhatsApp sender header formats them with spaces, dashes, parentheses, or `+20`; normalized output is `01xxxxxxxxx`.
- Commercial search resolves the longest exact medicine-name prefix before interpreting a trailing numeric strength, so multi-word medicine names and searches such as `Nexavar 200 mg` can retrieve their parsed buyer/seller entities directly through IndexedDB indexes. Known conflicting strengths are excluded; missing strengths remain visibly unverified rather than being guessed.
- Kept the staged 0–100% import progress reporting and bumped the service-worker cache key for this corrected build.

## Validation against the supplied WhatsApp TXT
Input: 1,829 reconstructed logical messages.

| Measurement | Result |
|---|---:|
| Actionable messages classified | 760 |
| Messages whose overall leading context is buy | 399 |
| Messages whose overall leading context is sell | 361 |
| Per-medicine buy assignments | 5,419 |
| Per-medicine sell assignments | 7,251 |
| Messages containing both buy and sell medicine contexts | 92 |
| Egyptian sender phone numbers extracted from headers | 555 |
| Nexavar / نيكسفار buy assignments | 4 |
| Nexavar / نيكسفار sell assignments | 10 |

The counts above are parser-audit counts, not a precision/recall score: the export has no human-labelled ground-truth dataset.

## Automated checks
- Regression test passed for mixed offer/request sections, same medicine repeated on both sides, Arabic-Indic strength digits, Latin aliases attached to strength digits, and formatted Egyptian mobile numbers.
- `node --check` passed for all source JavaScript files and the service worker.
- Full 1,829-message TXT audit completed; no parser exception.
- ZIP integrity checked after packaging.

## Not claimed / still requires device acceptance
- This build is not certified as 100% accurate. Unknown medicine names, ambiguous shorthand, missing prices, and strength omitted from source messages cannot be verified automatically.
- Browser/IndexedDB end-to-end import, repeated import, restart/reopen, and offline behavior still require acceptance testing on the target Android browser and Windows laptop.
- No database schema migration was introduced; existing user data is not intentionally cleared or rewritten by this code change.
