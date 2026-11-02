import corpusTaxa from '../data/taxa.json' with { type: 'json' };

export const ENGINE_VERSION = 'citeflora-rules-1.0.0';
export const MAX_SOURCE_LENGTH = 80000;
export const MAX_CLAIMS = 90;

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
  for(const [alias,candidates] of aliases) {
    const regex=new RegExp('(?<![\\p{L}\\p{N}])'+escapeRe(alias)+'(?![\\p{L}\\p{N}])','giu');
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
  if(typeof text!=='string'||text.length>MAX_SOURCE_LENGTH)throw new Error('Source must contain at most 80,000 characters.');
  const claims=[]; let truncated=false;
  segmentsLoop: for(const segment of segmentText(text,format)) {
    const columns=segment.text.split('|').map(x=>x.trim());
    const table=format==='table'&&columns.length===6;
    const plantText=table?columns[0]:segment.text;
    const plants=findPlants(plantText,text);
    const plantOffset=table?segment.text.indexOf(columns[0]):0;
    const useText=table?columns[5]:segment.text;
    const useOffset=table?segment.text.lastIndexOf('|')+1+segment.text.slice(segment.text.lastIndexOf('|')+1).search(/\S/):0;
    const uses=[];
    for(const [category,rule] of useRules) {
      const m=[...useText.matchAll(new RegExp(rule.source,rule.flags))][0];
      if(m)uses.push({category,term:m[0],start:useOffset+m.index,end:useOffset+m.index+m[0].length});
    }
    if(table&&plants.length&&!uses.length&&useText)uses.push({category:'Unmapped use',term:useText,start:useOffset,end:useOffset+useText.length});
    const negated=/\b(?:not (?:used|reported|effective)|never used|no evidence|no (?:benefit|effect)|did not|failed to)\b/i.test(segment.text);
    const speculative=/\b(?:may|might|could|hypothes\w*|potential\w*|suggest\w*)\b/i.test(segment.text);
    const multiple=!table&&plants.length>1;
    for(const plant of plants)for(const use of uses) {
      const flags=[];
      if(plant.candidates.length!==1)flags.push(plant.candidates.length?'ambiguous-name':'unresolved-name');
      if(/\b(?:sp\.?|spp\.?)\b/i.test(plant.name)||plant.candidates.some(p=>!p.includes(' ')))flags.push('genus-only');
      if(plant.kind==='common')flags.push('common-name');
      if(plant.kind==='abbreviation')flags.push('abbreviated-name');
      if(multiple)flags.push('multiple-plants');
      if(negated)flags.push('negative-mention');
      if(speculative)flags.push('speculative-language');
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
        flags,polarity:negated?'negative':speculative?'uncertain':'reported',
        evidenceType,engineVersion:ENGINE_VERSION,offsetEncoding:'UTF-16',
      });
      if(claims.length>=MAX_CLAIMS){truncated=true;break segmentsLoop;}
    }
    if(truncated)break;
  }
  return {claims,truncated,engineVersion:ENGINE_VERSION,segments:segmentText(text,format).length};
}

export function canonicalStudy(source) {
  return source.doi?source.doi.trim().replace(/^https?:\/\/(?:dx\.)?doi.org\//i,'').toLowerCase():source.contentHash||source.id;
}

export function evidenceGroups(sources,claims,{acceptedOnly=false}={}) {
  const bySource=new Map(sources.map(s=>[s.id,s])); const groups=new Map();
  for(const claim of claims) {
    if(claim.status==='rejected'||(acceptedOnly&&claim.status!=='accepted')||claim.polarity!=='reported'||claim.flags.includes('multiple-plants'))continue;
    const plant=claim.review?.resolvedName||claim.candidates.length===1&&claim.candidates[0]||claim.plantName;
    const use=claim.review?.reportedUse||claim.category;
    const key=plant+'\0'+use;
    if(!groups.has(key))groups.set(key,{plant,use,claims:[],studies:new Set(),regions:new Set()});
    const g=groups.get(key),source=bySource.get(claim.sourceId);
    if(!source)continue;
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
  const columns=['claim_id','review_status','plant_as_written','identity_candidates','reviewed_identity','reported_use','category','reviewed_use','plant_part','preparation','polarity','evidence_type','flags','source_title','doi','region','licence','source_hash','quote','span_start_utf16','span_end_utf16','reviewer_note','revision','engine_version'];
  const rows=claims.map(c=>{const s=bySource.get(c.sourceId)||{};return[c.id,c.status,c.plantName,c.candidates.join('; '),c.review?.resolvedName||'',c.reportedUse,c.category,c.review?.reportedUse||'',c.plantPart,c.preparation,c.polarity,c.evidenceType,c.flags.join('; '),s.title,s.doi,s.region,s.licence,s.contentHash,c.quote,c.start,c.end,c.reviewerNote,c.revision,c.engineVersion];});
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
