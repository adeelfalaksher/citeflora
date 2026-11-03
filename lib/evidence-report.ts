import type {Workspace} from './types';

export type DocumentFormat='pdf'|'docx'|'doc';
export type ReportBlock={kind:'title'|'heading'|'text'|'quote'|'meta';text:string;newPage?:boolean}|{kind:'fields';rows:[string,string][]};
export const reportNotice='Literature extraction records for research. Acceptance records an extraction review, not clinical validation of a treatment. Pending, rejected, negative and uncertain records retain their labels.';
const clean=(value:unknown)=>String(value??'').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,' ').trim();
const value=(x:unknown,fallback='Not supplied')=>clean(x)||fallback;

export function evidenceReport(data:Workspace,generatedAt=new Date().toISOString()):ReportBlock[]{
  const blocks:ReportBlock[]=[];
  const text=(kind:'title'|'heading'|'text'|'quote'|'meta',content:string,newPage=false)=>blocks.push({kind,text:clean(content),newPage});
  const fields=(rows:[string,unknown][])=>blocks.push({kind:'fields',rows:rows.map(([k,v])=>[k,value(v)])});
  const sourceNumbers=new Map(data.sources.map((s,i)=>[s.id,i+1]));
  text('meta','CITEFLORA / RESEARCH EVIDENCE');
  text('title','Evidence review report');
  text('text','Published sources, original passages and saved review decisions.');
  fields([['Generated (UTC)',generatedAt],['Engine',data.engineVersion],['Source snapshots',data.sources.length],['Candidate records',data.claims.length],['Review status',`${data.claims.filter(c=>c.status==='accepted').length} accepted / ${data.claims.filter(c=>c.status==='pending').length} pending / ${data.claims.filter(c=>c.status==='rejected').length} rejected`]]);
  text('quote',reportNotice);
  text('heading','How to read this report');
  text('text','Sources are numbered in the reference register. Each candidate records its source number, original extraction, reviewer corrections and unchanged supporting passage. A blank correction keeps the original uncertainty. UTF-16 offsets refer to the saved normalized text, and SHA-256 identifies that snapshot.');
  text('text','This is a formatted research report. File conversion and bounded English rules do not establish scientific accuracy. Check each passage against the original publication.');
  text('heading','Source register',true);
  for(const [i,s]of data.sources.entries()){
    text('heading',`[${i+1}] ${s.title}`);
    fields([['Authors',s.authors],['Year',s.year||'Not supplied'],['Region',s.region],['Evidence type',s.evidenceType],['DOI',s.doi],['Publication',s.url],['Licence / permission',s.licence],['Licence URL',s.licenceUrl],['Snapshot location',s.locator],['Attribution',s.attribution],['Adaptation',s.adaptation],['SHA-256',s.contentHash]]);
    if(s.truncated)text('quote','The candidate limit was reached for this source. Additional records might not have been proposed.');
  }
  text('heading','Candidate records',true);
  if(!data.claims.length)text('text','No candidate records were extracted. This does not establish the absence of reported plant uses.');
  for(const [i,c]of data.claims.entries()){
    const ref=sourceNumbers.get(c.sourceId);
    text('heading',`${String(i+1).padStart(3,'0')}. ${value(c.review?.resolvedName||c.plantName)} / ${value(c.review?.reportedUse||c.category)}`);
    text('meta',`Source [${ref??'?'}] / ${c.status.toUpperCase()} / polarity: ${c.polarity} / revision ${c.revision}`);
    fields([['Original plant name',c.plantName],['Identity candidates',c.candidates.join('; ')||'Unresolved'],['Original reported use',c.reportedUse],['Source use wording',c.sourceUse],['Original plant part',c.plantPart||'Not stated'],['Original preparation',c.preparation||'Not stated'],['Route',c.route||'Not stated'],['Reviewed identity',c.review?.resolvedName||'No correction recorded'],['Reviewed use',c.review?.reportedUse||'No correction recorded'],['Reviewed plant part',c.review?.plantPart||'No correction recorded'],['Reviewed preparation',c.review?.preparation||'No correction recorded'],['Uncertainty flags',c.flags.join('; ')||'None recorded']]);
    text('meta','SUPPORTING SOURCE PASSAGE');
    text('quote',c.quote);
    fields([['Passage offsets',`[${c.start}, ${c.end}) UTF-16`],['Plant offsets',`[${c.plantStart}, ${c.plantEnd}) UTF-16`],['Use offsets',`[${c.useStart}, ${c.useEnd}) UTF-16`],['Record engine',c.engineVersion],['Reviewer note',c.reviewerNote||'None recorded'],['Identity basis',c.review?.identityBasis||'None recorded'],['Snapshot SHA-256',data.sources.find(s=>s.id===c.sourceId)?.contentHash],['Last saved (UTC)',c.updatedAt],['Record identifier',c.id]]);
    if(c.review?.taxonomy){const t=c.review.taxonomy;fields([['Taxonomy reference',t.acceptedScientificName||t.canonicalName||t.scientificName],['Reference mode',t.mode||'live'],['Retrieved (UTC)',t.retrievedAt],['Provider',t.providerUrl],['Name-match score',`${t.confidence??'Unavailable'} / 100, not an efficacy or historical-identity score`]]);}
  }
  text('heading','Activity register',true);
  text('text',`The latest ${data.audit.length} workspace events are listed. Detailed review decisions appear with their candidate records above.`);
  for(const a of data.audit){const ref=a.sourceId?sourceNumbers.get(a.sourceId):undefined;text('text',`${a.createdAt} / ${a.action.replaceAll('-',' ')}${ref?` / source [${ref}]`:''}${a.claimId?` / record ${a.claimId}`:''}`);}
  return blocks;
}

export async function createEvidenceDocument(data:Workspace,format:DocumentFormat):Promise<Blob>{
  const blocks=evidenceReport(data);
  if(format==='pdf')return (await import('./report-pdf')).pdfReport(blocks);
  return (await import('./report-word')).wordReport(blocks,format);
}
