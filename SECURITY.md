# Security

The implemented data model isolates each browser workspace. A 256-bit random HttpOnly cookie identifies a session. Only a SHA-256 digest of the token is stored. Cookies use SameSite=Lax and Secure on HTTPS, with a 30-day maximum age.

Every source, claim, audit, and export query is scoped to the authenticated session's workspace. Claims from another workspace return 404. Review updates require the expected revision; an atomic D1 batch writes the audit event and update together. Conflicting revisions return 409.

The API requires exact same-origin JSON writes. Payloads are streamed with a size bound, source and metadata fields have limits, and SQL values use bound parameters. Imports reject executable source links. Outbound requests target fixed Europe PMC or GBIF hosts, not arbitrary visitor-supplied URLs. Session, mutation, and research-query rate limits reduce anonymous resource use.

React renders imported text as text. The application does not render source HTML. HTML reports escape untrusted values, and spreadsheet exports prefix formula-like cells. Production responses set a content security policy, a no-referrer policy, nosniff, and restrictive browser permissions. Inline scripts remain allowed for framework hydration; this is a stated limitation rather than a strict-CSP claim.

The workspace is designed for permitted literature, not patient records or restricted traditional knowledge. There is no encryption-at-rest feature managed by the application, no account recovery, and no formal compliance certification. A cookie expiry does not promise immediate data deletion. Anonymous service quotas and a bounded corpus do not constitute a load test or complete denial-of-service defense.

For a security issue, use the repository's private vulnerability reporting feature if available. Otherwise contact the maintainer privately through their GitHub profile. Do not open an issue containing credentials or private source material.
