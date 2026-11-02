# PharmaLink Ready 2 v1.0.29

This is a focused engine correction release based on the existing Ready 2 source.

- Keeps the existing UI and project structure.
- Fixes alias duplication and common structural-marker false positives.
- Fixes search result hiding across different medicines/strengths from the same phone.
- Prioritizes explicit lower offer prices, then freshness.
- Keeps opportunity requests separate by strength.

See `QA-REPORT-1.0.29.md` for measured results and limitations. This build has not yet passed device/browser end-to-end acceptance and should first be deployed to a separate test repository.
