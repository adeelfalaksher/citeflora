import {parseCSV} from './engine.mjs';

export type ImportedDocument={text:string;format:'text'|'table';title?:string;authors?:string;year?:string|number;region?:string;doi?:string;url?:string;licence?:string;locator:string;adaptation:string};
export const documentFileAccept='.pdf,.doc,.docx,.csv,.txt,.md,.text,.html,.htm,.json';
const maxText=80000;
function checked(text:string){if(!text.trim())throw new Error('No readable text was found. For a scanned document, use OCR first and check the text before importing.');if(text.length>maxText)throw new Error('The extracted text exceeds 80,000 characters. Choose a shorter document or excerpt.');if(text.includes('\u0000'))throw new Error('This file contains binary data instead of readable source text. Choose the correct file format.');return text;}

export async function htmlSource(raw:string){
  const {parse}=await import('parse5');
  const tree=parse(raw);
  const parts:string[]=[];let title='';
  const skip=new Set(['script','style','noscript','iframe','svg','canvas','template','form']);
  const block=new Set(['p','div','section','article','header','footer','li','tr','h1','h2','h3','h4','blockquote','pre']);
  type Node={nodeName:string;value?:string;childNodes?:Node[];attrs?:{name:string;value:string}[]};
  function visit(node:Node,inHead=false){
    if(skip.has(node.nodeName)||node.attrs?.some(a=>a.name==='hidden'||(a.name==='aria-hidden'&&a.value==='true')))return;
    if(node.nodeName==='title'){title=(node.childNodes||[]).map(x=>x.value||'').join('');return;}
    if(node.nodeName==='#text'){if(!inHead)parts.push(node.value||'');return;}
    if(node.nodeName==='br')parts.push('\n');
    if(block.has(node.nodeName))parts.push('\n');
    for(const child of node.childNodes||[])visit(child,inHead||node.nodeName==='head');
    if(['td','th'].includes(node.nodeName))parts.push('\t');
    if(block.has(node.nodeName))parts.push('\n');
  }
  visit(tree as Node);
  return {text:parts.join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(),title:title.trim()};
}

export function jsonSource(raw:string):Partial<ImportedDocument>&{text:string}{
  let data:unknown;try{data=JSON.parse(raw);}catch{throw new Error('The JSON file is invalid. Use a source object with a text field.');}
  if(typeof data==='string')return {text:data};
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('JSON must contain one source object with a text field.');
  if('sources'in data){const sources=data.sources;if(!Array.isArray(sources)||sources.length!==1)throw new Error('This JSON archive contains multiple sources. Import one source object at a time so its citation stays attached.');data=sources[0];}
  if(!data||typeof data!=='object'||!('text'in data)||typeof data.text!=='string')throw new Error('JSON must contain a source object with a text field.');
  const input=data as Record<string,unknown>,out:Partial<ImportedDocument>&{text:string}={text:input.text as string,format:input.format==='table'?'table':'text'};
  for(const key of ['title','authors','region','doi','url','licence']as const)if(typeof input[key]==='string')out[key]=input[key];
  if(typeof input.year==='number'||typeof input.year==='string')out.year=input.year;
  return out;
}

export async function readSourceDocument(file:File):Promise<ImportedDocument>{
  const ext=file.name.split('.').pop()?.toLowerCase()||'';
  if(!['pdf','doc','docx','csv','txt','md','text','html','htm','json'].includes(ext))throw new Error('Choose PDF, DOC, DOCX, CSV, TXT, HTML or JSON.');
  const binary=['pdf','doc','docx'].includes(ext);
  if(file.size>(binary?5_000_000:250_000))throw new Error(binary?'Choose a document under 5 MB.':'Choose a text, CSV, HTML or JSON file under 250 KB.');
  const result:ImportedDocument={text:'',format:'text',title:file.name.replace(/\.[^.]+$/,''),locator:`Text extracted from ${file.name}`,adaptation:`Text extracted locally from a ${ext.toUpperCase()} file. Inspect reading order, tables and citation details before saving. The original file is not uploaded or retained.`};
  if(ext==='pdf'){
    const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/document-assets/pdf.worker.min.mjs';
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useWorkerFetch:false,disableFontFace:true,useSystemFonts:false});
    try{
      const pdf=await task.promise;if(pdf.numPages>100)throw new Error('Choose a PDF with no more than 100 pages.');
      const pages:string[]=[];let length=0;
      for(let i=1;i<=pdf.numPages;i++){
        const page=await pdf.getPage(i),content=await page.getTextContent();
        const text=content.items.map(item=>'str'in item?item.str+(item.hasEOL?'\n':' '):'').join('').trim();
        length+=text.length+2;if(length>maxText)throw new Error('The extracted text exceeds 80,000 characters. Choose a shorter PDF or excerpt.');pages.push(text);page.cleanup();
      }
      result.text=pages.join('\n\n');result.locator=`${file.name}, ${pdf.numPages} PDF pages`;
    }catch(e){if(e instanceof Error&&e.name==='PasswordException')throw new Error('This PDF is password protected. Import an unlocked copy.');throw e;}finally{await task.destroy();}
  }else if(ext==='docx'){
    const bytes=new Uint8Array(await file.arrayBuffer());const {unzipSync}=await import('fflate');let total=0,hasBody=false;
    unzipSync(bytes,{filter:entry=>{total+=entry.originalSize;if(entry.originalSize>5_000_000||total>25_000_000)throw new Error('The expanded Word document is too large. Choose a shorter document.');if(entry.name==='word/document.xml')hasBody=true;return false;}});
    if(!hasBody)throw new Error('This is not a readable DOCX document.');
    const {default:mammoth}=await import('mammoth/mammoth.browser.js');result.text=(await mammoth.extractRawText({arrayBuffer:bytes.buffer})).value;
  }else if(ext==='doc'){
    const {default:docToText}=await import('./vendor/jsdoc/docToText.cjs');
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes.length<512)throw new Error('This is not a readable DOC document.');
    const view=new DataView(bytes.buffer),sectorShift=view.getUint16(30,true);
    if(![9,12].includes(sectorShift)||view.getUint16(32,true)!==6||view.getUint32(44,true)>bytes.length/512)throw new Error('This DOC file has an invalid compound-file header.');
    const text=docToText(bytes);if(text===null)throw new Error('This DOC file is encrypted, damaged or an unsupported older Word format. Save an unlocked DOCX copy and import it.');result.text=text;
  }else{
    let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer()).replace(/^\uFEFF/,'');}catch{throw new Error('Save this file as UTF-8 text before importing it.');}
    if(ext==='csv'){result.text=parseCSV(raw);result.format='table';}
    else if(['html','htm'].includes(ext)){const html=await htmlSource(raw);result.text=html.text;result.title=html.title||result.title;}
    else if(ext==='json')Object.assign(result,jsonSource(raw));
    else result.text=raw;
  }
  result.text=checked(result.text);return result;
}
