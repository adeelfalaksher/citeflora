"""Verify the public API using one isolated workspace and original QA text.

No credentials or patient information. Session cookies remain in memory.
Run: python3 scripts/verify-hosted.py --url https://your-site.example
"""
import argparse,csv,hashlib,http.cookiejar,io,json,urllib.request
from pathlib import Path

parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);args=parser.parse_args()
base=args.url.rstrip('/');jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(route,method='GET',body=None):
    req=urllib.request.Request(base+'/api/'+route,data=json.dumps(body).encode() if body is not None else None,method=method,
        headers={'Origin':base,'Content-Type':'application/json','Accept':'application/json','User-Agent':'Citeflora-hosted-verification/1.0'})
    with client.open(req,timeout=25) as res:
        return res.status,res.headers,res.read().decode('utf-8-sig')
def data(route,method='GET',body=None):
    status,headers,text=call(route,method,body);return status,headers,json.loads(text)

status,headers,start=data('session','POST',{});assert status==201
assert len([c for c in jar if c.name=='citeflora_session'])==1 and 'HttpOnly' in headers.get('Set-Cookie','') and 'Secure' in headers.get('Set-Cookie','')
assert len(start['sources'])==2 and len(start['claims'])==75
text='Mentha spicata leaves were used for cough. Mint was used for headaches. Aloe vera was not used for burns.'
status,_,added=data('sources','POST',dict(title='Developer-owned hosted QA source',authors='Citeflora developer QA',text=text,rightsConfirmed=True,licence='Original content',evidenceType='traditional-report'))
assert status==201 and added['count']==3
source=next(s for s in added['workspace']['sources'] if s['id']==added['sourceId'])
claims=[c for c in added['workspace']['claims'] if c['sourceId']==source['id']]
assert source['contentHash']==hashlib.sha256(text.encode()).hexdigest()
assert all(source['text'][c['start']:c['end']]==c['quote'] for c in claims) # QA fixture is ASCII.
assert any('ambiguous-name' in c['flags'] for c in claims) and any(c['polarity']=='negative' for c in claims)
_,_,tax=data('taxonomy?name=Mentha%20spicata');assert tax['mode']=='reference-snapshot' and tax['usageKey']
claim=next(c for c in claims if c['plantName']=='Mentha spicata')
status,_,review=data('claims/'+claim['id'],'PATCH',dict(status='accepted',revision=0,reviewerNote='Hosted API QA compared the passage. Clinical validity was not assessed.',plantPart='leaf blade',preparation='Not stated in this passage'))
assert status==200
_,_,current=data('workspace');saved=next(c for c in current['claims'] if c['id']==claim['id'])
assert saved['status']=='accepted' and saved['revision']==1 and saved['review']['plantPart']=='leaf blade'
results={}
for format in ['json','csv','html']:
    status,headers,content=call('export?format='+format);assert status==200 and 'attachment' in headers.get('Content-Disposition','')
    if format=='json':
        archive=json.loads(content);assert len(archive['sources'])==3 and len(archive['claims'])==78
    elif format=='csv':
        rows=list(csv.DictReader(io.StringIO(content)));assert len(rows)==78 and 'reviewed_plant_part' in rows[0]
        assert any(r['reviewed_plant_part']=='leaf blade' and r['source_authors']=='Citeflora developer QA' for r in rows)
    else:assert 'Reviewed plant part: leaf blade' in content and 'Hosted API QA' in content
    results[format]={'status':status,'characters':len(content)}
status,_,paper=data('literature/import','POST',{'pmcid':'PMC11124858'});assert status==200 and paper['licence']=='CC BY 4.0' and len(paper['text'])>30000
report={'sessionStatus':201,'sessionCookieFlagsVerified':True,'starterSources':2,'starterCandidates':75,'qaImportCandidates':3,'sourceDigestVerified':True,'ambiguityAndNegationVerified':True,'reviewPersisted':True,'taxonomyMode':tax['mode'],'licensedNarrativePrepared':True,'exports':results,'scope':'Real hosted API and D1 checks. Browser file-dialog completion is a separate, unverified check.'}
Path('outputs').mkdir(exist_ok=True);Path('outputs/hosted-verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
