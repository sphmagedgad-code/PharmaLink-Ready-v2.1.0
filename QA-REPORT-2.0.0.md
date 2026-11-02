# PharmaLink Ready 2 — v2.0.0 Candidate QA Report

## Release scope
A focused engine hardening release based on the existing Ready 2 source tree. The UI layout and database schema version remain unchanged. This is a candidate build, not a claim of production acceptance.

## Implemented changes
- Canonical medicine-strength normalization for Arabic/English digits and common Arabic/English units (e.g. `٢٠ مجم` and `20 mg` -> `20mg`). Missing units are not silently equated with explicit units.
- Strength extraction normalizes Arabic digits even when called directly, not only through the import pipeline.
- Buyer-to-seller matching compares canonical strengths; when a buyer specifies a strength, offers with a different or unknown strength are excluded.
- Search-side buyer cards use the same requested-strength constraint when checking seller availability.
- Opportunity deduplication uses canonical strength, preserving separate strengths while merging equivalent spellings.
- Urgent buyer requests are placed ahead of non-urgent opportunities; within each urgency tier, confirmed lower seller price ranks first, then request freshness.
- Imported medicine mentions now carry evidence metadata. Dictionary-confirmed names are marked `dictionary`; other extracted names are marked `unverified` and shown with a review warning in search. This is deliberately conservative and does not claim unknown drug names are verified.
- Search result HTML escapes imported names, phone numbers, message text, and other dynamic values to prevent stored HTML/script injection from WhatsApp content.
- Service-worker cache version bumped so the new source bundle is not hidden behind the prior cache.
- App version set to 2.0.0. IndexedDB schema version remains 2 because no store/index migration was introduced.

## Full WhatsApp export parser audit
Input: supplied WhatsApp export, 34,493 lines, 1,829 reconstructed logical messages.

| Metric | v1.0.29 | v2.0.0 candidate |
|---|---:|---:|
| Classified messages | 758 | 758 |
| Buy messages | 341 | 341 |
| Sell messages | 417 | 417 |
| Extracted medicine mentions | 12,368 | 12,368 |
| Distinct extracted name strings | 2,015 | 2,015 |
| Urgent messages | 157 | 157 |
| Mentions marked unverified | n/a | 10,553 |

The same extraction counts are expected: this release targets strength identity, matching safety, review visibility, search rendering safety, and opportunity ordering rather than adding a broad name-extraction heuristic. The 10,553 unverified mentions are **not confirmed medicine names**; they need curation or human review. These counts are not precision/recall or accuracy percentages because the full export has no human-labelled ground truth.

## Automated checks
- Full source JavaScript syntax check passed (`node --check` for every `src/**/*.js` file and `service-worker.js`).
- Full supplied TXT reconstruction/classification audit completed without parser errors.
- Strength normalization checks passed for Arabic/English digits and units, including keeping unitless values distinct from explicit `mg` values.
- Classifier smoke checks passed for Arabic Prozac, English Prozac, Mounjaro, Prograf, and an unknown marked candidate being flagged unverified.
- ZIP integrity check performed at packaging.

## Not verified here
- Real-browser IndexedDB import, repeated import, restart/reopen, and offline behavior.
- Android Realme C12 and Windows laptop UI acceptance.
- Full human review of all extracted names or measured precision/recall.
- Manufacturer, INN, country-of-origin enrichment.
- Supplier response-speed and seriousness ranking.

## Safe deployment
Keep the current deployment and its IndexedDB data untouched. Deploy this candidate to a separate GitHub test repository and use a backup before importing test data. Do not describe this release as 100% accurate or production-approved until device/browser acceptance and a labelled extraction benchmark pass.
