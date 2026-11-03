'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {BookOpen,Check,X,FileText,ArrowUpRight} from 'lucide-react';
import type {Claim,Source,Workspace} from '../lib/types';
export const evidenceLabels:Record<string,string>={'traditional-report':'Traditional-use report','historical-text':'Historical text','preclinical-study':'Preclinical study','clinical-study':'Clinical study','review':'Literature review'};
export const flagLabels:Record<string,string>={'ambiguous-name':'Ambiguous name','unresolved-name':'Unresolved name','genus-only':'Genus-level identity','multiple-plants':'Several plants in passage','negative-mention':'Negative wording','speculative-language':'Speculative statement','unmapped-use':'Unmapped use','common-name':'Common name','abbreviated-name':'Abbreviated name','source-abbreviations':'Source abbreviations','adverse-effect-context':'Possible adverse effect, not a therapeutic use','mixed-polarity':'Mixed positive and negative wording','relation-unresolved':'No supported use relation','complex-relation':'Complex relation needs review'};
export const short=(s:Source|undefined)=>s?.shortTitle||s?.title||'Source';
export const displayPlant=(c:Claim)=>c.review?.resolvedName||(c.candidates.length===1?c.candidates[0]:c.plantName);
export async function request<T=Workspace>(path:string,options:RequestInit={}):Promise<T> {
  const response=await fetch('/api/'+path,{...options,credentials:'same-origin',headers:{...(options.method?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data:unknown=await response.json();if(!response.ok)throw new Error((data&&typeof data==='object'&&'error' in data&&typeof data.error==='string'?data.error:'')||'The request failed. Please try again.');return data as T;
}
export function Mark(){return <svg width="31" height="34" viewBox="0 0 31 34" fill="none" aria-hidden="true"><path d="M15.5 29V13M15.5 21C6 22 2 16 3 7c8-1 12 4 12.5 10M16 16C15 7 20 2 28 2c1 9-3 15-12 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M5 30h21M9 33h13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
export function Button({children,onClick,primary=false,disabled=false,type='button'}:{children:ReactNode;onClick?:()=>void;primary?:boolean;disabled?:boolean;type?:'button'|'submit'}){return <button type={type} className={'button '+(primary?'primary':'')} onClick={onClick} disabled={disabled}>{children}</button>}
export function Status({status}:{status:string}){return <span className={'status '+status}>{status==='accepted'?<Check size={12}/>:status==='rejected'?<X size={12}/>:<span className="status-dot"/>}{status==='pending'?'Awaiting review':status==='accepted'?'Extraction accepted':'Extraction rejected'}</span>}
export function Empty({title,children}:{title:string;children?:ReactNode}){return <div className="empty"><BookOpen size={26}/><h3>{title}</h3><p>{children}</p></div>}
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=ref.current;el?.showModal();return()=>{el?.close();};},[]);
  return <dialog className={wide?'modal wide':'modal'} ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19}/></button></div><div className="modal-body">{children}</div></dialog>;
}
export function Passage({claim}:{claim:Claim}) {
  const spans=[{start:claim.plantStart-claim.start,end:claim.plantEnd-claim.start,kind:'plant'},{start:claim.useStart-claim.start,end:claim.useEnd-claim.start,kind:'use'}].sort((a,b)=>a.start-b.start);
  const nodes:ReactNode[]=[];let cursor=0;
  for(const [i,span] of spans.entries()){
    if(span.start<cursor||span.start<0||span.end>claim.quote.length)continue;
    nodes.push(claim.quote.slice(cursor,span.start));nodes.push(<mark key={i} title={span.kind==='plant'?'Plant name as written':'Reported use as written'}>{claim.quote.slice(span.start,span.end)}</mark>);cursor=span.end;
  }
  nodes.push(claim.quote.slice(cursor));return <blockquote className="passage">{nodes}</blockquote>;
}
export function ClaimFacts({claim}:{claim:Claim}){return <div className="claim-facts"><div><span>Plant part</span><p>{claim.plantPart||'Not stated'}</p></div><div><span>Preparation</span><p>{claim.preparation||'Not stated'}</p></div><div><span>Evidence type</span><p>{evidenceLabels[claim.evidenceType]||claim.evidenceType}</p></div></div>}
export function Citation({source,onInspect}:{source:Source;onInspect:()=>void}){return <div className="citation"><FileText size={16}/><span>{source.authors?source.authors.split(',')[0]+' et al.':'Authors not supplied'} · {source.year||'Year not supplied'} · {source.locator||'Saved text snapshot'}</span><button onClick={onInspect} aria-label="Inspect source"><ArrowUpRight size={17}/></button></div>}
export function downloadBlob(content:string,name:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
