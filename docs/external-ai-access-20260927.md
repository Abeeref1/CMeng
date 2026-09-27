# Two interfaces over CMeng project authorities

Built-in **Ask CMeng** remains part of every project. Facts, arithmetic, dates,
counts, filters, rankings and exports run locally. Interpretation/composition
may use the configured provider only after CMeng has produced and validated its
controlled facts and evidence coverage. The existing bounded evidence and
model-output validation remain in place.

**External AI Access** is a separate read-only service. MCP and structured REST
adapters call the same service and the same project authorities. The external
worker constructs its Ask engine with a null model; it never calls the built-in
provider. The user's external assistant does its own interpretation. Disabling
external access does not disable a configured built-in provider.

## Deployment configuration

Run `npm start` (the project gateway). Existing project snapshots, source files,
and project control logic are unchanged. No customer migration or automatic
programme adoption occurs. The default local storage root contains a separate
`external-ai/` directory for connection controls, bounded analysis sessions and
metadata-only daily audit logs. This root needs persistent storage on every host.
The current implementation requires one gateway writer for this control directory;
sharing it between concurrent gateway replicas is not supported.

Set either `CMENG_EXTERNAL_POLICY_FILE` to a mounted JSON file or
`CMENG_EXTERNAL_POLICY_JSON` to the same policy. Policy is re-read for each access
check. Disabling a user, project or connection therefore closes subsequent
requests, including retained analyses. Failures loading policy fail closed.

The policy types and customer/audit limits are in
`packages/external-intelligence/src/types.ts`. Its structure is:

```json
{
  "schemaVersion": 1,
  "enabled": true,
  "publicOrigin": "https://cmeng.example",
  "workspaceId": "customer-workspace",
  "identity": {
    "issuer": "customer-identity",
    "audience": "cmeng",
    "publicKeyPem": "REPLACE_WITH_RS256_PUBLIC_KEY",
    "cookieName": "cmeng_identity"
  },
  "users": [{
    "id": "owner",
    "workspaceId": "customer-workspace",
    "enabled": true,
    "externalAdmin": true,
    "allowAudit": true,
    "projects": {"PROJECT-CODE": ["schedule", "boq", "delivery", "commercial", "claims", "evidence"]}
  }],
  "projects": {"PROJECT-CODE": {"enabled": true, "domains": ["schedule", "boq", "delivery", "commercial", "claims", "evidence"]}},
  "clients": [],
  "registrationRedirectOrigins": ["https://chatgpt.com"]
}
```

For private owner setup without changing the current application sign-in, policy
can additionally specify `ownerActivation: {userId, hash, expiresAt}`; `hash` is
the SHA-256 digest of a cryptographically random 32-byte base64url token. Only the
owner receives `https://cmeng.example/external-ai/activate#TOKEN`. The browser
removes the fragment before submitting it, and the token is single-use. Successful
activation creates a private, HttpOnly owner cookie valid for seven days.
Renewal requires issuing another activation link or the configured verified
identity session. Tokens, private keys and real policies must not be committed.

This private owner setup does **not** change the existing public application's
identity model or establish customer-wide access control. Before a customer
release, deployment authentication must protect the ordinary CMeng routes too.
It also does not establish GCC residency: host storage and selected AI endpoints
must satisfy the customer's actual location requirements.

## Built-in paid provider setup

After owner activation, open `/settings/ask-ai`. The form accepts the owner's
OpenAI API key and one of `gpt-5-mini`, `gpt-5`, `gpt-4.1-mini`, `gpt-4.1`. No GPT-6
choice or automatic upgrade is offered. The key is stored with filesystem mode
0600 at `CMENG_ASK_AI_CONFIG_FILE` (default `ask-ai-provider.json` in the storage
root); it is never returned to the browser or logged. Blank input keeps the key.
Saving does not make a paid validation request. The first interpretation request
reports any provider failure while retaining its deterministic facts.

In this private managed mode, only the activated owner browser can spend the key.
The gateway replaces client-supplied paid-AI headers. Deterministic Ask remains
available normally. Unreadable model settings close paid access without breaking
local calculations and can be repaired by re-entering the key. This setup uses
an API account, separate from the external assistant connection and subscription.

Existing operator-managed `CMENG_ASK_AI_*` environment configuration remains
available for provider-neutral compatible endpoints. Do not expose a standalone
project worker: the gateway is the public entry point. Do not combine public
anonymous access with an unprotected, deployment-wide paid provider.

## External connection and queries

Open `/external-ai`, add its connection address in the external assistant, and
approve the exact projects on CMeng's consent page. The OAuth flow uses exact
registered HTTPS callbacks, S256 PKCE, single-use authorization codes, resource
binding, short-lived access tokens and rotating refresh tokens. Public dynamic
registration is restricted to configured callback origins; it never fetches
arbitrary registration URLs. Current MCP transport is stateless Streamable HTTP.

`POST /external-ai/api/<capability>` exposes the same service with the same bearer
token, scope checks, policy and response. Capabilities cover project state,
metrics, scoped analysis/ranking, retained related links, traces, bounded source
passages, selected evidence batches and freshness checks. No SQL, raw pagination,
file enumeration, upload, approval, adoption or write capability exists.

Before retrieval the service intersects user, connection and project domains.
Authority dependencies are checked before calculation. Authorizations are checked
again after awaited work. Any changed project version invalidates retained
analysis; a prior answer is never silently relabelled as current. Domain version
receipts explicitly use the project version; independently versioned domains
and domain-change deltas are not fabricated.

Customer and audit profiles have separate configurable request, record, byte,
concurrency, rank, retrieval and expiry bounds. Audit requires explicit policy
permission. Request and disclosure use accumulate per user/workspace/project
across connections and sessions. Repeated related questions reuse unchanged
facts and session budgets. Every requested rank and material exception must fit
the full session; response batching preserves complete selected evidence.
Oversized populations produce a disclosed refusal, never an undisclosed top-k.

The public authority descriptor snapshot is checked against the runtime catalogue
in tests. When an authority changes, regenerate this metadata from
`externalCatalogue` and review its domain requirements. Unknown dependencies
remain restricted to all domains until reviewed.

## Project actions

`/api/projects/:id/actions` combines programme/phase confirmations, pending
non-schedule document relationships, Delivery register/population reviews and
source correction requests. System failures remain separate. The page exposes
the real next action and a current count; it refreshes after mutations, project
changes and browser focus. Programme confirmation validates the project version
and calls the existing adoption authority. A phase decision cannot replace the
whole-project programme. Earlier unresolved candidates remain pending.

## Acceptance scope

Automated checks exercise actual isolated project workers, native/external CPI
parity, complete Top 20 ordering, bounded 45-item delivery, restart retention,
project/domain isolation, replay, revocation during work, token expiry,
concurrency, owner setup, model-choice rejection and deterministic no-call paths.
MCP and REST are checked against identical facts. These controlled clients are
not two actual external AI products.

The specification's two-live-client acceptance gate remains open until the owner
links two real assistant accounts and independently interrogates a live project.
A genuine paid-model response also remains open until an API key is configured.
No claim of customer release readiness or defect-free operation is made from the
automated checks alone.

### Review evidence

The full local suite passed 806 checks before the final presentation refinement;
44 focused checks then passed, including a new case proving that grouping three
missing fields into one destination action retains all three finding identities
and does not count requests as source records. Missing-information actions are
now grouped by their destination page; schedule/document decisions stay explicit.
The release performance gate measured 3,786.9 ms for cold opening and 3,089.2 ms
for a fresh 20,000-activity upload through its first calculated dashboard.

Browser review on the isolated service confirmed the actual schedule action,
updated reporting date, cleared confirmation and local CPI = 720 / 900 = 0.8.
The remaining missing/conflicting-evidence qualifications stayed visible with
the answer. The normal project list kept the other, unadopted project separate.


## Browser form save correction — 27 September 2026

The initial release used `Referrer-Policy: no-referrer` on HTML pages while requiring an exact same-origin `Origin` on state-changing requests. Native browser form submissions consequently sent `Origin: null`; AI settings saves, project access controls and connection consent could be rejected. The activation button used a fetch request and could succeed independently. Earlier API tests supplied Origin explicitly, so they did not expose this browser-policy conflict.

HTML pages now use `Referrer-Policy: same-origin`. Requests to other sites still disclose no referrer; callback redirects keep `no-referrer`. Exact origin checks, owner authentication and single-use form tokens remain required. Regression coverage checks the policy on all form pages, URL-encoded settings save and key retention, project isolation, null/missing/foreign-origin rejection and replay rejection. No production key, project record or connection is changed by the fix.
