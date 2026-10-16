# 16 October 2026 — T08 strict full source timestamp validation

Exact parent HEAD: `5c2d89bf987266af0bbaa5b24d1ad866bd49f3eb`.

The original shared procurement timing engine accepted the first ten characters of any source text beginning `YYYY-MM-DDT` or `YYYY-MM-DD `, even when the time, zone or trailing text was invalid. A malformed required-on-site date could therefore become a confirmed need/overdue date, and malformed reporting timestamps could make physical delivery appear established at a non-existent Data Date. Changed only the shared date reader to require a valid complete ISO date or timestamp before its existing Gregorian date verification; good leap days, real source datetime offsets, original physical-delivery status, source precedence, dates, decisions and register rows remain unchanged. A malformed date stays unresolved, never zero or an assumed receipt.

Independent extended T08 tests reject malformed timestamp suffixes, impossible hours/minutes/zones, distinguish undetermined due and cutoff from confirmed positions, preserve full raw source input, and verify valid timestamp parity. Existing focused and full six-group pipelines keep their original checks and the exact four-cold <=5,000ms gate. Owner finish list T01–T12, 23-project original guard and stages remain open; no T08 acceptance, deployment, AI spend or access modifications.
