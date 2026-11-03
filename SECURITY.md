# Security

## Deployment trust boundary

The public Next.js interface runs on Vercel. Browsers call its same-origin API proxy; they do not receive the Cloudflare secret. The standalone Worker requires the shared `CITEFLORA_PROXY_SECRET` for API access. Operators configure `CITEFLORA_API_URL` and that secret in Vercel, with the matching secret in the Worker. End users need no account or API key.

The proxy permits only implemented API paths and methods. It accepts an HTTPS `workers.dev` backend origin without credentials, a port, path or query. Writes require exact-origin JSON and reject a cross-site fetch context. Bodies are streamed with a 350,000-byte bound. Redirects are rejected rather than followed, and upstream requests have a timeout.

Only `citeflora_session` is forwarded. Returned cookies are restricted to the expected token format, without a Domain attribute, and rebuilt with HttpOnly, Secure, SameSite=Lax and a bounded 30-day lifetime. Unrelated cookies and client-supplied proxy headers are not forwarded.

On Vercel, the proxy uses the platform-overwritten client-address header and shared secret to derive a hashed rate-limit bucket. The Worker accepts this bucket only after authenticating the proxy. Ordinary forwarded address headers are not trusted. This prevents unrelated visitors from sharing only a Vercel egress-IP bucket; it is not a complete abuse-prevention system.

## Workspace isolation

A 256-bit random token identifies each browser workspace. D1 stores only its SHA-256 digest. Every source, claim, audit and export query is scoped to the authenticated workspace. A claim from another workspace returns 404. This is application-enforced D1 isolation, not a PostgreSQL row-level-security policy.

Reviews require the expected revision. An atomic D1 batch writes the decision and audit event together. Conflicts return 409 rather than silently overwriting a newer review. Original snapshots and extraction fields remain separate from corrections.

## Inputs and outputs

The Worker validates origin and JSON writes again, bounds fields, requires explicit source-rights confirmation, and uses bound SQL parameters. Imports reject executable publication links. Outbound research requests use fixed Europe PMC or GBIF hosts rather than arbitrary visitor URLs. Session, mutation and research-query rate limits bound anonymous use.

React renders imported text as text. Source HTML is not rendered. HTML reports escape untrusted values, and spreadsheet exports prefix formula-like cells. Responses set no-store API caching, nosniff, a no-referrer policy and restrictive browser permissions. The frontend also sets a content security policy. Inline scripts remain allowed for framework hydration, so this is not a strict-CSP claim.

## Limits and reporting

The workspace is for permitted literature, not patient records or restricted traditional knowledge. There are no accounts, recovery, cross-device synchronization, application-managed encryption-at-rest feature or formal compliance certification. Cookie expiry does not promise immediate data deletion. Anonymous quotas and bounded imports do not replace a load test or complete denial-of-service defense.

No privileged value belongs in browser code, a `NEXT_PUBLIC_` environment variable, source control or an export. Keep secrets in provider configuration and rotate the shared value in both services when necessary.

For a security issue, use the repository's private vulnerability reporting feature if available. Otherwise contact the maintainer privately through their GitHub profile. Do not open an issue containing credentials or private source material.
