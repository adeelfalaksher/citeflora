import type {ReportBlock,DocumentFormat} from './evidence-report';

export async function wordReport(blocks:ReportBlock[],format:Exclude<DocumentFormat,'pdf'>):Promise<Blob>{
  if(format==='doc'){
    const {default:textToDoc}=await import('./vendor/jsdoc/textToDoc.cjs');
    type Para={runs:{text:string;b?:boolean;size:number;font:string;color?:number}[];kind?:string;pp?:Record<string,number|boolean>;tblw?:number[];shd?:number};
    const body:Para[]=[];
    for(const b of blocks){
      if(b.kind==='fields'){
        for(const [label,value]of b.rows){
          body.push({kind:'cell',runs:[{text:label,b:true,size:9,font:'Arial'}],shd:0xF2F4F0},{kind:'cell',runs:[{text:value,size:9,font:'Arial'}]},{kind:'rowEnd',runs:[],tblw:[0,2450,10060]});
        }
        body.push({runs:[],pp:{spA:160}});
      }else body.push({runs:[{text:b.text,b:['title','heading','meta'].includes(b.kind),size:b.kind==='title'?26:b.kind==='heading'?15:b.kind==='meta'?8:10,font:'Arial',...(b.kind==='meta'?{color:0x294C83}:{})}],pp:{spB:b.kind==='heading'?220:0,spA:160,keepNext:['heading','meta'].includes(b.kind),pageBreak:!!b.newPage,...(b.kind==='quote'?{indL:220,indR:220,shd:0xF1F5F1}:{})}});
    }
    const bytes=textToDoc({body,header:[{runs:[{text:'CITEFLORA / EVIDENCE REVIEW',b:true,size:8,font:'Arial'}]}],footer:[{runs:[{text:'Research extraction review. Acceptance is not clinical validation.',size:8,font:'Arial'}]}],page:{width:11906,height:16838,top:1000,bottom:1000,left:920,right:920},props:{title:'Citeflora evidence review report',author:'Citeflora'}});
    return new Blob([new Uint8Array(bytes)],{type:'application/msword'});
  }
  const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,BorderStyle,HeadingLevel,Header,Footer,PageNumber,AlignmentType}=await import('docx');
  const text=(value:string,bold=false,color='25332B')=>new TextRun({text:value,bold,color,size:20,font:'Calibri'});
  const children:(InstanceType<typeof Paragraph>|InstanceType<typeof Table>)[]=[];
  for(const b of blocks){
    if(b.kind==='fields')children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},columnWidths:[2500,7526],rows:b.rows.map(([label,value])=>new TableRow({cantSplit:false,children:[new TableCell({width:{size:2500,type:WidthType.DXA},shading:{fill:'F1F4F0'},children:[new Paragraph({children:[text(label,true)]})]}),new TableCell({width:{size:7526,type:WidthType.DXA},children:[new Paragraph({children:[text(value)]})]})]})),borders:{top:{style:BorderStyle.SINGLE,size:1,color:'D9DFD7'},bottom:{style:BorderStyle.SINGLE,size:1,color:'D9DFD7'},left:{style:BorderStyle.NONE,size:0},right:{style:BorderStyle.NONE,size:0},insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'D9DFD7'},insideVertical:{style:BorderStyle.NONE,size:0}},margins:{top:100,bottom:100,left:120,right:120}}));
    else children.push(new Paragraph({text:b.text,heading:b.kind==='title'?HeadingLevel.TITLE:b.kind==='heading'?HeadingLevel.HEADING_1:undefined,pageBreakBefore:b.newPage,keepNext:b.kind==='heading'||b.kind==='meta',spacing:{before:b.kind==='heading'?260:100,after:160},...(b.kind==='quote'?{shading:{fill:'F1F4F0'},indent:{left:220,right:220}}:{}),...(b.kind==='meta'?{style:'ReportMeta'}:{})}));
  }
  const doc=new Document({creator:'Citeflora',title:'Citeflora evidence review report',styles:{default:{document:{run:{font:'Calibri',size:20,color:'25332B'},paragraph:{spacing:{line:276,after:160}}}},paragraphStyles:[{id:'ReportMeta',name:'Report metadata',basedOn:'Normal',run:{size:16,color:'984A32',bold:true}}]},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1000,bottom:1000,left:920,right:920}}},headers:{default:new Header({children:[new Paragraph({children:[text('CITEFLORA / EVIDENCE REVIEW',true,'984A32')],border:{bottom:{style:BorderStyle.SINGLE,size:4,color:'D9DFD7'}}})]})},footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[new TextRun({text:'Citeflora / Research extraction review / ',size:16}),new TextRun({children:[PageNumber.CURRENT],size:16}),new TextRun({text:' / ',size:16}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:16})]})]})},children}]});
  return Packer.toBlob(doc);
}
