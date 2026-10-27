# T03: optional AI reading, status at release

Owner decision (kept): no paid AI calls. The one controlled real-provider AI test in the plan's T03 acceptance ("one controlled real AI test passes within the cap") is **excluded and not run**. Nothing in this release was tested against a real AI provider.

## What is tested without a provider

- AI steps are optional. With no provider set up, or without owner permission, every reading uses the rule-based readers and the page says which step was not run (guard R5: zero on the test service).
- The call cap, the per-step AI status, error states and the audit of each step are tested with a stub provider: `tests/t03-ai-completion.test.ts`, `tests/t03-ai-error-states.test.ts`, `tests/t03-ai-reading-controls.test.ts`, `tests/t03-contract-ai-call-cap.test.ts`, `tests/t03-r5-workbook-ai-steps.test.ts`, `tests/t03-semantic-ai-step-audit.test.ts`, `tests/evidence-semantic-ai.test.ts`, `tests/xer-ai-reconciliation.test.ts`.
- AI never adopts a fact: an AI reading is a candidate with its source span, under the same review and adoption rules as a rule-based reading.

## Optional capabilities not tested with a real provider

| Capability | Code | Without a provider |
| --- | --- | --- |
| Contract heading reading on exact source spans (PDF, Word, `.txt`, `.md`) | `configuredContractHeadingAiResolver` (`evidence-semantic-ai.ts`), used by the one contract text reader | Rule-based clause segmentation; the reading record says "AI heading reading was not requested". |
| Table meaning for unfamiliar register columns | `configuredTableSemanticAiResolver`, `assessTableSemanticAiProposal` | Column remains unused and is listed (guard R1); the user can confirm the column meaning. |
| Provider probe on start | `ai-provider-probe.ts` (`CMENG_AI_PROBE_ON_START=1`) | Not run; no call is made. |
| Ask answers from a provider | Ask AI configuration (`CMENG_ASK_AI_CONFIG_FILE`) | Ask answers come from the shared project facts only. |

To test any of these later: set up a provider with a spending cap, give owner permission in the app, and run the T03 controlled test on a test project only.
