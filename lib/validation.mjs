import {reviewNoteFlags} from './engine.mjs';
export class InputError extends Error { constructor(message,status=400){super(message);this.status=status;} }
export const validEvidenceTypes=['traditional-report','historical-text','preclinical-study','clinical-study','review'];
export const validLicences=['CC BY 4.0','CC BY-SA 4.0','CC0 1.0','Public domain','Used with permission','Original content'];
export function field(value,name,max,{required=false}={}) {
  if(typeof value!=='string') {if(!required&&value==null)return '';throw new InputError(name+' must be text.');}
  const text=value.trim();
  if(text.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text))throw new InputError(name+' contains invalid characters or is too long.');
  if(required&&!text)throw new InputError(name+' is required.');
  return text;
}
export function normalizeDOI(value) {
  const doi=field(value,'DOI',220).replace(/^https?:\/\/(?:dx\.)?doi.org\//i,'').replace(/^doi:\s*/i,'');
  if(doi&&!/^10\.\d{4,9}\/[^\s<>"']{1,180}$/i.test(doi))throw new InputError('Enter a valid DOI, such as 10.3389/fphar.2023.1225580.');
  return doi.toLowerCase();
}
export function safeURL(value) {
  const raw=field(value,'Source URL',600);if(!raw)return '';
  let u;try{u=new URL(raw);}catch{throw new InputError('The source link must be a valid HTTPS URL.');}
  if(u.protocol!=='https:'||u.username||u.password)throw new InputError('Use an HTTPS source link without embedded credentials.');
  return u.href;
}
export function validateSource(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))throw new InputError('A source object is required.');
  if(body.rightsConfirmed!==true)throw new InputError('Confirm that you have permission to use this source.');
  const title=field(body.title,'Title',300,{required:true});
  const text=field(body.text,'Source text',80000,{required:true});
  if(text.length<20)throw new InputError('Add at least 20 characters of source text.');
  const authors=field(body.authors,'Authors',500),region=field(body.region,'Region',250);
  const doi=normalizeDOI(body.doi),url=safeURL(body.url);
  if(!validLicences.includes(body.licence))throw new InputError('Choose a supported licence or permission basis.');
  if(!validEvidenceTypes.includes(body.evidenceType))throw new InputError('Choose the source evidence type.');
  const year=Number(body.year)||0;
  if(!Number.isInteger(year)||year<0||year>new Date().getUTCFullYear()+1)throw new InputError('Enter a valid publication year.');
  const format=body.format==='table'?'table':'text';
  if(format==='table'&&!/^Botanical name\s*\|\s*Local name\s*\|\s*Plant parts\s*\|\s*Preparation\s*\|\s*Route\s*\|\s*Reported use\s*$/i.test(text.split('\n')[0]))throw new InputError('Use the six-column table template, or select narrative text.');
  if(format==='table'&&text.split('\n').slice(1).some(line=>line.trim()&&line.split('|').length!==6))throw new InputError('Each table row must have six columns.');
  return {title,text,authors,region,doi,url:url||(doi?'https://doi.org/'+doi:''),year,licence:body.licence,
    evidenceType:body.evidenceType,format,locator:field(body.locator,'Source location',300),attribution:field(body.attribution,'Attribution',2000),
    adaptation:field(body.adaptation,'Adaptation note',1500)||'Text supplied by the workspace visitor. Source offsets refer to this saved snapshot.'};
}
export function validateReview(body,claim) {
  if(!body||typeof body!=='object'||!['pending','accepted','rejected'].includes(body.status))throw new InputError('Choose a valid review decision.');
  if(!Number.isInteger(body.revision)||body.revision<0)throw new InputError('A valid claim revision is required.');
  const reviewerNote=field(body.reviewerNote,'Review note',2000);
  if(body.status==='accepted'&&claim.flags.some(f=>reviewNoteFlags.includes(f))&&reviewerNote.length<8)throw new InputError('Add a review note explaining how you handled the flagged uncertainty.');
  const resolvedName=field(body.resolvedName,'Reviewed identity',160);
  const reportedUse=field(body.reportedUse,'Reviewed use',250);
  const identityBasis=field(body.identityBasis,'Identity basis',800);
  if(resolvedName&&!identityBasis)throw new InputError('Describe the evidence for your identity decision.');
  return {status:body.status,revision:body.revision,reviewerNote,review:{resolvedName,reportedUse,identityBasis,
    plantPart:field(body.plantPart,'Reviewed plant part',200),preparation:field(body.preparation,'Reviewed preparation',300)},
    taxonomyQuery:field(body.taxonomyQuery,'Taxonomy query',160)};
}
