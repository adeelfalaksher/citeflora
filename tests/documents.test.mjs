import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'vite';
import {PDFDocument} from 'pdf-lib';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import WordExtractor from 'word-extractor';
import {extractClaims} from '../lib/engine.mjs';
import docToText from '../lib/vendor/jsdoc/docToText.cjs';
import textToDoc from '../lib/vendor/jsdoc/textToDoc.cjs';

let report,reader,pdfReport;
const corpus=JSON.parse(readFileSync('data/corpus.json','utf8'));
const sources=corpus.map((s,i)=>({...s,id:'source-'+i}));
const claims=sources.flatMap(s=>extractClaims(s.text,s).claims.map((c,i)=>({...c,sourceId:s.id,id:s.id+'-'+i,status:'pending',revision:0,reviewerNote:'',updatedAt:'2026-11-03T12:00:00Z'})));
claims[0]={...claims[0],status:'accepted',revision:1,reviewerNote:'Checked the unchanged source passage.',review:{plantPart:'leaf blade',identityBasis:'Name remains source-reported.'}};
const workspace={sources,claims,audit:[],createdAt:'2026-11-03T12:00:00Z',workspaceId:'test',engineVersion:'citeflora-rules-1.0.2'};
const sample='Mentha spicata leaves were used for cough. Aloe vera was not used for burns.';
before(async()=>{
  await build({configFile:false,logLevel:'error',build:{ssr:true,outDir:'outputs/document-tests',emptyOutDir:true,rollupOptions:{input:{report:path.resolve('lib/evidence-report.ts'),reader:path.resolve('lib/document-import.ts'),pdf:path.resolve('lib/report-pdf.ts')},output:{format:'es',entryFileNames:'[name].mjs'}}}});
  report=await import(pathToFileURL(path.resolve('outputs/document-tests/report.mjs')));
  reader=await import(pathToFileURL(path.resolve('outputs/document-tests/reader.mjs')));
  ({pdfReport}=await import(pathToFileURL(path.resolve('outputs/document-tests/pdf.mjs'))));
  mkdirSync('outputs/document-fixtures',{recursive:true});
});
test('Formatted reports retain all source hashes, original fields and separate saved corrections',()=>{
  const blocks=report.evidenceReport(workspace,'2026-11-03T12:00:00Z'),text=JSON.stringify(blocks);
  assert.equal(blocks.filter(b=>b.kind==='heading'&&/^\d{3}\./.test(b.text)).length,75);
  for(const s of sources)assert.ok(text.includes(s.contentHash));
  for(const x of ['Original plant part','Reviewed plant part','leaf blade','Checked the unchanged source passage.','UTF-16','not clinical validation'])assert.ok(text.includes(x),x);
});
test('PDF export is a real, embedded-font, paginated A4 document',async()=>{
  const blob=await pdfReport(report.evidenceReport(workspace),{regular:readFileSync('public/document-assets/DejaVuSans.ttf'),bold:readFileSync('public/document-assets/DejaVuSans-Bold.ttf')});
  const bytes=new Uint8Array(await blob.arrayBuffer());assert.equal(blob.type,'application/pdf');assert.equal(new TextDecoder().decode(bytes.slice(0,5)),'%PDF-');
  const pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>5);assert.equal(pdf.getTitle(),'Citeflora evidence review report');
  assert.ok(pdf.getPages().every(p=>Math.abs(p.getWidth()-595.28)<1));writeFileSync('outputs/document-fixtures/Citeflora-Evidence.pdf',bytes);
});
test('DOCX export has native Word tables, page fields and correctly escaped content',async()=>{
  const blob=await report.createEvidenceDocument(workspace,'docx'),bytes=new Uint8Array(await blob.arrayBuffer()),files=unzipSync(bytes),xml=strFromU8(files['word/document.xml']);
  assert.ok(xml.includes('<w:tbl>'));assert.ok(xml.includes('leaf blade'));assert.ok(xml.includes(sources[0].contentHash));assert.ok(xml.includes('<w:pgSz'));assert.ok(Object.keys(files).some(k=>/^word\/footer/.test(k)));
  assert.ok(Object.entries(files).filter(([k])=>/^word\/footer/.test(k)).some(([,v])=>strFromU8(v).includes('PAGE')));
  assert.ok(!Object.keys(files).some(k=>/vbaProject|activeX/.test(k)));writeFileSync('outputs/document-fixtures/Citeflora-Evidence.docx',bytes);
  const small=await report.createEvidenceDocument({...workspace,claims:[claims[0]]},'docx');
  const imported=await reader.readSourceDocument(new File([small],'report.docx'));assert.ok(imported.text.includes('leaf blade'));assert.ok(imported.text.includes('Vitasović'));
});
test('Legacy DOC is genuine OLE Word binary, independently readable with styled tables',async()=>{
  const blob=await report.createEvidenceDocument(workspace,'doc'),bytes=new Uint8Array(await blob.arrayBuffer());
  assert.deepEqual([...bytes.slice(0,8)],[0xD0,0xCF,0x11,0xE0,0xA1,0xB1,0x1A,0xE1]);
  const doc=await new WordExtractor().extract(Buffer.from(bytes));for(const s of ['leaf blade','Vitasović','Checked the unchanged source passage.',sources[0].contentHash])assert.ok(doc.getBody().includes(s),s);
  assert.ok(docToText(bytes).includes('Original plant part'));writeFileSync('outputs/document-fixtures/Citeflora-Evidence.doc',bytes);
});
test('Text, six-column CSV and JSON imports preserve source content and attribution',async()=>{
  for(const ext of ['txt','md','text'])assert.equal((await reader.readSourceDocument(new File([sample],'source.'+ext))).text,sample);
  const csv='Botanical name,Local name,Plant parts,Preparation,Route,Reported use\nMentha spicata,Mint,Leaves,Infusion,Oral,Cough\n';
  const table=await reader.readSourceDocument(new File([csv],'source.csv'));assert.equal(table.format,'table');assert.ok(table.text.includes('Mentha spicata'));
  const json=JSON.stringify({text:sample,title:'Attributed source',authors:'Example Author',rightsConfirmed:true});
  const source=await reader.readSourceDocument(new File([json],'source.json'));assert.equal(source.text,sample);assert.equal(source.authors,'Example Author');assert.equal(source.rightsConfirmed,undefined);
});
test('HTML import extracts visible source text without scripts, styles or remote loads',async()=>{
  const html='<html><head><title>Source title</title><style>bad-css</style></head><body><p>'+sample+'</p><script>bad-script</script><p hidden>hidden-use</p><img src="https://unrelated.example/pixel"></body></html>';
  const source=await reader.readSourceDocument(new File([html],'source.html'));assert.equal(source.title,'Source title');assert.equal(source.text,sample);assert.ok(!source.text.includes('bad-'));
});
test('Legacy DOC imports retain Unicode body text and reject invalid compound-file bounds',async()=>{
  const bytes=textToDoc(sample+' Vitasović-Kosić.'),source=await reader.readSourceDocument(new File([bytes],'source.doc'));assert.ok(source.text.includes('Vitasović-Kosić'));
  const bad=bytes.slice();new DataView(bad.buffer).setUint32(72,0xFFFFFFFF,true);assert.equal(docToText(bad),null);
  await assert.rejects(reader.readSourceDocument(new File(['wrong format'],'source.doc')),/not a readable DOC/);
});
test('Unreadable, unsupported, oversized, malformed and ambiguous multi-source files fail explicitly',async()=>{
  await assert.rejects(reader.readSourceDocument(new File(['x'],'source.exe')),/Choose PDF/);
  await assert.rejects(reader.readSourceDocument(new File(['x'.repeat(250001)],'source.txt')),/250 KB/);
  await assert.rejects(reader.readSourceDocument(new File(['x'.repeat(80001)],'source.txt')),/80,000/);
  await assert.rejects(reader.readSourceDocument(new File(['{"sources":[{},{}]}'],'source.json')),/multiple sources/);
  await assert.rejects(reader.readSourceDocument(new File(['{broken'],'source.json')),/JSON file is invalid/);
  await assert.rejects(reader.readSourceDocument(new File([new Uint8Array([0xff,0xfe])],'source.txt')),/UTF-8/);
  const zip=zipSync({'word/document.xml':strToU8('x'.repeat(5_000_001))});await assert.rejects(reader.readSourceDocument(new File([zip],'source.docx')),/expanded Word document/);
});
