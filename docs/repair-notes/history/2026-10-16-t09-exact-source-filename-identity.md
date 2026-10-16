# 16 October 2026 — T09 exact document identity in action filenames

Exact parent branch HEAD: `979872985f3f8d4406c41d31d37a30d919607792`.

Original matter-action missing-field labels used `ref.includes(documentId)`. A retained source ref for document DOC-011 would therefore also list unrelated DOC-01 as its original file; foreign reference text could likewise produce a false project document label. Correction uses the same exact project-owned source-reference resolver as the source-evidence link, so the direct-fix filename and SHA-bound evidence location agree. All original findings, affected pages, source bytes, registers, user decisions and formal authority are unchanged.

Independent additive regression extends the original T09 suite: prefix-colliding document IDs, foreign references containing a valid substring, exact file deduplication across pages, different projects with the same local document ID, source SHA and physical locator, input immutability. The existing focused workflow already includes that suite; owner guard, original test rules and five-second cold speed gate are untouched.

Source, test and this dated history note are saved together; until complete exact-commit CI, independent page/Ask/export evidence, all 23-project guard and the original ten-item finish list pass, this is partial engineering, not T09 acceptance or a deployable candidate. No deployment, new plan, role/auth work or paid AI.
