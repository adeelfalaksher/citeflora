# Verification and limitations

Reviewed 3 November 2026. Results describe the checked build and deployed services. They are not a security certification or a scientific accuracy benchmark.

## Current automated results

| Check | Result |
| --- | --- |
| `pnpm test` | 59 of 59 developer-authored regression and API checks pass |
| `pnpm typecheck` | TypeScript no-emit check passes |
| `pnpm lint` | Full configured ESLint check passes |
| `pnpm build:vercel` | Standard Next.js 16 / React 19 production build passes |
| `pnpm build:api` | Standalone Cloudflare Worker API bundle passes |
| Starter integrity | 75 passage spans and both source SHA-256 digests match their snapshots |

The starter contains 43 selected rows from two papers, 18 source-reported taxa and 60 positive association groups. These are corpus and integrity results, not measured scientific accuracy.

Checks cover ambiguity, negation, relation scope, Unicode offsets, DOI deduplication, source rights confirmation, bounded validation, session isolation, cross-origin writes, cookies, stale review conflicts, audit persistence, exports, fixed research-request hosts, references and failure handling. API checks execute the real implementation against an in-memory SQLite adapter for D1. Proxy and Worker checks cover endpoint restrictions, secret authentication, cookie handling and trusted rate-limit buckets.

CSV retains original fields, reviewer corrections, source authors, licence metadata, offsets and taxonomy dates. HTML separates original and reviewed fields. JSON preserves structured source and candidate records.

## Public deployment and hosted API

The current audited application release, source commit `84139f9986745dc32b2414b6a8c12f31842d1bc1`, reached `READY` as Vercel deployment `dpl_Bx2Mow1BoY8gM6xMhZhqkXezdpbe`. The public entry point is [citeflora.vercel.app](https://citeflora.vercel.app). It uses the standalone API at `https://citeflora-api.adeelfalaksher900.workers.dev` with persistent Cloudflare D1. The matching Worker upload completed at 11:35:57 UTC on 3 November 2026. Its existing D1 binding and server secret were retained. The empty-author repair migration changed one exact source attribution and added its audit event; source text, digest and reviews were preserved.

This command passed against the actual Vercel domain and its Cloudflare API/D1 path. The current extended hosted run completed at 11:38:16 UTC on 3 November 2026. Its dated result is in [hosted-verification.json](hosted-verification.json):

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
- Taxonomy provenance survived a note-only edit, including its audit record.
- Ordinary mentions, adverse effects, negative statements and mixed-polarity contexts were guarded conservatively; unsupported-name imports reported zero honestly and oversized passages were rejected.
- All snapshot digests and UTF-16 entity spans matched; the prepared licensed narrative contained non-empty verified author attribution.

The script keeps cookies in memory and uses developer-owned QA text. It writes its current result to `outputs/hosted-verification.json`. It does not test browser file-dialog completion.

## Browser verification status

The initial public Vercel release passed an actual guided browser run: open the study, inspect the passage, save an accepted decision with a note at revision 1, and generate CSV to complete the guide. At 390 CSS px, the landing page, guide and workbench had no horizontal overflow, and mobile navigation worked. A Vercel runtime error/fatal log scan covering the previous 30 minutes found no matching entries.

The revised production interface was checked at 390, 1280 and 1440 CSS px. The guided record remained accepted after a full reload. A later review saved at revision 3 cleared the prior export completion, and Cmd/Ctrl+K opened and focused source search from the welcome page. Browser import of original QA text created two candidates, retaining the ambiguous Mint record. Screenshots in docs/images show the actual public interface. The final release also passed a fresh browser session through study, passage, saved review at revision 1 and JSON export completion. A reload retained its accepted decision. A later automated CLI rerun was interrupted before completion and is not counted as a passing run; the earlier hosted report remains dated separately.

Earlier Sites browser checks demonstrated live Europe PMC results and a dated GBIF record. Those observations are separate from the new Vercel checks. Direct browser file-upload and operating-system download completion remain unverified; the current CSV check establishes application export generation and guide completion.

A full cross-browser matrix, screen-reader audit, performance benchmark and load test have not been completed.

## Dependency review

A fresh production dependency audit reported 0 known advisories on 3 November 2026. The full development-tool audit reported 4 moderate findings, 0 high and 0 critical findings. The remaining packages were esbuild in legacy migration tooling, brace-expansion and minimatch in development tooling. The minimum-release-age policy was retained; the available minimatch patch was too new during the review. These are dated audit results, not a fresh advisory guarantee.

## Continuous integration

The earlier source commit `69e0c66c97af6df72dff61172b78fbb9bae0c469` passed GitHub Actions run [41596319514](https://github.com/adeelfalaksher900-creator/citeflora/actions/runs/41596319514). A completed GitHub Actions run for the later audit commit has not been verified. The current audit passed regression tests, type generation and TypeScript, ESLint, the Vercel build, standalone API bundle and legacy Sites build locally. Both build orders were checked with canonical route generation before TypeScript.

Branch-protection settings were not changed. CODEOWNERS and contribution instructions request maintainer review, but an enforced protection rule is not claimed.

## Scientific boundaries

The extractor uses bounded English rules. It does not establish efficacy, safety or historical identity, resolve all negation and complex relations, or interpret every source abbreviation. Known names use dated GBIF references; others request the live service, which may fail. Literature search has a clearly labelled one-paper fallback.

No domain-expert validation, community endorsement, user study, independently labelled evaluation set, clinical review or scientific accuracy percentage is claimed. Publication licences do not grant access to restricted community knowledge.

## Submission state

The normal Devpost editor saved the project story, six stack tags, live-app/GitHub links, cover and fifteen captioned actual screenshots. Each gallery image is exactly 3:2 and below 5 MB. Captions were matched visually to their corresponding screens and saved within Devpost's 140-character limit. The eight-slide PDF is saved under Additional info, and its persisted filename was verified after reopening that section. The entry remains DRAFT at 3/5 steps. The project-details video URL and final submission are incomplete. No placeholder video URL, final terms acceptance or final submission has been supplied.

A real browser walkthrough with natural English narration and 1920 × 1080 MP4 delivery was requested in [Manus task XBb6DtZRww7xaf4URHRx2L](https://manus.im/app/XBb6DtZRww7xaf4URHRx2L). A completed MP4 has not yet been delivered or checked. The user will upload it to YouTube, add the URL and submit. Two members are listed on Devpost; individual contributions and first-day Discord registration still need team verification.

## Working-product audit, 3 November 2026

A fresh baseline hosted run passed at 10:46 UTC. A focused narrative audit then found and reproduced four defects: ordinary/adverse-effect mentions defaulted to positive associations; simple negative phrases were missed; a note-only review discarded structured taxonomy provenance; and zero-result imports announced review-ready candidates. These were functional defects, not merely visual changes.

Engine 1.0.2 conservatively marks unsupported relations, adverse-effect contexts and mixed clauses uncertain. Current map screening also protects older stored narratives without changing their original records. Plain negation remains negative. Source-table use cells retain their schema context. The import flow explains bounded vocabulary and gives the actual result count, including zero. Note-only reviews retain the taxonomy response when identity fields are unchanged; manual identity changes clear it, and audit events include the saved taxonomy object. A 6,000-character sentence/table-row bound prevents giant repeated candidate passages. Stable alias patterns and use-first scanning reduce unnecessary work.

All eight added regression checks passed, bringing the suite from 50 to 58. TypeScript, ESLint, the Next production build and standalone API build passed locally. The starter remains 75 candidates, 60 groups and 75 valid source/entity spans across the two unchanged attributed snapshots. Updated hosted verification adds challenge contexts, zero results, passage bounds, taxonomy retention and all UTF-16 spans. Deployment and fresh browser checks are recorded below when completed.

The practical function is organizing a reviewable evidence collection. There is no measured time-saving claim or demonstrated user-benefit result: no external researcher study has been performed. The tool's real persistence, imports and exports do not make its bounded rules scientifically comprehensive.

The audit release was deployed from public commit `1c226284245bf884b19f5a11f92523eeaf965740`. Vercel deployment `dpl_AyS4RcjFXrMb1oH8K3X4b9Z1JKCN` reached READY. The Cloudflare Worker upload completed at 10:54 UTC with its existing D1 binding and server secret retained. The extended hosted script passed at 10:57:12 UTC on 3 November 2026 against the public Vercel domain and engine 1.0.2. Every added context/provenance check, isolated workspace and export check passed. The exact dated result is in hosted-verification.json. The legacy Sites build and post-build TypeScript check also passed.

A full licensed narrative import uncovered missing cached author attribution. The cache parser had required `contrib-type="author"`, while this publisher marks the surrounding contributor group. The corrected generator and live importer recognize author groups, preserve name order, exclude editors/references, and reject automatic imports when author attribution cannot be prepared. A regression using both name-element orders passes. The rebuilt cached text and XML digests are unchanged. Migration 0001 repairs only an empty author field on the exact Hajira DOI and narrative digest, recording an audit event. Its idempotence and unchanged text/hash were checked locally before applying. The suite now passes 59 checks.

Browser audit after the attribution repair confirmed the corrected author name in the saved narrative, a live Europe PMC result, 32 narrative candidates, the flagged multi-plant passage, accepted-only mapping, and a genuine zero-candidate unsupported-name import with the explicit limit message. The guide saved revision 5 and generated JSON successfully. Fifteen actual 3:2 screenshots were captured. The visible Devpost upload control successfully accepted all fifteen images; the initial hidden-input attempt had failed. The cover and required presentation PDF also uploaded successfully. These Devpost uploads do not establish completion of Citeflora's own browser file-import flow, which remains a separate unverified check.
