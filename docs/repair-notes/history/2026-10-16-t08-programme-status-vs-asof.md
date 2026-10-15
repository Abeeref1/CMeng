# 16 October 2026 — T08 source status versus Data Date

Exact source parent: 8e89648fa56414f46ec3654afeb283309e6f8f5c.

The full-source programme handover comparison incorrectly replaced the actual source-completed numerator with the subset whose actual finish date was verified before the Data Date. This reported zero for a genuinely completed source task with a missing/future actual finish, despite retaining its status. The unmodified real-ingestion test in delivery-authority.test.ts detected this in exact-head mandatory regression CI run 38813931678.

The shared handover-source-review engine now separately publishes the original reported source-completed count and the date-qualified completed count; the as-of percentage stays null where coverage is incomplete. The comparison basis states which is which. Existing asset flags, source records, denominators, source provenance, formal acceptance and saved choices are unchanged. Two independent date-oracle tests check future, missing, completed and unknown values, genuine zero and untouched source rows. All original tests and owner guards remain intact.

Engineering only: T08 and the other nine owner finish-list items are not yet certified. Exact-commit checks, all six groups, original full current-head 23-project guard, full source/screen/Ask/download identity, three unchanged four-cold under-five-second tests including no warmup, blind challenges and seven-stage acceptance are outstanding. No deployment, merge, paid AI, authentication or role gates.
