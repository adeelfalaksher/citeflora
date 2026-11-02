import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractClaims,findPlants,evidenceGroups,evidenceCSV,parseCSV,csvCell,segmentText} from '../lib/engine.mjs';
import corpus from '../data/corpus.json' with {type:'json'};

test('Extract a source-linked use without turning it into a clinical claim',()=>{
  const text='Participants used Mentha spicata leaves as an infusion for stomach complaints.';
  const {claims}=extractClaims(text);
  assert.equal(claims.length,1);assert.equal(claims[0].category,'Digestive complaints');
  assert.equal(claims[0].evidenceType,'traditional-report');
  assert.equal(text.slice(claims[0].plantStart,claims[0].plantEnd),'Mentha spicata');
  assert.equal(text.slice(claims[0].useStart,claims[0].useEnd),'stomach complaints');
});
test('Names in one sentence do not acquire uses from another',()=>{
  assert.equal(extractClaims('Mentha spicata grows here. The participants reported fever.').claims.length,0);
});
test('Ambiguous mint is never silently assigned to one species',()=>{
  const c=extractClaims('Mint leaves were used for cough.').claims[0];
  assert.equal(c.candidates.length,3);assert.ok(c.flags.includes('ambiguous-name'));
});
test('Negative mention retains negative polarity',()=>{
  const c=extractClaims('Aloe vera was not used for burns in this survey.').claims[0];
  assert.equal(c.polarity,'negative');assert.ok(c.flags.includes('negative-mention'));
});
test('A proposed future use remains uncertain',()=>{
  assert.equal(extractClaims('Curcuma longa might be investigated for joint pain.').claims[0].polarity,'uncertain');
});
test('Multiple plants and ailments do not become an assigned association',()=>{
  const cs=extractClaims('Mentha spicata and Allium sativum were mentioned for cough and fever.').claims;
  assert.ok(cs.length>0);assert.ok(cs.every(c=>c.flags.includes('multiple-plants')&&c.category==='Unassigned association'));
});
test('A genus-only record keeps its level of identification',()=>{
  const c=extractClaims('Plantago sp. leaves were used for wounds.').claims[0];
  assert.ok(c.flags.includes('genus-only'));assert.deepEqual(c.candidates,['Plantago']);
});
test('Longest alias wins without the word mint inside peppermint',()=>{
  const p=findPlants('Peppermint was reported.');assert.equal(p.length,1);assert.equal(p[0].name,'Peppermint');
});
test('Source offsets survive emoji and botanical abbreviations',()=>{
  const text='🌱 Notes. Hypericum perforatum L. flowers were used for wounds. The next sentence is separate.';
  const c=extractClaims(text).claims[0];assert.equal(text.slice(c.start,c.end),c.quote);
  assert.equal(text.slice(c.plantStart,c.plantEnd),'Hypericum perforatum');
  assert.equal(segmentText(text).length,3);
});
test('Botanical abbreviations require a unique full-name context',()=>{
  const text='Hypericum perforatum is listed. H. perforatum flowers were used for wounds.';
  const c=extractClaims(text).claims[0];assert.deepEqual(c.candidates,['Hypericum perforatum']);assert.ok(c.flags.includes('abbreviated-name'));
  assert.equal(findPlants('H. perforatum flowers.')[0].candidates.length,0);
});
test('Table uses do not leak from another cell',()=>{
  const t='Botanical name | Local name | Plant parts | Preparation | Route | Reported use\nAllium cepa | Fever herb | Bulbs | Fresh | Topical | Wounds';
  const cs=extractClaims(t,{format:'table'}).claims;assert.equal(cs.length,1);assert.equal(cs[0].category,'Wounds');
});
test('Unknown names require review rather than receiving an invented taxonomy',()=>{
  const c=extractClaims('Salvia fictitia leaves were reported for cough.').claims[0];
  assert.deepEqual(c.candidates,[]);assert.ok(c.flags.includes('unresolved-name'));
});
test('Same DOI is one independent study even across excerpts',()=>{
  const base=extractClaims('Mentha spicata leaves were used for cough.').claims[0];
  const sources=[{id:'a',doi:'10.1234/ABC'},{id:'b',doi:'https://doi.org/10.1234/abc'}];
  const cs=[{...base,sourceId:'a',status:'accepted'},{...base,sourceId:'b',status:'pending'}];
  const gs=evidenceGroups(sources,cs);assert.equal(gs.length,1);assert.equal(gs[0].studies.length,1);assert.equal(gs[0].claims.length,2);
  assert.equal(evidenceGroups(sources,cs,{acceptedOnly:true})[0].claims.length,1);
});
test('Negative and rejected records are excluded from positive association map',()=>{
  const base=extractClaims('Aloe vera was not used for burns.').claims[0];
  assert.deepEqual(evidenceGroups([{id:'a'}],[{...base,sourceId:'a',status:'accepted'}]),[]);
});
test('CSV export guards spreadsheet formulas and escapes quotes',()=>{
  assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
  const c=extractClaims('Aloe vera was used for burns.').claims[0];
  const csv=evidenceCSV([{id:'a',title:'=malicious',contentHash:'abc'}],[{...c,sourceId:'a',id:'x',status:'pending',revision:0}]);
  assert.ok(csv.includes("'=malicious"));assert.ok(csv.includes('span_start_utf16'));
});
test('Quoted CSV imports preserve commas and reject unexpected schemas',()=>{
  const csv='Botanical name,Local name,Plant parts,Preparation,Route,Reported use\nAllium cepa,Onion,Bulbs,"Fresh, crushed",External,Wounds';
  assert.ok(parseCSV(csv).includes('Fresh, crushed'));assert.throws(()=>parseCSV('name,use\nx,y'));
});
test('Every corpus claim has valid source and entity spans',()=>{
  for(const s of corpus){
    const {claims,truncated}=extractClaims(s.text,s);assert.ok(claims.length>0);assert.equal(truncated,false);
    for(const c of claims){assert.equal(s.text.slice(c.start,c.end),c.quote);assert.equal(s.text.slice(c.plantStart,c.plantEnd),c.plantName);assert.equal(s.text.slice(c.useStart,c.useEnd),c.reportedUse);}
  }
});
test('Reject unbounded inputs',()=>{assert.throws(()=>extractClaims('x'.repeat(80001)));});

test('Plural headaches retain the ambiguous mint identity in an imported narrative',()=>{
  const result=extractClaims('Mentha spicata leaves were used for cough. Mint was used for headaches. Aloe vera was not used for burns.');
  assert.equal(result.claims.length,3);const mint=result.claims.find(c=>c.plantName==='Mint');assert.equal(mint.category,'Pain');assert.ok(mint.flags.includes('ambiguous-name'));assert.equal(mint.candidates.length,3);assert.equal(result.claims.find(c=>c.plantName==='Aloe vera').polarity,'negative');
});
