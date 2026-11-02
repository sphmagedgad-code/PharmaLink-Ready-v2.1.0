# PharmaLink Ready 2 — v2.0.2

## Fixes driven by the supplied WhatsApp screenshots and TXT export
- Parsed buyer/seller medicine mentions are retained even when the TXT export contains no phone number; the original sender display name and source message are preserved.
- Search request/offer filters can now find these parsed records because they are no longer discarded solely for missing phone data.
- Search results show the available phone number beside each parsed result; if the export contains no number, the UI states that explicitly instead of fabricating one.
- Search result raw-message cards show sender display name and phone when present.
- Search-index rows are written in bulk per batch rather than opening a read/write transaction for every individual message/entity.
- Contact lookups are cached within an import batch, with role upgrades preserved.
- Added confirmed Nexavar / نيكسفار aliases so Arabic and English searches resolve to the same medicine identity.

## Important data limitation
WhatsApp TXT exports may contain a sender display name but no phone number. The app cannot reconstruct a missing phone from the TXT alone; it now preserves the request instead of silently dropping it and clearly labels the missing number.

## Validation
- JavaScript syntax checks passed.
- Full TXT reconstruction: 1,829 messages; classifier: 758 actionable messages (341 buy, 417 sell).
- 186 actionable messages had no phone in either sender header or message body; these are now retained as searchable parsed entities with no fabricated phone.
- Nexavar was found in the supplied file as a buyer request alongside Praluent and Fludara.
- Browser/IndexedDB end-to-end testing is still required before production sign-off.
