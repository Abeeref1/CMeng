# 16 October 2026 — T07 independent certificate and notice Gregorian integrity

Exact remote parent HEAD: `6af4a8ca18b409af3b4ab2892c6acdc8a703c583`.

Existing T07 independent commercial integrity used lexical date ordering to accept impossible certificate issue/forecast dates, and `Date.parse` to accept impossible notice-issue dates that JavaScript silently rolls into the next month (e.g. 2032-02-30 → 2032-03-01). That let a downstream commercial consistency check pass even when the corresponding source-reading/date check did not. The shared integrity checker now applies the existing strict Gregorian reader to both certificate and reporting Data Dates and to all notice-issue evidence; valid leap days, time-stamped source days, retained totals, source rows and complete source populations are preserved. Missing/invalid dates cannot falsely qualify current/future certificate position or clear a notice gap.

Independent additive test proves malformed leap/non-leap source days, invalid Data Date, valid dated certificates, true future rows, retained SHA-independent source immutability, valid notice timestamp, false-zero detection and full source ID/population parity. Registered with the existing supplementary focused Actions; original six groups, 39 owner rules, 23-project original guard, 5,000ms four-cold gate and all owner ten-item finish conditions are unchanged.

This is a partial T07 source-backed correction, NOT T07 closure or approval of contractual entitlements, payment, cash or EOT. Exact new-HEAD CI, source-screen-Ask-export proof, original 23-project guard, owner acceptance and final single candidate remain pending. No deployment, partial release, authentication, role administration or paid AI tests.
