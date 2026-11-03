"""Create dated, reproducible GBIF and Europe PMC reference snapshots.

Public APIs only. Cached papers require an explicit CC BY 4.0/CC0 licence.
"""
import argparse
import hashlib
import concurrent.futures
import datetime
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
STAMP = datetime.datetime.now(datetime.timezone.utc).isoformat()
HEADERS = {'User-Agent': 'Citeflora/1.0 research-reference-cache', 'Accept': 'application/json'}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30).read()

def text(el):
    return ' '.join(''.join(el.itertext()).split()) if el is not None else ''

def taxonomy(name):
    query = name.replace(' sp.', '')
    raw = json.loads(get('https://api.gbif.org/v1/species/match?verbose=true&kingdom=Plantae&name=' + urllib.parse.quote(query)))
    if raw.get('kingdom') != 'Plantae' or not raw.get('usageKey'):
        return None
    value = {k: raw[k] for k in ['usageKey','acceptedUsageKey','scientificName','canonicalName','status','rank','matchType','confidence','kingdom','family'] if k in raw}
    accepted = raw.get('canonicalName', '')
    if raw.get('acceptedUsageKey'):
        accepted_raw = json.loads(get('https://api.gbif.org/v1/species/' + str(raw['acceptedUsageKey'])))
        accepted = accepted_raw.get('canonicalName') or accepted_raw.get('scientificName') or accepted
    value.update(query=query, retrievedAt=STAMP, acceptedScientificName=accepted, mode='reference-snapshot', provider='GBIF Species API v1', providerUrl='https://api.gbif.org/v1/species/' + str(raw['usageKey']))
    return query.lower(), value

def article(pmcid, cache=None):
    cached = cache / (pmcid + ".xml") if cache else None
    raw = cached.read_bytes() if cached and cached.exists() else get('https://www.ebi.ac.uk/europepmc/webservices/rest/' + pmcid + '/fullTextXML')
    root = ET.fromstring(raw)
    permissions = text(root.find('.//permissions'))
    licence_xml = ET.tostring(root.find('.//permissions'), encoding='unicode') if root.find('.//permissions') is not None else ''
    ccby = bool(re.search(r'creativecommons.org/licenses/by/4.0', licence_xml))
    cc0 = bool(re.search(r'creativecommons.org/publicdomain/zero/', licence_xml))
    if not ccby and not cc0:
        return None
    body = root.find('.//body')
    if body is None:
        return None
    for parent in body.iter():
        for child in list(parent):
            if child.tag in ['table-wrap','fig']:
                parent.remove(child)
    narrative = '\n\n'.join(text(p) for p in body.findall('.//p') if text(p))[:75000]
    if not narrative:
        return None
    doi = text(root.find('.//article-id[@pub-id-type="doi"]'))
    year = next((int(text(y)) for y in root.findall('.//pub-date/year') if text(y).isdigit()), 0)
    names = []
    for group in root.findall('.//article-meta/contrib-group'):
        if group.get('content-type', 'author').lower() not in ['author', 'authors']:
            continue
        for contributor in group.findall('contrib'):
            if contributor.get('contrib-type', 'author').lower() != 'author':
                continue
            name = contributor.find('name')
            if name is None:
                name = contributor.find('string-name')
            author = ' '.join(filter(None, [text(name.find('surname')), text(name.find('given-names'))])) if name is not None else text(contributor.find('collab'))
            if author and author not in names:
                names.append(author)
    if not names or len(', '.join(names)) > 500:
        return None
    return dict(pmcid=pmcid, title=text(root.find('.//article-title')), authors=', '.join(names), year=year, doi=doi,
                url='https://doi.org/' + doi if doi else 'https://europepmc.org/article/PMC/' + pmcid,
                licence='CC0 1.0' if cc0 else 'CC BY 4.0', text=narrative, format='text', region='', evidenceType='traditional-report',
                attribution=permissions, locator='Narrative body paragraphs from ' + pmcid,
                adaptation='Dated Europe PMC reference snapshot. Narrative paragraphs normalized from licensed XML; tables, figures, and reference list excluded. First 75,000 characters retained. Review the source classification before saving.',
                rightsConfirmed=True, retrievedAt=datetime.datetime.fromtimestamp(cached.stat().st_mtime, datetime.timezone.utc).isoformat() if cached and cached.exists() else STAMP, xmlSha256=hashlib.sha256(raw).hexdigest(), mode='reference-snapshot')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, help='Optional previously downloaded Europe PMC XML directory')
    parser.add_argument('--literature-only', action='store_true')
    args = parser.parse_args()
    taxa = json.loads((ROOT/'data/taxa.json').read_text()) + ['Mentha spicata','Mentha × piperita','Chamaemelum nobile','Salvia rosmarinus','Rosmarinus officinalis','Acacia nilotica']
    values = json.loads((ROOT/'data/taxonomy-reference.json').read_text()).get('records', {}) if args.literature_only else {}
    if not args.literature_only:
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            for result in pool.map(taxonomy, sorted(set(taxa))):
                if result:
                    values[result[0]] = result[1]
        (ROOT/'data/taxonomy-reference.json').write_text(json.dumps(dict(retrievedAt=STAMP, provider='GBIF Species API v1', records=values), ensure_ascii=False, indent=2)+'\n')
    pmcs = ['PMC10424924', 'PMC11124858']
    papers = []
    for pmcid in dict.fromkeys(pmcs):
        try:
            result = article(pmcid, args.cache)
            if result:
                papers.append(result)
        except Exception as error:
            print('Article unavailable:', pmcid, type(error).__name__)
    (ROOT/'data/literature-reference.json').write_text(json.dumps(dict(retrievedAt=STAMP, provider='Europe PMC REST API', articles=papers), ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'taxonomyRecords':len(values),'licensedNarrativeSnapshots':len(papers),'retrievedAt':STAMP}))

if __name__ == '__main__':
    main()
