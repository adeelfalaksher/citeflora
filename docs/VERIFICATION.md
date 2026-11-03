# Verification and limitations

Reviewed 3 November 2026. Results describe the checked build and deployed services. They are not a security certification or a scientific accuracy benchmark.

## Current automated results

| Check | Result |
| --- | --- |
| `pnpm test` | 50 of 50 developer-authored regression and API checks pass |
| `pnpm typecheck` | TypeScript no-emit check passes |
| `pnpm lint` | Full configured ESLint check passes |
| `pnpm build:vercel` | Standard Next.js 16 / React 19 production build passes |
| `pnpm build:api` | Standalone Cloudflare Worker API bundle passes |
| Starter integrity | 75 passage spans and both source SHA-256 digests match their snapshots |

The starter contains 43 selected rows from two papers, 18 source-reported taxa and 60 positive association groups. These are corpus and integrity results, not measured scientific accuracy.

Checks cover ambiguity, negation, relation scope, Unicode offsets, DOI deduplication, source rights confirmation, bounded validation, session isolation, cross-origin writes, cookies, stale review conflicts, audit persistence, exports, fixed research-request hosts, references and failure handling. API checks execute the real implementation against an in-memory SQLite adapter for D1. Proxy and Worker checks cover endpoint restrictions, secret authentication, cookie handling and trusted rate-limit buckets.

CSV retains original fields, reviewer corrections, source authors, licence metadata, offsets and taxonomy dates. HTML separates original and reviewed fields. JSON preserves structured source and candidate records.

## Public deployment and hosted API

The final Vercel deployment for source commit `69e0c66c97af6df72dff61172b78fbb9bae0c469` reached `READY` as deployment `dpl_6krj4BQHf82As1NK5QNkrLT2yNDm`. The public entry point is [citeflora.vercel.app](https://citeflora.vercel.app). It uses the standalone API at `https://citeflora-api.adeelfalaksher900.workers.dev` with persistent Cloudflare D1. This release includes the revised interface, refreshed cover, pitch files and canonical Next route generation before type checking.

This command passed against the actual Vercel domain and its Cloudflare API/D1 path. The extended hosted run completed at 04:21 UTC on 3 November 2026:

```sh
python3 scripts/verify-hosted.py --url https://citeflora.vercel.app
```

The run verified:

- Session creation with the `citeflora_session` cookie's HttpOnly and Secure attributes, plus the two-source/75-candidate starter.
- A new original QA source producing three candidates, with ambiguous-name and negative-statement flags retained.
- The imported source's SHA-256 digest and exact passage spans.
- A saved review correction, revision 1, and a subsequent workspace read containing the decision.
- A dated GBIF reference result from the 24-record reference set.
- Licence-checked preparation of the Hajira narrative with CC BY 4.0 terms and more than 30,000 characters.
- HTTP 200 JSON, CSV and HTML exports. CSV and HTML contained the saved correction and source attribution.
- A second independent workspace’s record list excluded the first workspace’s claim, and attempting to modify that claim returned 404.
- A stale review revision returned 409, and a cross-origin write returned 403.

The script keeps cookies in memory and uses developer-owned QA text. It writes its current result to `outputs/hosted-verification.json`. It does not test browser file-dialog completion.

## Browser verification status

The initial public Vercel release passed an actual guided browser run: open the study, inspect the passage, save an accepted decision with a note at revision 1, and generate CSV to complete the guide. At 390 CSS px, the landing page, guide and workbench had no horizontal overflow, and mobile navigation worked. A Vercel runtime error/fatal log scan covering the previous 30 minutes found no matching entries.

The revised production interface was checked at 390, 1280 and 1440 CSS px. The guided record remained accepted after a full reload. A later review saved at revision 3 cleared the prior export completion, and Cmd/Ctrl+K opened and focused source search from the welcome page. Browser import of original QA text created two candidates, retaining the ambiguous Mint record. Screenshots in docs/images show the actual public interface. The final release also passed a fresh browser session through study, passage, saved review at revision 1 and JSON export completion. A reload retained its accepted decision. A later automated CLI rerun was interrupted before completion and is not counted as a passing run; the earlier hosted report remains dated separately.

Earlier Sites browser checks demonstrated live Europe PMC results and a dated GBIF record. Those observations are separate from the new Vercel checks. Direct browser file-upload and operating-system download completion remain unverified; the current CSV check establishes application export generation and guide completion.

A full cross-browser matrix, screen-reader audit, performance benchmark and load test have not been completed.

## Dependency review

A fresh production dependency audit reported 0 known advisories on 3 November 2026. The full development-tool audit reported 4 moderate findings, 0 high and 0 critical findings. The remaining packages were esbuild in legacy migration tooling, brace-expansion and minimatch in development tooling. The minimum-release-age policy was retained; the available minimatch patch was too new during the review. These are dated audit results, not a fresh advisory guarantee.

## Continuous integration

The published final source commit `69e0c66c97af6df72dff61172b78fbb9bae0c469` passed GitHub Actions run [41596319514](https://github.com/adeelfalaksher900-creator/citeflora/actions/runs/41596319514). CI runs the 50 tests, type generation and TypeScript, ESLint, the Vercel build, standalone API bundle and legacy Sites build. Both build orders were also checked locally with canonical route generation before TypeScript.

Branch-protection settings were not changed. CODEOWNERS and contribution instructions request maintainer review, but an enforced protection rule is not claimed.

## Scientific boundaries

The extractor uses bounded English rules. It does not establish efficacy, safety or historical identity, resolve all negation and complex relations, or interpret every source abbreviation. Known names use dated GBIF references; others request the live service, which may fail. Literature search has a clearly labelled one-paper fallback.

No domain-expert validation, community endorsement, user study, independently labelled evaluation set, clinical review or scientific accuracy percentage is claimed. Publication licences do not grant access to restricted community knowledge.

## Submission state

The Devpost title and tagline were saved. The details form was populated previously, but its required video URL prevented the normal save. The prepared story is in [DEVPOST.md](DEVPOST.md). No placeholder video URL or final submission has been provided.

The 1536 × 1024 cover and eight-slide editable deck/PDF have been refreshed for the revised interface and Vercel hosting. Thumbnail upload did not complete. Team count, individual contributions and first-day Discord registration still need team verification. Full demo video and 15-image gallery production await user project approval.
