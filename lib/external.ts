import {InputError} from './validation.mjs';
import type {TaxonomyResult} from './types';
import taxonomyReference from '../data/taxonomy-reference.json';
import literatureReference from '../data/literature-reference.json';

async function externalJSON(url:string) {
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Citeflora/1.0 (ethnopharmacology research; github.com/adeelfalaksher900-creator/citeflora)'},signal:AbortSignal.timeout(12000)});
  if(!response.ok){console.warn('Research service response',new URL(url).hostname,response.status);throw new InputError('The research service is unavailable. Please try again.',502);}
  const text=await response.text();if(text.length>1500000)throw new InputError('The research service returned too much data.',502);
  return JSON.parse(text);
}
export async function taxonomyLookup(name:string):Promise<TaxonomyResult> {
  const cached=(taxonomyReference.records as Record<string,TaxonomyResult>)[name.trim().toLowerCase().replace(/ sp\.$/,'')];
  if(cached)return {...cached,query:name};
  const json=await externalJSON('https://api.gbif.org/v1/species/match?verbose=true&kingdom=Plantae&name='+encodeURIComponent(name));
  let acceptedName='';
  if(json.acceptedUsageKey){const accepted=await externalJSON('https://api.gbif.org/v1/species/'+Number(json.acceptedUsageKey));acceptedName=accepted.canonicalName||accepted.scientificName||'';}
  return {query:name,mode:'live',providerUrl:'https://api.gbif.org/v1/species/'+Number(json.usageKey||0),retrievedAt:new Date().toISOString(),usageKey:json.usageKey,acceptedUsageKey:json.acceptedUsageKey,
    scientificName:json.scientificName,canonicalName:json.canonicalName,acceptedScientificName:acceptedName||json.canonicalName,
    status:json.status,rank:json.rank,matchType:json.matchType,confidence:json.confidence,kingdom:json.kingdom,family:json.family,
    alternatives:(json.alternatives||[]).slice(0,5).map((a:{scientificName:string;usageKey:number})=>({scientificName:a.scientificName,usageKey:a.usageKey}))};
}
function referenceSearch(query:string) {
  const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>2);
  const results=literatureReference.articles.filter(p=>terms.some(t=>(p.title+' '+p.authors+' '+p.text).toLowerCase().includes(t))).map(p=>({
    id:p.pmcid,pmcid:p.pmcid,title:p.title,authors:p.authors,year:p.year,doi:p.doi,licence:p.licence,isOpenAccess:'Y',abstract:'',url:p.url,
  }));
  return {hitCount:results.length,results,retrievedAt:literatureReference.retrievedAt,mode:'reference-snapshot',scopeWarning:`Live Europe PMC search is unavailable. Searching a dated catalogue of ${literatureReference.articles.length} licensed narrative snapshot(s) only. Broad keyword matching; these are not global search totals.`};
}
export async function literatureSearch(query:string) {
  try {
    const json=await externalJSON('https://www.ebi.ac.uk/europepmc/webservices/rest/search?format=json&resultType=core&pageSize=8&query='+encodeURIComponent('('+query+') AND OPEN_ACCESS:Y'));
    return {hitCount:json.hitCount,retrievedAt:new Date().toISOString(),mode:'live',results:(json.resultList?.result||[]).map((p:{id:string;pmcid?:string;title:string;authorString:string;pubYear:string;doi?:string;license?:string;isOpenAccess?:string;abstractText?:string;source:string})=>({
      id:p.id,pmcid:p.pmcid,title:xmlText(p.title).replace(/<[^>]*>/g,''),authors:xmlText(p.authorString),year:p.pubYear,doi:p.doi||'',licence:p.license||'',
      isOpenAccess:p.isOpenAccess,abstract:(p.abstractText||'').replace(/<[^>]*>/g,' ').slice(0,1200),
      url:p.doi?'https://doi.org/'+p.doi:'https://europepmc.org/article/'+p.source+'/'+p.id,
    }))};
  } catch {return referenceSearch(query);}
}
function xmlText(value:string) {
  return value.replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(parseInt(n,16),0x10ffff)))
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g,m=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[m]||m)).replace(/\s+/g,' ').trim();
}
export async function openArticle(pmcid:string) {
  if(!/^PMC\d{1,10}$/.test(pmcid))throw new InputError('A valid Europe PMC full-text identifier is required.');
  const cached=literatureReference.articles.find(p=>p.pmcid===pmcid);
  if(cached)return {...cached,licenceUrl:cached.licence==='CC0 1.0'?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/licenses/by/4.0/',locator:cached.locator+'; reference snapshot prepared '+cached.retrievedAt};
  const response=await fetch('https://www.ebi.ac.uk/europepmc/webservices/rest/'+pmcid+'/fullTextXML',{signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new InputError('This full text is unavailable through the Europe PMC API.',502);
  const xml=await response.text();if(xml.length>3000000)throw new InputError('This article exceeds the supported import size. Import a permitted excerpt instead.');
  const permissions=xml.match(/<permissions\b[\s\S]*?<\/permissions>/i)?.[0]||'';
  const licence=permissions.match(/creativecommons\.org\/licenses\/by\/(\d\.\d)/i);
  const cc0=/creativecommons\.org\/publicdomain\/zero\//i.test(permissions);
  if(!licence&&!cc0)throw new InputError('Automatic import requires an explicit CC BY or CC0 licence in the article XML. Open the paper and import a permitted excerpt manually.');
  if(licence&&licence[1]!=='4.0')throw new InputError('Automatic import currently supports CC BY 4.0 and CC0 1.0. This paper uses another licence version. Import a permitted excerpt manually and record its exact terms.');
  const body=(xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]||'').replace(/<table-wrap\b[\s\S]*?<\/table-wrap>/gi,'').replace(/<fig\b[\s\S]*?<\/fig>/gi,'');
  const paragraphs=[...body.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map(m=>xmlText(m[1])).filter(Boolean);
  if(!paragraphs.length)throw new InputError('No supported narrative paragraphs were found. Import a permitted excerpt instead.');
  const full=paragraphs.join('\n\n');const text=full.slice(0,75000);
  const title=xmlText(xml.match(/<article-title\b[^>]*>([\s\S]*?)<\/article-title>/i)?.[1]||pmcid);
  const doi=xmlText(xml.match(/<article-id\b[^>]*pub-id-type="doi"[^>]*>([\s\S]*?)<\/article-id>/i)?.[1]||'');
  const authors=[...xml.matchAll(/<name\b[^>]*>\s*<surname>(.*?)<\/surname>\s*<given-names[^>]*>(.*?)<\/given-names>/gi)].slice(0,12).map(m=>xmlText(m[1])+' '+xmlText(m[2])).join(', ');
  const year=Number(xml.match(/<pub-date\b[\s\S]*?<year>(\d{4})<\/year>/i)?.[1]||0);
  return {title,authors,year,doi,url:doi?'https://doi.org/'+doi:'https://europepmc.org/article/PMC/'+pmcid,
    text,format:'text',licence:cc0?'CC0 1.0':'CC BY 4.0',licenceUrl:cc0?'https://creativecommons.org/publicdomain/zero/1.0/':'https://creativecommons.org/licenses/by/'+licence![1]+'/',
    region:'',evidenceType:'traditional-report',attribution:xmlText(permissions),locator:'Narrative body paragraphs imported from '+pmcid,
    adaptation:'Narrative paragraphs converted from Europe PMC XML. Tables, figures, and reference list excluded. Source offsets refer to the imported snapshot.'+(full.length>75000?' Only the first 75,000 characters were imported.':''),rightsConfirmed:true};
}
