# PharmaLink Ready 2 — v2.1.0 QA Report

## Automated checks
- `node --check` across every `.js` and `.mjs` file: PASS.
- WhatsApp context and extraction regression suite: PASS.
- ZIP integrity check: PASS.
- No IndexedDB schema changes: verified by source diff.

## Real WhatsApp TXT parse/classification benchmark
Input: `دردشة في واتساب مع عالم الادويه .txt`
- File size: 1,347,612 bytes on disk (UTF-8 input; normalized in benchmark).
- Lines: 34,493.
- Reconstructed logical messages: 1,829.
- Actionable classified messages: 776.
- Medicine mentions: 12,868.
- Classified message-level BUY: 404.
- Classified message-level SELL: 372.
- Urgent classified messages: 157.
- Read + reconstruct + classify elapsed on this test host: 9.2 seconds (single measured run after optimization).

These are engine output counts, not a human-annotated accuracy score. The benchmark does not prove that every extracted medicine is correct; unknown/marker-derived candidates remain marked for review.

## Regression coverage
- Mixed buy/sell sections in one message.
- Same medicine appearing on both sides of one message.
- Arabic-Indic digits in strengths.
- Egyptian mobile phone formats.
- Buyer request containing `بسعر` remains BUY/REQUEST.
- Arabic and English medicine aliases (including Targocid, Clexane, and Human Albumin).
- Egyptian currency formats and decimal prices.
- Attached/Arabic-digit medicine strengths.

## Important production acceptance boundary
The full browser IndexedDB import (read + parse + link + write + search-index persistence) has **not** been successfully timed on the target Realme C12 or Windows 7 laptop in this environment. Therefore the strict end-to-end target of under 5 minutes is **not certified** by this report. The UI now displays the actual elapsed time for each completed import on the user's device. Do not treat the 9.2-second parser benchmark as the full import time.

## Release status
This is a validated engine release candidate with passing static/regression checks. Final production acceptance for the under-5-minute requirement requires one complete real import on the target device and verification that the resulting medicine/contact/search counts are correct.
