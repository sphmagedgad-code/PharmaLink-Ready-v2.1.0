# PharmaLink Ready 2 — v2.0.3 QA Report

## Scope
Focused correction to classification context, Egyptian sender-phone extraction, and commercial medicine search. UI assets/layout and IndexedDB schema were not changed.

## Regression results
Input file: supplied WhatsApp export (`دردشة في واتساب مع عالم الادويه .txt`). Reconstructed 1,829 logical messages.

- 760 messages classified as actionable (399 overall buy-context, 361 overall sell-context).
- 5,419 per-medicine buy assignments and 7,251 per-medicine sell assignments after occurrence-level context resolution.
- 92 messages contained both buy and sell medicine contexts.
- 555 Egyptian mobile sender numbers extracted from headers after separator normalization.
- Nexavar / نيكسفار: 4 buy assignments and 10 sell assignments.

## Test cases
- Offer section followed by request section in one message.
- Same medicine repeated in both sections; both contexts retained.
- Arabic-Indic digits in medicine strength.
- Latin brand names directly followed by strength digits.
- Egyptian phone numbers in compact, spaced, and dashed formats.
- Syntax check across all source `.js` files and `service-worker.js`.

All automated checks passed in the local test environment.

## Accuracy statement
100% accuracy cannot be substantiated from an unlabeled WhatsApp export. Parser totals are not accuracy percentages. Unrecognized/ambiguous medicine names and omitted strengths/prices still need review. A labelled benchmark and browser/IndexedDB acceptance run on the actual target devices are required before production certification.
