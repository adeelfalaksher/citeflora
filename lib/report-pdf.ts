import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {ReportBlock} from './evidence-report';

// Embedded Unicode fonts and measured wrapping keep passages, names and hashes
// readable without relying on fonts installed on the recipient's computer.
export async function pdfReport(blocks:ReportBlock[],fonts?:{regular:Uint8Array;bold:Uint8Array}):Promise<Blob>{
  const load=async(name:string)=>{const r=await fetch('/document-assets/'+name);if(!r.ok)throw new Error('Report fonts could not be loaded. Try the download again.');return new Uint8Array(await r.arrayBuffer());};
  const bytes=fonts||{regular:await load('DejaVuSans.ttf'),bold:await load('DejaVuSans-Bold.ttf')};
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);doc.setTitle('Citeflora evidence review report');doc.setAuthor('Citeflora');
  const normal=await doc.embedFont(bytes.regular,{subset:true}),bold=await doc.embedFont(bytes.bold,{subset:true});
  const width=595.28,height=841.89,margin=46,bottom=54,usable=width-margin*2;
  const ink=rgb(.13,.17,.14),muted=rgb(.36,.39,.37),accent=rgb(.59,.24,.16),rule=rgb(.84,.86,.83),wash=rgb(.95,.96,.94);
  let page!:PDFPage,y=0;
  function newPage(){page=doc.addPage([width,height]);y=height-62;page.drawText('CITEFLORA',{x:margin,y:height-30,size:8,font:bold,color:accent});page.drawLine({start:{x:margin,y:height-39},end:{x:width-margin,y:height-39},color:rule,thickness:.6});}
  function ensure(space:number){if(y-space<bottom)newPage();}
  function wrap(text:string,font:PDFFont,size:number,max:number){
    const result:string[]=[];
    for(const paragraph of text.replace(/\t/g,'    ').split('\n')){
      let line='';
      for(const word of paragraph.split(/\s+/).filter(Boolean)){
        const attempt=line?line+' '+word:word;
        if(font.widthOfTextAtSize(attempt,size)<=max){line=attempt;continue;}
        if(line){result.push(line);line='';}
        for(const char of word){if(line&&font.widthOfTextAtSize(line+char,size)>max){result.push(line);line='';}line+=char;}
      }
      result.push(line);
    }
    return result;
  }
  function paragraph(text:string,size=9.5,font=normal,color=ink,quote=false){
    const pad=quote?12:0,lineHeight=size*1.48;
    for(const line of wrap(text,font,size,usable-pad*2)){
      ensure(lineHeight+pad/2);
      if(quote)page.drawRectangle({x:margin,y:y-lineHeight+3,width:usable,height:lineHeight,color:wash});
      page.drawText(line,{x:margin+pad,y,size,font,color});y-=lineHeight;
    }
    y-=quote?12:8;
  }
  newPage();
  for(const block of blocks){
    if(block.kind==='fields'){
      const labelWidth=121,gap=12,valueWidth=usable-labelWidth-gap;
      for(const [label,value]of block.rows){
        const labels=wrap(label,bold,8.2,labelWidth-8),values=wrap(value,normal,8.6,valueWidth);
        const count=Math.max(labels.length,values.length),lineHeight=13;
        ensure(Math.min(count*lineHeight+11,height-130));
        for(let i=0;i<count;i++){
          ensure(lineHeight+5);
          if(labels[i])page.drawText(labels[i],{x:margin,y,size:8.2,font:bold,color:muted});
          if(values[i])page.drawText(values[i],{x:margin+labelWidth+gap,y,size:8.6,font:normal,color:ink});
          y-=lineHeight;
        }
        y-=5;page.drawLine({start:{x:margin,y:y+2},end:{x:width-margin,y:y+2},color:rule,thickness:.35});y-=5;
      }
      y-=12;continue;
    }
    if(block.newPage&&y<height-70)newPage();
    if(block.kind==='title'){ensure(110);y-=22;paragraph(block.text,30,bold,ink);y-=10;}
    else if(block.kind==='heading'){ensure(105);y-=12;paragraph(block.text,15,bold,ink);}
    else if(block.kind==='meta')paragraph(block.text,8,bold,accent);
    else paragraph(block.text,9.5,normal,block.kind==='quote'?muted:ink,block.kind==='quote');
  }
  const pages=doc.getPages();
  for(const [i,p]of pages.entries()){
    p.drawLine({start:{x:margin,y:39},end:{x:width-margin,y:39},color:rule,thickness:.6});
    p.drawText('Research extraction review / Not clinical validation',{x:margin,y:26,size:7,font:normal,color:muted});
    const label=`${i+1} / ${pages.length}`;p.drawText(label,{x:width-margin-normal.widthOfTextAtSize(label,8),y:26,size:8,font:normal,color:muted});
  }
  return new Blob([new Uint8Array(await doc.save())],{type:'application/pdf'});
}
