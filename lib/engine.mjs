import corpusTaxa from '../data/taxa.json' with { type: 'json' };

export const ENGINE_VERSION = 'citeflora-rules-1.0.2';
export const MAX_SOURCE_LENGTH = 80000;
export const MAX_CLAIMS = 90;
export const MAX_PASSAGE_LENGTH = 6000;
export class ExtractionInputError extends Error {}
export const reviewNoteFlags=['ambiguous-name','unresolved-name','genus-only','multiple-plants','negative-mention','speculative-language','unmapped-use','adverse-effect-context','mixed-polarity','relation-unresolved','complex-relation'];

const extra = ['Mentha spicata','Mentha longifolia','Mentha × piperita','Matricaria chamomilla','Chamaemelum nobile','Salvia rosmarinus','Rosmarinus officinalis','Vachellia nilotica','Acacia nilotica','Azadirachta indica','Ocimum tenuiflorum','Ocimum basilicum','Curcuma longa','Zingiber officinale','Withania somnifera','Glycyrrhiza glabra','Senna alexandrina','Cassia angustifolia','Plantago major','Plantago lanceolata','Urtica dioica','Quercus cerris','Quercus coccifera','Calendula officinalis','Foeniculum vulgare','Aloe vera','Aloe barbadensis','Allium sativum','Allium cepa','Hypericum perforatum','Melissa officinalis','Malva sylvestris','Artemisia absinthium','Punica granatum','Berberis lycium','Viola canescens','Justicia adhatoda','Hylotelephium spectabile','Morus nigra','Laurus nobilis','Olea europaea'];
export const taxa = [...new Set([...corpusTaxa, ...extra])].sort();
const aliases = new Map(taxa.map(name=>[name,[name]]));
const knownGenera = new Set(taxa.map(name=>name.split(' ')[0]));
for (const [name, candidates] of [
  ['mint',['Mentha spicata','Mentha longifolia','Mentha × piperita']],
  ['chamomile',['Matricaria chamomilla','Chamaemelum nobile']],
  ['camomile',['Matricaria chamomilla','Chamaemelum nobile']],
  ['spearmint',['Mentha spicata']],['peppermint',['Mentha × piperita']],
  ['garlic',['Allium sativum']],['onion',['Allium cepa']],['fennel',['Foeniculum vulgare']],
  ['rosemary',['Salvia rosmarinus']],['lemon balm',['Melissa officinalis']],
  ["St John's wort",['Hypericum perforatum']],["St. John's wort",['Hypericum perforatum']],
  ['turmeric',['Curcuma longa']],['ginger',['Zingiber officinale']],['neem',['Azadirachta indica']],
  ['ashwagandha',['Withania somnifera']],['pomegranate',['Punica granatum']],
  ['Pournari',['Quercus cerris','Quercus coccifera']],['Plantago sp.',['Plantago']],
  ['Matricaria recutita',['Matricaria chamomilla']],['Chamomilla recutita',['Matricaria chamomilla']],
  ['Acacia nilotica',['Vachellia nilotica']],['Aloe barbadensis',['Aloe vera']],
  ['Rosmarinus officinalis',['Salvia rosmarinus']],['Cassia angustifolia',['Senna alexandrina']],
]) aliases.set(name,candidates);

const useRules = [
  ['Wounds',/\b(?:wound(?:s| healing)?|cuts?)\b/gi],
  ['Burns',/\bburns?\b/gi],['Bruises',/\b(?:bruises?|contusions?)\b/gi],
  ['Swelling',/\b(?:[oe]+demas?|swelling)\b/gi],['Skin inflammation',/\b(?:skin|nail|eye) inflammation\b/gi],
  ['Skin conditions',/\b(?:skin diseases?|skin ailments?|dermatosis|eczema|psoriasis|acne|calluses?|warts?|furuncles?|boils?|spots?)\b/gi],
  ['Insect bites',/\b(?:insect (?:bites?|stings?)|bee stings?|animal bites?)\b/gi],
  ['Irritation',/\b(?:irritations?|throat irritation)\b/gi],
  ['Antiseptic use',/\b(?:antiseptic|antifungal|fungal dermatosis)\b/gi],
  ['Digestive complaints',/\b(?:stomach(?:ache| ailments?| disorders?| complaints?| pain)?|gastrointestinal (?:ailments?|disorders?)|digestive (?:disorders?|complaints?))\b/gi],
  ['Diarrhoea',/\b(?:diarrh[oe]+a|dysentery)\b/gi],['Constipation',/\b(?:constipation|laxative)\b/gi],
  ['Respiratory complaints',/\b(?:cough|asthma|bronchitis|cold|sore throat)\b/gi],
  ['Fever',/\bfevers?\b/gi],['Pain',/\b(?:toothaches?|earaches?|headaches?|analgesic|muscular pain|joint pain|pain)\b/gi],
  ['Mouth sores',/\b(?:aphthae|mouth sores?|mouth infections?)\b/gi],
  ['Other reported use',/\b(?:jaundice|haemorrhoids?|hemorrhoids?|nervous disorders?|alopecia|haemostatic|herpes)\b/gi],
];
const stopGenera = new Set('The This These Those That There Their Our Your Its For From With Without When Where What Which While During However Although Among Between Before After Botanical Scientific Local Plant Reported Traditional Clinical Fresh Leaves Seeds Results Table Source Skin Mount Tehsil District Copyright Creative Patients Earlier Recent Further Other Several Most Many Some All No Not He She They We'.split(' '));
const escapeRe = s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const aliasPatterns=[...aliases].map(([alias,candidates])=>({alias,candidates,regex:new RegExp('(?<![\\p{L}\\p{N}])'+escapeRe(alias)+'(?![\\p{L}\\p{N}])','giu')}));

function findUses(text) {
  return useRules.flatMap(([category,rule])=>{
    const match=[...text.matchAll(rule)][0];
    return match?[{category,term:match[0],start:match.index,end:match.index+match[0].length}]:[];
  });
}

// Conservative sentence-level screening. Mixed clauses require a human to pair them.
function relationContext(text,table,useCount) {
  const flags=[];
  const negated=/\b(?:not(?!\s+only\b)|never|neither|cannot|no (?:evidence|benefit|effect|participants?|informants?|respondents?|patients?|one)|failed to|lack(?:s|ed)? (?:of )?evidence|(?:did|does|do|was|were|is|are|ca|could|should|would|wo)n['’]t)\b/i.test(text);
  const speculative=/\b(?:may|might|could|hypothes\w*|potential\w*|suggest\w*)\b/i.test(text);
  const adverse=/\b(?:adverse|side effects?|toxic(?:ity)?)\b/i.test(text)||!table&&/\b(?:caus(?:e[sd]?|ing)|induc(?:e[sd]?|ing)|allerg(?:y|ic|ies))\b/i.test(text);
  const relation=table||/\b(?:treat(?:s|ed|ing|ment)?|remed(?:y|ies)|alleviat(?:e[sd]?|ing)|reliev(?:e[sd]?|ing)|cur(?:e[sd]?|ing))\b|\b(?:us(?:e[sd]?|ing)|administer(?:ed|ing)?|taken|consum(?:e[sd]?|ing)|recommend(?:ed|s)?|employ(?:ed|s)?)\b[^.!?]{0,160}\b(?:for|against|to treat|to relieve)\b|\bappl(?:y|ies|ied|ying)\b[^.!?]{0,120}\b(?:to|on|for)\b|\b(?:for|against)\b[^.!?]{0,120}\b(?:used|taken|applied)\b/i.test(text);
  const mixed=negated&&useCount>1;
  if(negated)flags.push('negative-mention');
  if(speculative)flags.push('speculative-language');
  if(adverse)flags.push('adverse-effect-context');
  if(mixed)flags.push('mixed-polarity');
  if(!relation&&!negated&&!adverse)flags.push('relation-unresolved');
  const complex=!table&&/\b(?:whereas|although|however)\b|\bbut\b(?!\s+also\b)/i.test(text);
  if(complex)flags.push('complex-relation');
  const polarity=mixed||complex||speculative||adverse||!relation&&!negated?'uncertain':negated?'negative':'reported';
  return {flags,polarity};
}

export function segmentText(text, format='text') {
  const segments=[];
  for (const line of text.matchAll(/[^\n]+/g)) {
    if (format==='table') {
      if (/^Botanical name\s*\|/i.test(line[0])) continue;
      segments.push({text:line[0],start:line.index}); continue;
    }
    // Mask abbreviation/decimal punctuation without changing UTF-16 offsets.
    const masked=line[0].replace(/\b(?:sp|spp|subsp|var|L|Mill|DC|Wall|Burm|St)\./g,m=>m.slice(0,-1)+'·')
      .replace(/\b[A-Z]\.(?=\s+[a-z])/g,m=>m.slice(0,-1)+'·')
      .replace(/(?<=\d)\.(?=\d)/g,'·');
    for(const span of masked.matchAll(/[^.!?]+(?:[.!?]+|$)/g)) {
      const raw=line[0].slice(span.index,span.index+span[0].length);
      const trim=raw.length-raw.trimStart().length;
      if(raw.trim())segments.push({text:raw.trim(),start:line.index+span.index+trim});
    }
  }
  return segments;
}

export function findPlants(text, context='') {
  const hits=[];
  for(const {alias,candidates,regex} of aliasPatterns) {
    for(const m of text.matchAll(regex))hits.push({name:m[0],start:m.index,end:m.index+m[0].length,candidates,kind:alias.includes(' ')?'scientific':'common'});
  }
  // Unknown botanical-looking names are candidates, never trusted identifications.
  for(const m of text.matchAll(/\b([A-Z][a-z]{2,})\s+(?:[a-z][a-z-]{2,}|sp\.)\b/g)) {
    if(knownGenera.has(m[1])&&!stopGenera.has(m[1])&&!hits.some(h=>m.index<h.end&&m.index+m[0].length>h.start))hits.push({name:m[0],start:m.index,end:m.index+m[0].length,candidates:[],kind:'uncatalogued'});
  }
  // Expand a genus initial only when a unique full name occurs in this source.
  for(const m of text.matchAll(/\b([A-Z])\.\s+([a-z][a-z-]{2,})\b/g)) {
    const candidates=taxa.filter(t=>t.startsWith(m[1])&&t.split(' ').at(-1)===m[2]&&new RegExp(escapeRe(t),'i').test(context));
    hits.push({name:m[0],start:m.index,end:m.index+m[0].length,candidates,kind:'abbreviation'});
  }
  hits.sort((a,b)=>(b.end-b.start)-(a.end-a.start)||a.start-b.start);
  const selected=[];
  for(const h of hits)if(!selected.some(x=>h.start<x.end&&h.end>x.start))selected.push(h);
  return selected.sort((a,b)=>a.start-b.start);
}

export function extractClaims(text,{format='text',evidenceType='traditional-report'}={}) {
  if(typeof text!=='string'||text.length>MAX_SOURCE_LENGTH)throw new ExtractionInputError('Source must contain at most 80,000 characters.');
  const segments=segmentText(text,format);
  if(segments.some(s=>s.text.length>MAX_PASSAGE_LENGTH))throw new ExtractionInputError('A sentence or table-row passage exceeds 6,000 characters. Use a shorter excerpt with sentence punctuation.');
  const claims=[]; let truncated=false;
  segmentsLoop: for(const segment of segments) {
    const columns=segment.text.split('|').map(x=>x.trim());
    const table=format==='table'&&columns.length===6;
    const useText=table?columns[5]:segment.text;
    const useOffset=table?segment.text.lastIndexOf('|')+1+segment.text.slice(segment.text.lastIndexOf('|')+1).search(/\S/):0;
    const uses=findUses(useText).map(u=>({...u,start:useOffset+u.start,end:useOffset+u.end}));
    if(!table&&!uses.length)continue;
    const plantText=table?columns[0]:segment.text;
    const plants=findPlants(plantText,text);
    const plantOffset=table?segment.text.indexOf(columns[0]):0;
    if(table&&plants.length&&!uses.length&&useText)uses.push({category:'Unmapped use',term:useText,start:useOffset,end:useOffset+useText.length});
    const context=relationContext(useText,table,uses.length);
    const multiple=!table&&plants.length>1;
    for(const plant of plants)for(const use of uses) {
      const flags=[...context.flags];
      if(plant.candidates.length!==1)flags.push(plant.candidates.length?'ambiguous-name':'unresolved-name');
      if(/\b(?:sp\.?|spp\.?)\b/i.test(plant.name)||plant.candidates.some(p=>!p.includes(' ')))flags.push('genus-only');
      if(plant.kind==='common')flags.push('common-name');
      if(plant.kind==='abbreviation')flags.push('abbreviated-name');
      if(multiple)flags.push('multiple-plants');
      if(use.category==='Unmapped use')flags.push('unmapped-use');
      if(table&&/^(?:[A-Z]{2,3})(?:,\s*[A-Z]{2,3})*$/.test(columns[2]))flags.push('source-abbreviations');
      const part=table?columns[2]:segment.text.match(/\b(?:leaves|leaf|roots?|rhizomes?|bulbs?|fruits?|flowers?|seeds?|bark|aerial parts?|whole plant)\b/i)?.[0]||'';
      const preparation=table?columns[3]:segment.text.match(/\b(?:decoction|infusion|powder|juice|cataplasm|oil|paste|tea|extract|fresh)\b/i)?.[0]||'';
      const plantStart=segment.start+plantOffset+plant.start;
      claims.push({
        plantName:plant.name, candidates:plant.candidates, nameKind:plant.kind,
        category:multiple?'Unassigned association':use.category, reportedUse:use.term,
        plantPart:part, preparation, route:table?columns[4]:'',
        sourceUse:table?columns[5]:use.term,
        quote:segment.text, start:segment.start, end:segment.start+segment.text.length,
        plantStart,plantEnd:plantStart+plant.name.length,
        useStart:segment.start+use.start,useEnd:segment.start+use.end,
        flags,polarity:context.polarity,
        evidenceType,engineVersion:ENGINE_VERSION,offsetEncoding:'UTF-16',
      });
      if(claims.length>=MAX_CLAIMS){truncated=true;break segmentsLoop;}
    }
    if(truncated)break;
  }
  return {claims,truncated,engineVersion:ENGINE_VERSION,segments:segments.length};
}

export function canonicalStudy(source) {
  return source.doi?source.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi.org\//i,'').toLowerCase():source.contentHash||source.id;
}

export function evidenceGroups(sources,claims,{acceptedOnly=false}={}) {
  const bySource=new Map(sources.map(s=>[s.id,s])); const groups=new Map();
  for(const claim of claims) {
    if(claim.status==='rejected'||(acceptedOnly&&claim.status!=='accepted')||claim.polarity!=='reported'||claim.flags.includes('multiple-plants'))continue;
    const source=bySource.get(claim.sourceId);
    if(!source)continue;
    // Apply current relation safeguards to older stored records without rewriting their provenance.
    const context=source.format==='table'?claim.sourceUse:claim.quote;
    if(relationContext(context,source.format==='table',findUses(context).length).polarity!=='reported')continue;
    const plant=claim.review?.resolvedName||claim.candidates.length===1&&claim.candidates[0]||claim.plantName;
    const use=claim.review?.reportedUse||claim.category;
    const key=plant+'\0'+use;
    if(!groups.has(key))groups.set(key,{plant,use,claims:[],studies:new Set(),regions:new Set()});
    const g=groups.get(key);
    g.claims.push(claim);g.studies.add(canonicalStudy(source));if(source.region)g.regions.add(source.region);
  }
  return [...groups.values()].map(g=>({...g,studies:[...g.studies],regions:[...g.regions]})).sort((a,b)=>b.studies.length-a.studies.length||b.claims.length-a.claims.length||a.plant.localeCompare(b.plant));
}

export function csvCell(value) {
  let s=String(value??'');
  if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export function evidenceCSV(sources,claims) {
  const bySource=new Map(sources.map(s=>[s.id,s]));
  const columns=['claim_id','review_status','plant_as_written','identity_candidates','reviewed_identity','reported_use','category','reviewed_use','plant_part','preparation','polarity','evidence_type','flags','source_title','doi','region','licence','source_hash','quote','span_start_utf16','span_end_utf16','reviewer_note','revision','engine_version','reviewed_plant_part','reviewed_preparation','identity_basis','taxonomy_mode','taxonomy_retrieved_at','source_authors','source_year','source_url','licence_url','source_attribution','source_locator','source_adaptation'];
  const rows=claims.map(c=>{const s=bySource.get(c.sourceId)||{};return[c.id,c.status,c.plantName,c.candidates.join('; '),c.review?.resolvedName||'',c.reportedUse,c.category,c.review?.reportedUse||'',c.plantPart,c.preparation,c.polarity,c.evidenceType,c.flags.join('; '),s.title,s.doi,s.region,s.licence,s.contentHash,c.quote,c.start,c.end,c.reviewerNote,c.revision,c.engineVersion,c.review?.plantPart||'',c.review?.preparation||'',c.review?.identityBasis||'',c.review?.taxonomy?.mode||'',c.review?.taxonomy?.retrievedAt||'',s.authors||'',s.year||'',s.url||'',s.licenceUrl||'',s.attribution||'',s.locator||'',s.adaptation||''];});
  return '\uFEFF'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
}
export function parseCSV(input) {
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if(ch==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw new Error('CSV has an unclosed quoted field.');
  row.push(cell);if(row.some(c=>c.trim()))rows.push(row);
  const expected=['botanical name','local name','plant parts','preparation','route','reported use'];
  if(rows[0]?.length!==6||rows[0].some((c,i)=>c.replace(/^\uFEFF/,'').trim().toLowerCase()!==expected[i]))throw new Error('Use the six-column CSV template: Botanical name, Local name, Plant parts, Preparation, Route, Reported use.');
  if(rows.some(r=>r.length!==6))throw new Error('Every CSV row must contain six fields.');
  return rows.map(r=>r.map(c=>c.trim().replace(/[\r\n|]+/g,' ')).join(' | ')).join('\n');
}

export const lexiconSize=aliases.size;
