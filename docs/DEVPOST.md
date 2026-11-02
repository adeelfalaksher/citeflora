# Citeflora

Trace plant-use reports from source passage to reviewed evidence, preserving citations, name uncertainty, and every extraction decision.

## Inspiration

Traditional knowledge research often starts with a table, a vernacular name, and a sentence in a paper. Moving those fragments into a spreadsheet can lose the citation, confuse plant identity, or make a reported use look like established clinical evidence. Citeflora keeps that context attached from the first extraction through review and export.

## What it does

Citeflora is a research workspace for EthnoHack Track 1, Traditional Knowledge Mining. Start with two attributed open-access studies, or import permitted English text and six-column CSV tables. A deterministic engine proposes plant-use records and highlights their exact source passages. Researchers can inspect citations and hashes, keep identity unresolved, consult dated GBIF references or a live name lookup, correct extracted fields, and record an accepted, rejected, or pending decision.

The evidence map groups positive reported associations and counts duplicate DOIs once. Negative, speculative, rejected, and unassigned multi-plant records stay out of that positive map. CSV, JSON, and printable HTML exports carry the evidence trail forward. Accepted means the extraction was checked; it does not validate a treatment.

## How we built it

The React and TypeScript interface runs on Vinext and Cloudflare Workers. D1 stores separate browser-session workspaces, source snapshots, candidates, review revisions, and audit events. A random HttpOnly cookie identifies a workspace; server-side authorization scopes every record operation. There are no account credentials to distribute to judges.

The rule engine uses sentence and table-row scope, a bounded botanical-name list, known-genus fallback, polarity cues, and explicit uncertainty flags. It saves exact UTF-16 offsets and SHA-256 source digests instead of generating unsupported answers. GBIF supplies current-taxonomy suggestions. Europe PMC supplies literature search and licence-checked narrative import. A clearly labelled one-paper catalogue and 24 dated taxonomy records provide reproducible references when live services are unavailable.

## Challenges and accomplishments

Common-name ambiguity, several plants in one sentence, inherited table cells, and source abbreviations can all create misleading records. The implementation preserves these uncertainties instead of silently resolving them. Original passages remain unchanged while reviewer corrections are stored separately. Optimistic revisions prevent a stale review from overwriting a newer decision.

The bounded starter corpus contains 43 selected rows from two CC BY studies, 18 source-reported taxa, and 75 candidate extractions. All 75 passage spans match their snapshots and both source digests reproduce. These are integrity results, not a scientific accuracy benchmark. The repository includes extraction, validation, access-control, API, conflict, audit, and export regression checks.

## What we learned

A plausible plant name is not enough to establish identity, and a reported use is not clinical evidence. Reproducibility improves when uncertainty, source terms, and the review trail remain first-class data. We also learned to distinguish live API results from dated references explicitly when network availability changes.

## What's next

Independent evaluation with ethnobotany and pharmacognosy researchers; broader multilingual and historical-name coverage; community-governed permissions; interoperable evidence schemas; and user accounts for collaboration. These are future work, not current capabilities.

## Sources and assistance

Starter studies: Tsioutsiou, Cheilari and Aligiannis (2023), DOI 10.3389/fphar.2023.1225580; Jabeen and colleagues (2024), DOI 10.3390/plants13101379. Each source retains author credit, licence, adaptation notes, and a publication link. New project code is MIT-licensed; research excerpts and third-party software retain their own terms.

Research, design, development, and verification used significant ChatGPT/Codex assistance. Human team members retain responsibility for review and submission. Individual human programming or research contributions are not claimed without confirmation. The maintained Sites/Vinext starter predates the hackathon; the extraction engine, corpus workflow, review application, API, database schema, exports, and project checks were developed for Citeflora.

Live app: https://citeflora.adeelfalaksher900.chatgpt.site

Source: https://github.com/adeelfalaksher900-creator/citeflora
