# Verification and limitations

Reviewed 3 November 2026. Results describe this build and the checks performed, not a security certification or scientific accuracy benchmark.

## Automated checks

- 40 developer-authored regression and API checks pass.
- TypeScript no-emit checking passes.
- Project-specific ESLint checking passes.
- Production Vinext build passes on Vite 8.1.6 and React/RSC 19.2.8.
- The starter corpus reproduces 75 exact passage spans from 43 selected rows across two papers. Both source SHA-256 digests match. There are 18 source-reported taxa and 60 positive association groups.
- API tests execute the real API implementation against an in-memory SQLite adapter for D1. Cases cover session isolation, cross-origin writes, cookie properties, revision conflicts, audit persistence, safe exports, source rights confirmation, fixed external request hosts, cached references, failure handling, and rate limits.
- CSV preserves original fields, reviewer corrections, source author credit, licence metadata, offsets, and taxonomy reference dates. HTML shows original and reviewed fields separately. JSON preserves the complete structured records.

## Browser and hosting checks

The public app opens without a login. The actual preview D1 binding accepts reviews and imports. A hosted review saved successfully, then remained accepted with its note and revision after a full reload. A dated GBIF reference returned its provider URL and retrieval date on the public deployment.

Live Europe PMC search returned records on the hosted app. A specific DOI query returned the expected Hajira paper. Preparing its licensed reference snapshot populated the form with its title, authors, DOI, CC BY 4.0 terms, and 30,877 narrative characters. Saving this prepared article was not completed before the browser connection reset.

Responsive checks used actual iframe viewports of 390, 768, and 1280 CSS px. Body scroll width matched client width at each size. Phone navigation opened and reached the review queue. The temporary QA harness was removed before publication.

Direct browser file-upload and download completion remain unverified. A file-chooser call timed out, and the browser session later reset. Parsing and export behavior pass API and unit checks, but those checks do not prove browser file-dialog behavior. A full cross-browser matrix, screen-reader audit, performance benchmark, and load test have not been completed.

## Hosted API completion

`python3 scripts/verify-hosted.py --url https://citeflora.adeelfalaksher900.chatgpt.site` passed against the real hosted Worker and D1 database. It verified the application session cookie flags, the 2-source/75-candidate starter, a new three-candidate original QA import with ambiguity and negation preserved, source hashing, a persisted review correction, a dated GBIF reference, licensed narrative preparation, and HTTP 200 JSON, CSV and HTML exports. The CSV and HTML retained the correction and source attribution. Browser file-dialog completion remains separate and unverified. [Structured result](hosted-verification.json).

## Dependency review

The production dependency audit reports 0 known advisories. The full development-tool audit reports 4 moderate findings, with 0 high and 0 critical findings. The remaining packages are esbuild in legacy migration tooling, brace-expansion, and minimatch in development tooling. The repository retains its minimum-release-age policy. A minimatch patch was too new for that policy during this review. Audit counts change as advisories and packages change.

## Continuous integration

GitHub Actions passed the first published source commit, `55f0a8a37eb5895cb7b20da65c035a4979cfed79`. The run is [41525690729](https://github.com/adeelfalaksher900-creator/citeflora/actions/runs/41525690729). The workflow installs the lockfile, runs tests and type checking, and builds the app. Later commits require their own completed run before claiming CI success.

Repository branch-protection settings were not changed. The authenticated browser stopped responding while inspecting the branch settings. CODEOWNERS and contribution instructions request maintainer review, but an enforced branch-protection rule is not claimed.

## Scientific boundaries

The extractor uses bounded English rules. It does not estimate clinical efficacy, establish historical species identity, resolve every negation or complex relation, or interpret all source abbreviations. Known names use 24 dated GBIF reference records. Other names request the live service, which can fail. Literature search has a clearly labelled one-paper catalogue fallback if live search fails.

No domain-expert validation, community endorsement, user study, independently labelled evaluation set, clinical review, or accuracy percentage is claimed. A publication licence does not grant access to restricted community knowledge.

## Submission state

The Devpost title and tagline were saved under Citeflora. The details form was populated with the prepared story and links, but its required video URL prevented the normal details save. The full story remains in [DEVPOST.md](DEVPOST.md). Thumbnail upload did not complete. A 1536 × 1024 PNG cover and an eight-slide pitch deck are prepared. Team count, individual contributions, and first-day Discord registration still need verification by the team.

No final Devpost submission was performed. Demo video and the full 15-image gallery await the user's project approval.
