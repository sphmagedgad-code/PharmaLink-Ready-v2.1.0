# PharmaLink Ready 2 — v1.0.29 QA Report

## Scope
This build applies targeted corrections to the existing Ready 2 codebase. It does not redesign the UI or replace the storage architecture.

## Changes
- Medicine mentions that are explicitly curated aliases now collapse to one canonical medicine identity within a message (for example, Arabic and English Prozac in the same message no longer create duplicate mention rows).
- Structural-marker extraction rejects common English stock/offer boilerplate such as `Items Available` instead of treating it as a medicine name.
- Fixed literal backspace characters in fallback noise regex word-boundary checks; these checks now use actual regex word boundaries.
- Search result deduplication now distinguishes medicine and strength, so one contact's request/offer for one medicine no longer hides that contact's other medicine rows.
- Parsed WhatsApp search results rank confirmed lower prices first, then newer source messages; no-price records do not outrank confirmed prices.
- Supplier matching now chooses the lowest explicit price per seller, then the newest evidence for equal/no-price offers.
- Opportunity deduplication includes strength, so separate strengths from the same buyer are retained.
- Version metadata updated to 1.0.29.

## Full WhatsApp TXT classifier audit
Input: the supplied WhatsApp export file (34,493 text lines; 1,829 reconstructed logical messages).

| Metric | v1.0.28 baseline | v1.0.29 |
|---|---:|---:|
| Classified messages | 761 | 758 |
| Buy messages | 344 | 341 |
| Sell messages | 417 | 417 |
| Extracted medicine mentions | 13,390 | 12,368 |
| Distinct extracted name strings | 2,104 | 2,015 |
| Messages marked urgent | 158 | 157 |
| Messages with body phone detected | 70 | 70 |
| Messages with currency-formatted price detected | 121 | 121 |

The lower mention count is partly expected because duplicate aliases and obvious boilerplate are collapsed/rejected. These are parser output counts, **not accuracy percentages**. No complete human-labelled ground-truth dataset exists, so precision/recall cannot honestly be calculated from this export alone.

## Automated checks performed
- JavaScript syntax check across application source files.
- Full-file TXT classifier run against the supplied export.
- Smoke checks for Arabic/English Prozac alias collapse and strength extraction.
- ZIP archive integrity check.

## Not yet verified in this environment
- Real browser IndexedDB import, repeated import, restart/reopen, and offline operation.
- Full end-to-end UI interaction on Android Realme C12 and Windows laptop.
- Every extracted name manually labelled against the full WhatsApp export.
- Supplier response-speed ranking and seriousness scoring; these are not claimed as implemented.
- Manufacturer, INN, and country-of-origin enrichment; these are not claimed as implemented.

## Safe-use note
Keep the current production data and existing deployment untouched until the new build is tested in a separate GitHub repository and a backup has been made. Ambiguous or unlabelled source data must be reviewed rather than treated as verified facts.
