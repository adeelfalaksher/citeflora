# Data sources and permissions

The starter corpus is a bounded adaptation of selected table rows. It is not a new ethnobotanical survey, a complete copy of the papers, or proof of therapeutic efficacy.

| Source | Attribution | Selected content | Licence |
| --- | --- | --- | --- |
| [Pelion skin-use study](https://doi.org/10.3389/fphar.2023.1225580) | Tsioutsiou EE, Cheilari A, Aligiannis N, 2023 | Table 3, 21 selected rows | CC BY 4.0 |
| [Hajira ethnomedicinal study](https://doi.org/10.3390/plants13101379) | Jabeen T, Amjad MS, Ahmad K, Bussmann RW, Qureshi H, Vitasović-Kosić I, 2024 | Table 2, 22 selected rows | CC BY 4.0 |

Full titles, author strings, permission statements, DOIs, regional context, original XML digests, snapshot digests, and adaptation notes are stored in `data/corpus.json`. Copyright remains with the original authors. Citeflora credits the papers wherever their source snapshots are shown and in exports.

The preparation script retrieves JATS XML from Europe PMC's authorized REST endpoint. It expands `rowspan` cells, repeats empty continuation identities in the Greek table, selects specified taxa, and normalizes six columns. Original preparation and plant-part abbreviations remain unchanged. Reported use terms are preserved. Offsets describe the normalized snapshot, not the article's layout or XML coordinates.

The 43 rows produce 75 rule-engine candidates. Several use categories can occur in one row. These counts describe extraction output, not independent experiments, validated remedies, or study participants. No informant-level records, precise collection coordinates, or private community data are imported.

The small alias dictionary includes manually authored examples such as ambiguous mint and chamomile. These are candidate mappings for review, not asserted ethnolinguistic identities. Names reported by the sources are not automatically certified as accepted taxonomy.

## External services

- [Europe PMC REST](https://europepmc.org/RestfulWebService): publication discovery and explicitly licensed full-text retrieval. Individual article terms govern reuse. Automatic import supports explicit CC BY 4.0 and CC0 1.0. Narrative conversion excludes tables, figures, and reference lists.
- [GBIF Species API](https://techdocs.gbif.org/en/openapi/v1/species): user-requested taxonomic name matching. Responses are suggestions with retrieval timestamps. The match score is not medical evidence or a historical-identification probability.
- [Kew MPNS](https://www.kew.org/science/our-science/science-services/medicinal-plant-names-services): research context for name ambiguity. Citeflora does not copy or claim access to the MPNS database.

External services are not sponsors or endorsers. User-supplied material remains private to its session workspace. A public paper's licence does not itself grant rights to restricted traditional knowledge or permission for commercial exploitation.

## Non-data assets

Geist font files: Google Fonts distribution, original Geist authors, SIL Open Font License in `public/fonts/OFL.txt`. Lucide icons retain their package licence. The project mark and interface layout were created for Citeflora. Mobbin references informed interface research only; no proprietary screenshots or template artwork are shipped in the application.

## Dated external references

`taxonomy-reference.json` contains 24 real GBIF Species API v1 records, with provider record URLs and retrieval timestamps. They are current-taxonomy suggestions, never historical identity guarantees. `literature-reference.json` contains one CC BY 4.0 narrative snapshot of PMC11124858, derived from the same licensed XML used for the corpus. It excludes tables, figures, and reference lists and retains at most 75,000 characters. Author credit, permission text, DOI, XML digest, and snapshot preparation date travel with the import. Frontiers XML without an explicit versioned licence URL is deliberately excluded from automatic narrative import.

Known taxonomy names use the dated reference first. Other names use the live API. Literature search attempts the live Europe PMC REST API; on network failure it searches this bounded catalogue using broad keyword matching. The UI labels this fallback and its scope. `python3 scripts/refresh-reference-cache.py --cache /path/to/licensed-xml` refreshes the references; use `--literature-only` to retain the existing dated GBIF records. Refreshing requires the provider to be reachable.
