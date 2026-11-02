# PharmaLink Ready 2 — v2.0.4 Fast TXT Import

## Import performance changes
- Replaced per-medicine and per-contact IndexedDB lookups/writes during import with one-time in-memory maps and chunked bulk persistence.
- Added the missing `searchIndexRepo.indexEntitiesBulk` implementation used by all bulk import repositories.
- Bulk search indexing now streams bounded chunks (up to 4,000 rows per transaction) rather than constructing one unbounded write transaction.
- Parsed-entity indexing no longer duplicates the entire WhatsApp source message for every medicine mention. Full source text remains stored on the parsed entity and is indexed once through the original WhatsApp message record.
- Increased raw WhatsApp message keyword indexing from 12 to 40 tokens to preserve broad message search while avoiding duplicate indexing for every medicine mention.
- Increased import write batches from 200 to 500 records.
- Removed expensive opportunity matching from the import completion screen; opportunity matching remains available in the Opportunities area and is not allowed to hold TXT import completion open.
- Progress updates are emitted during classification, linking, and persistence.

## Compatibility
- No IndexedDB schema migration.
- Existing database records are preserved.
- Ready 2 layout and navigation are unchanged.
