# PharmaLink Ready 2 — v2.1.0 Professional Engine

## Scope
This release upgrades the existing Ready 2 engine. The visual structure, navigation, colors, typography, RTL layout, and IndexedDB schema are intentionally unchanged.

## Implemented
1. **Faster, observable TXT import**
   - File-reading progress is shown before parsing begins.
   - Analysis progress is split into classification, database preparation, entity linking, and saving/indexing stages.
   - The final import result reports elapsed processing time measured by the UI from file reading through persistence.
   - Existing bulk writes and bounded search-index batches from v2.0.4 are retained.
2. **More reliable request/offer classification**
   - Buyer messages containing a price phrase (for example, `مطلوب ... بسعر ...`) remain requests; `بسعر` is no longer treated as a sell signal.
   - The message-level status follows extracted medicine contexts, reducing false offer labels in mixed-language/price text.
   - Common Arabic/English request and availability phrases were expanded.
3. **Stronger medicine extraction**
   - Expanded Egyptian high-frequency brand/generic dictionary and curated Arabic/English aliases.
   - Normalized Arabic spelling variants and stricter Latin word matching.
   - Strength extraction supports Arabic digits, attached strengths, fractions, and percentage concentrations.
   - Price parsing supports EGP/LE and common Egyptian Arabic currency forms, including comma/decimal formatting.
   - Quantity parsing supports more common pack/unit words.
4. **More efficient commercial matching**
   - Seller contacts are loaded once per opportunity scan and reused across medicine matches instead of re-reading the seller store for each medicine.
   - Existing price-first, recency-aware ranking and explicit separation of quoted versus estimated prices are retained.

## Data safety
- No IndexedDB schema migration.
- No automatic deletion or reset of existing medicines, contacts, deals, or imported messages.
- Existing records remain in place; new imports continue to deduplicate by source group, timestamp, and message text.
- Price estimates are not converted into confirmed seller offers.
- No deal is created or confirmed automatically.

## Versioning
- App version: `2.1.0`
- Service worker cache: `v2.1.0-professional-engine`
