"""Rebuild the bounded, attributed starter corpus from Europe PMC JATS XML.

Python standard library only. Uses the Europe PMC REST API, not site scraping.
The selected articles explicitly allow reproduction under CC BY.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPECS = [
    dict(pmc="PMC10424924", table="T3", label="Mount Pelion, Greece", short="Pelion skin-use study", region="Mount Pelion, Greece", doi="10.3389/fphar.2023.1225580", authors="Tsioutsiou EE, Cheilari A, Aligiannis N", year=2023,
         include=["Aloe vera", "Allium cepa", "Allium sativum", "Artemisia absinthium", "Foeniculum vulgare", "Hypericum perforatum", "Malva sylvestris", "Matricaria chamomilla", "Melissa officinalis", "Plantago sp.", "Quercus coccifera"]),
    dict(pmc="PMC11124858", table="plants-13-01379-t002", label="Hajira, Pakistan", short="Hajira ethnomedicinal study", region="Tehsil Hajira, Poonch District, Pakistan", doi="10.3390/plants13101379", authors="Jabeen T, Amjad MS, Ahmad K, Bussmann RW, Qureshi H, Vitasović-Kosić I", year=2024,
         include=["Mentha longifolia", "Foeniculum vulgare", "Allium sativum", "Aloe vera", "Punica granatum", "Berberis lycium", "Viola canescens", "Justicia adhatoda", "Vachellia nilotica", "Plantago lanceolata", "Ocimum basilicum"]),
]

def plain(el):
    return " ".join("".join(el.itertext()).split()) if el is not None else ""

def expand_rows(table):
    spans = {}
    output = []
    for tr in table.findall(".//tr"):
        row = {c: value for c, (value, left) in spans.items()}
        spans = {c: (value, left - 1) for c, (value, left) in spans.items() if left > 1}
        col = 0
        for cell in tr:
            if cell.tag not in ("td", "th"):
                continue
            while col in row:
                col += 1
            value = plain(cell)
            for _ in range(int(cell.get("colspan", 1))):
                row[col] = value
                if int(cell.get("rowspan", 1)) > 1:
                    spans[col] = (value, int(cell.get("rowspan")) - 1)
                col += 1
        output.append([row.get(c, "") for c in range(max(row, default=-1) + 1)])
    return output

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, help="Use local XML files when already downloaded")
    args = parser.parse_args()
    sources, plants = [], set()
    for spec in SPECS:
        cached = args.cache / (spec["pmc"] + ".xml") if args.cache else None
        raw = cached.read_bytes() if cached and cached.exists() else urllib.request.urlopen(
            f'https://www.ebi.ac.uk/europepmc/webservices/rest/{spec["pmc"]}/fullTextXML', timeout=40).read()
        article = ET.fromstring(raw)
        permission = plain(article.find(".//permissions"))
        if "CC BY" not in permission and "Creative Commons Attribution" not in permission:
            raise ValueError("An explicit permissive article licence is required")
        table = article.find(f'.//table-wrap[@id="{spec["table"]}"]')
        if table is None:
            raise ValueError("Expected source table was not found")
        rows = expand_rows(table)
        lines = ["Botanical name | Local name | Plant parts | Preparation | Route | Reported use"]
        last_name = last_local = ""
        for row in rows[1:]:
            row += [""] * (9 - len(row))
            if spec["pmc"] == "PMC10424924":
                if row[0]:
                    last_name, last_local = row[0], row[1]
                else:
                    row[0], row[1] = last_name, last_local
                selected = row[:6]
            else:
                selected = [row[0], row[1], row[4], row[5], row[6], row[7]]
            matched = next((p for p in spec["include"] if p in selected[0]), None)
            if not matched or not selected[5]:
                continue
            plants.add(matched)
            lines.append(" | ".join(selected))
        text = "\n".join(lines)
        sources.append(dict(
            key=spec["pmc"], title=plain(article.find(".//article-title")), shortTitle=spec["short"],
            authors=spec["authors"], year=spec["year"], region=spec["region"], doi=spec["doi"],
            url=f'https://doi.org/{spec["doi"]}', pmcid=spec["pmc"], licence="CC BY 4.0", licenceUrl="https://creativecommons.org/licenses/by/4.0/",
            evidenceType="traditional-report", text=text, format="table",
            attribution=permission,
            locator=f'Table {3 if spec["pmc"] == "PMC10424924" else 2}, selected rows',
            adaptation="Selected table rows normalized to six columns. Row-spanned and empty continuation identities are repeated. Original plant-part/preparation abbreviations are preserved. Source offsets refer to this normalized snapshot, not publisher XML.",
            xmlSha256=hashlib.sha256(raw).hexdigest(), contentHash=hashlib.sha256(text.encode()).hexdigest(),
            rowCount=len(lines)-1,
        ))
    target = ROOT / "data" / "corpus.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "data" / "taxa.json").write_text(json.dumps(sorted(plants), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"sources": len(sources), "rows": sum(s["rowCount"] for s in sources), "sourceReportedTaxa": len(plants)}))

if __name__ == "__main__":
    main()
