# Application access

The project gateway supports application permissions separately from external
assistant permissions. The supported roles are project viewer, project editor,
and application administrator. Viewers can read assigned projects and run Ask;
editors can also change assigned project evidence and decisions. Only an
application administrator can create projects or use unlisted system routes.
Portfolio and background-upload results are filtered before they are returned.
Project permissions are checked before cached results or worker requests.

Use the existing verified identity configuration (`CMENG_EXTERNAL_POLICY_FILE`
or `CMENG_EXTERNAL_POLICY_JSON`) for issuer, audience, RSA public key, secure
origin, workspace and enabled identity records. External assistant access need
not be enabled. External assistant tokens do not grant application access.
The private owner activation mechanism can also establish the existing verified
owner session; it does not itself assign an application role.

Set `CMENG_APP_ACCESS_POLICY_FILE` to a protected JSON file, for example:

```json
{
  "schemaVersion": 1,
  "users": {
    "identity-subject-id": {
      "enabled": true,
      "administrator": false,
      "projects": {"PROJECT-CODE": "viewer"}
    }
  }
}
```

`CMENG_APP_ACCESS_POLICY_JSON` is an alternative deployment setting. Use exact
canonical project codes. Policies are reread for each request, so revocation
also applies to previously cached pages. Cookie-authenticated writes require
the configured Origin. The gateway removes client-supplied actor headers and
signs the verified identity for its internal worker; audit history and personal
Ask records then use that identity.

For a protected installation, set **`CMENG_REQUIRE_APP_AUTH=1`** as well. A
missing or unreadable access policy then closes application requests. Without
an application policy or this requirement, the existing public review/demo mode
remains available; it must not be described as protected production access.
No production identity provisioning or deployment is performed by adding this
code. Stage 7 still requires testing the real sign-in provider, configured
people/roles, session expiry/revocation and the deployed release.

Back up the complete stopped volume, including original uploads and identity
control state. A relocated restore reconnects retained source paths only when
the project, retained filename and exact source hash match. Test restoration
with the original location unavailable. Release rollback is a separate gate.
