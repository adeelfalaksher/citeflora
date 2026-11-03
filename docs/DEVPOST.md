# Citeflora

Trace plant-use reports from source passage to reviewed evidence, preserving citations, name uncertainty and every extraction decision.

## Inspiration

Traditional knowledge research often starts with a table, a vernacular name and a passage in a paper. Moving those fragments into a spreadsheet can lose the citation, confuse plant identity or make a reported use look like established clinical evidence. Citeflora keeps that context attached through extraction, review and export.

## What it does

Citeflora is a research workspace for EthnoHack Track 1, Traditional Knowledge Mining. Researchers can start with two attributed open-access studies or import permitted English text and supported files. A deterministic rule engine proposes plant-use records and highlights their exact passages. Users inspect uncertainty, consult GBIF taxonomy suggestions, correct fields separately from the original extraction, and save an accepted, rejected or pending decision.

The evidence map groups positive reported associations and counts duplicate DOIs once. Negative, speculative, adverse-effect, unresolved-relation, complex, rejected and unassigned multi-plant records stay out of that positive map. CSV, JSON and printable HTML exports preserve citations, spans, uncertainty and review status. Acceptance records an extraction review. It does not validate a treatment.

## How users and judges try it

Open [citeflora.vercel.app](https://citeflora.vercel.app) and choose **Try the guided example**. No end-user account or API key is needed.

1. Open the Pelion study record and inspect its citation, CC BY licence and selected-table scope.
2. Check the proposed *Hypericum perforatum* and wounds record against the unchanged, highlighted passage.
3. Save a decision and any note or correction. The application persists a new revision and audit event before advancing.
4. Generate an evidence export containing that saved decision and the original source trail.

Researchers can choose **Add a research source** for their own permitted material. The guide uses the actual application and database, rather than a simulated result.

## How we built it

The interface uses standard Next.js 16, React 19 and TypeScript on Vercel. Its same-origin server proxy validates requests and authenticates to a standalone Cloudflare Worker. D1 persists isolated browser workspaces, immutable snapshots, candidates, revisions and audit events. A random HttpOnly cookie identifies the workspace. The shared operator secret stays on the two servers and is never supplied to visitors.

The rule engine uses sentence and table-row scope, a bounded botanical-name list, known-genus fallback, conservative relation and polarity cues, and explicit uncertainty flags. It saves exact UTF-16 offsets and SHA-256 digests instead of generating unsupported answers. GBIF supplies current-taxonomy suggestions. Europe PMC supplies literature search and licence-checked narrative preparation. A labelled one-paper catalogue and 24 dated taxonomy records support reproducible references when live services are unavailable.

The design uses a research fieldbook approach, with warm surfaces, strong typography and an attributed passage as the main visual. The entry point explains the product before opening the workbench, and the guide provides a complete first-use path.

## Challenges and accomplishments

Common-name ambiguity, several plants in one sentence, inherited table cells and abbreviations can create misleading records. Citeflora preserves these uncertainties instead of silently resolving them. Corrections remain separate from the source and original extraction. Expected-revision checks prevent a stale review from overwriting a newer decision.

The starter contains 43 selected rows from two CC BY studies, 18 source-reported taxa and 75 candidates. All 75 passage spans match their snapshots and both digests reproduce. These are integrity results, not a scientific accuracy benchmark.

The current local suite passes 58 regression and API checks, TypeScript checking, ESLint and both production builds. A real hosted check through Vercel verified a three-candidate import, ambiguity and negation flags, a saved correction, source hashing, a dated taxonomy reference, licensed narrative preparation and all three exports. It also verified workspace isolation, stale-review rejection and cross-origin write rejection. A public browser run reached a saved review and CSV export through the guide, with mobile navigation checked at 390 CSS px. Final-release browser and scientific-validation limits are recorded in the [verification report](https://github.com/adeelfalaksher900-creator/citeflora/blob/main/docs/VERIFICATION.md).

## What we learned

A plausible plant name does not establish identity, and a reported use is not clinical evidence. Reproducibility improves when the passage, source terms and review reasons remain part of the record. A guided task explains the product more clearly than an unexplained dashboard. Live results and dated references need distinct labels when network availability changes.

## What's next

Independent evaluation with ethnobotany and pharmacognosy researchers; broader multilingual and historical-name coverage; community-governed permissions; interoperable schemas; and accounts for collaboration. These are future work, not current capabilities.

## Sources and assistance

Starter studies: Tsioutsiou, Cheilari and Aligiannis (2023), DOI 10.3389/fphar.2023.1225580; Jabeen and colleagues (2024), DOI 10.3390/plants13101379. Each source retains author credit, licence, adaptation notes and a publication link. New code is MIT-licensed. Excerpts and third-party software retain their own terms.

Research, design, development and verification used significant ChatGPT/Codex assistance. Human team members retain responsibility for review and submission. Individual human programming or research contributions are not claimed without confirmation. The maintained Sites/Vinext starter predates the hackathon. The extraction engine, corpus workflow, API, schema, proxy boundary, guided review interface, exports and checks were developed for Citeflora.

Live app: [citeflora.vercel.app](https://citeflora.vercel.app)

Source: [github.com/adeelfalaksher900-creator/citeflora](https://github.com/adeelfalaksher900-creator/citeflora)

## Preparation status

This is the prepared story. The existing title and tagline are saved, but the details form's mandatory video URL has prevented its normal save. No placeholder URL is provided and no final submission has been performed. The 3:2 cover and eight-slide editable deck/PDF have been refreshed for the revised interface and Vercel deployment. Full video and 15-image gallery production remain deferred until project approval. Team membership, contributions and first-day Discord registration still require team verification.
