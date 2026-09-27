# Ask and upload continuity release verification — 27 September 2026

## Scope

Programme purpose, reviewed replacement/amendment relationships, complete BOQ revision continuity, separate phase programme authority, and deterministic-first project Ask. The separate infrastructure portability work in the original working checkout is not included in this release.

## Browser observations

The deployed review build `c2c82164d8f783f5874b762f404101f8428e3249` was exercised through the application, with synthetic files uploaded using the file chooser:

- Upload without programme purpose was blocked with an explicit instruction.
- A first update remained a candidate. The dashboard exposed adoption; adoption established the whole-project Data Date of 2036-08-31.
- A Phase 2 update dated 2037-03-31 remained separate, was adopted through its phase panel, and did not advance the whole-project date. Ask returned the phase date in its own row.
- Original BOQ: 100 units × AED 10 = AED 1,000. A complete renamed revision replaced it with 120 units × AED 10 = AED 1,200. The refreshed Ask result contained one current item and the revised total.
- CPI: EV AED 720 / AC AED 900 = 0.80. The browser displayed both operands, reporting date and ratio basis. The downloaded JSON recorded `route: deterministic_fact`, `providerStatus: not_needed`, `aiInvoked: false` and an empty model-call list.
- Switching to a separate empty project produced unavailable CPI/EV/AC instead of reusing the populated project's result.
- The desktop Ask screen, project navigation, reporting basis and download controls were visually inspected.

Two display defects found in this browser pass were corrected before release: completed schedule uploads could retain a receiving/0% progress message, and an empty cost position could say snapshots were available. Regression assertions cover terminal progress after successful/failed persistence, late poll responses and the empty cost explanation.

## Automated verification

The 792-test suite covers source replacement, exact BOQ identity, phase adoption/restart, independent projects, stale decisions, add/replace/withdraw evidence, retained exports, model routing and evidence validation. It also retains the prior OCR containment, streaming snapshot and failed-save recovery checks. GitHub Verify and Scale Certification results are attached to the release commit.

The unchanged local five-second release gate passed after deferring PDF initialization during schedule-only work and avoiding needless snapshot rewrites: cold opening 4,899.2 ms; a fresh 20,000-activity upload to calculated dashboard 3,362.9 ms. Cold-open margin is narrow; this is a benchmark observation, not an unrestricted capacity guarantee.

## Limits

No paid model provider is configured on the live services. Local routes and model transport, budgets, validation and failure behavior are tested; no real-provider semantic acceptance is claimed. Phase commercial/Delivery metrics and automatic consolidated phase roll-ups remain explicitly unavailable without their own governed scope mapping. The desktop browser pass does not establish mobile responsiveness, additional real-client PDF corpus quality, Arabic scan quality or unrestricted multi-project storage capacity. Passing these checks is not proof that no possible defect exists.
