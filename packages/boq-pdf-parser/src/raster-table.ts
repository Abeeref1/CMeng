import {createCanvas,loadImage,type Canvas} from '@napi-rs/canvas';
import type {OcrProvider,OcrPageResult} from '../../pdf-document-parser/src';
import {detectBoqHeader} from '../../boq-parser/src/headers';
import {parseStrictNumeric} from '../../boq-parser/src/numeric';
import type {BoqColumnRole} from '../../boq-parser/src/types';

export interface RasterCellEvidence {
  text:string;
  confidence:number|null;
  bounds:{x:number;y:number;width:number;height:number};
  confirmation?:{text:string;confidence:number|null};
  additionalReadings?:{text:string;confidence:number|null}[];
}
export interface RasterBoqTable {
  rows:string[][];
  cells:Record<string,RasterCellEvidence[]>[];
  diagnostics:string[][];
  rotation:number;
  imageWidth:number;
  imageHeight:number;
}
type Box=RasterCellEvidence['bounds'];
type Raster={canvas:Canvas;pixels:Uint8ClampedArray;width:number;height:number};
const numericRoles=new Set<BoqColumnRole>(['quantity','rate','amount']);
function raster(canvas:Canvas):Raster{return {canvas,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height};}
function groupedPositions(values:number[],gap=4):number[]{
 const groups:number[][]=[];
 for(const v of values){const g=groups.at(-1);if(g&&v-g.at(-1)!<=gap)g.push(v);else groups.push([v]);}
 return groups.flatMap(g=>g.length>9?[g[0]!,g.at(-1)!]:[Math.round(g.reduce((a,b)=>a+b,0)/g.length)]);
}
function mergePositions(values:number[]):number[]{return groupedPositions([...new Set(values)].sort((a,b)=>a-b));}
function horizontal(r:Raster,x:number,width:number,top:number,bottom:number,threshold:number,fraction:number):number[]{
 const selected:number[]=[];
 for(let y=top;y<bottom;y++){let dark=0,run=0,longest=0;for(let xx=x;xx<x+width;xx++){
   if(r.pixels[(y*r.width+xx)*4]!<threshold){dark++;run++;longest=Math.max(longest,run);}else run=0;
  }
  // Dense letters are not rules. Requiring a continuous stroke prevents a
  // short heading or number from being split through its own characters.
  if(dark>=width*fraction&&longest>=Math.max(12,width*.35))selected.push(y);
 }
 return groupedPositions(selected);
}
function grid(r:Raster){
 const vertical:number[]=[];
 for(let x=0;x<r.width;x++){let dark=0;for(let y=0;y<r.height;y++)if(r.pixels[(y*r.width+x)*4]!<170)dark++;
  if(dark>r.height*.26)vertical.push(x);
 }
 const xs=groupedPositions(vertical).filter((x,i,a)=>!i||x-a[i-1]!>12);
 if(xs.length<4||xs.length>80)return null;
 // Find the extent in individual columns. A slightly tilted rule can cross
 // an entire page without occupying most pixels on any single full-width row.
 const ys=xs.slice(0,-1).flatMap((x,i)=>{
  const width=xs[i+1]!-x-8;
  return width>=10?horizontal(r,x+4,width,0,r.height,135,.67):[];
 }).sort((a,b)=>a-b);
 if(ys.length<3)return null;
 const top=ys[0]!,bottom=ys.at(-1)!;
 const columns=xs.slice(0,-1).map((x,i)=>{
  const l=x+4,width=xs[i+1]!-l-4;
  if(width<10)return [];
  const boundaries=mergePositions([top,bottom,...horizontal(r,l,width,top,bottom+1,135,.67),...horizontal(r,l,width,top,bottom+1,185,.50)]);
  return boundaries.slice(0,-1).flatMap((y,j)=>{
   // Keep descenders and comma tails near the rule. A large fixed inset can
   // turn "sq.m." into "sa.m." or a thousands comma into a decimal point.
   const height=boundaries[j+1]!-y-4;
   return height>=10?[{x:l,y:y+2,width,height}]:[];
  });
 });
 return {xs,top,bottom,columns};
}
function crop(r:Raster,b:Box,scale=2):Canvas{
 const border=12,c=createCanvas(Math.round(b.width*scale)+border*2,Math.round(b.height*scale)+border*2),ctx=c.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(r.canvas,b.x,b.y,b.width,b.height,border,border,c.width-border*2,c.height-border*2);
 return c;
}
function cropPng(r:Raster,b:Box,scale=2):Buffer{
 const canvas=crop(r,b,scale);
 try{return canvas.toBuffer('image/png');}
 finally{canvas.width=1;canvas.height=1;}
}
/** Remove only thin rules whose strokes continue outside the source cell.
 * Cropping at native resolution also prevents interpolation from pulling an
 * adjacent rule into the enlarged text. Original pixels remain unchanged. */
function isolatedCellPng(r:Raster,b:Box,scale:number):Buffer{
 const c=createCanvas(b.width,b.height),ctx=c.getContext('2d');
 ctx.drawImage(r.canvas,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
 try{
  const im=ctx.getImageData(0,0,c.width,c.height),pixels=im.data,w=c.width,h=c.height,visited=new Uint8Array(w*h);
  const sourceDark=(x:number,y:number)=>x>=0&&y>=0&&x<r.width&&y<r.height&&r.pixels[(y*r.width+x)*4]!<175;
  for(let start=0;start<w*h;start++){
   if(visited[start]||pixels[start*4]!>=175)continue;
   const queue=[start];visited[start]=1;let minX=w,maxX=0,minY=h,maxY=0;
   for(let i=0;i<queue.length;i++){
    const at=queue[i]!,x=at%w,y=Math.floor(at/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(const next of [at-1,at+1,at-w,at+w]){
     if(next<0||next>=w*h||Math.abs(next%w-x)+Math.abs(Math.floor(next/w)-y)!==1||visited[next]||pixels[next*4]!>=175)continue;
     visited[next]=1;queue.push(next);
    }
   }
   const verticalCandidate=maxY-minY>=h*.7&&maxX-minX<=Math.max(5,w*.06)&&(minX<=w*.2||maxX>=w*.8);
   const horizontalCandidate=maxX-minX>=w*.7&&maxY-minY<=Math.max(3,h*.08)&&(minY<=h*.15||maxY>=h*.85);
   const continuedVertical=(outsideY:number)=>{
    let n=0;const x=b.x+Math.round((minX+maxX)/2);
    for(let d=0;d<8;d++)if([-2,-1,0,1,2].some(dx=>sourceDark(x+dx,outsideY+d)))n++;
    return n>=6;
   };
   const continuedHorizontal=(outsideX:number)=>{
    let n=0;const y=b.y+Math.round((minY+maxY)/2);
    for(let d=0;d<8;d++)if([-2,-1,0,1,2].some(dy=>sourceDark(outsideX+d,y+dy)))n++;
    return n>=6;
   };
   if(verticalCandidate&&continuedVertical(b.y-10)&&continuedVertical(b.y+h+2)||horizontalCandidate&&continuedHorizontal(b.x-10)&&continuedHorizontal(b.x+w+2)){
    for(const at of queue)pixels[at*4]=pixels[at*4+1]=pixels[at*4+2]=255;
   }
  }
  ctx.putImageData(im,0,0);
  const out=createCanvas(Math.round(w*scale)+24,Math.round(h*scale)+24),oc=out.getContext('2d');
  try{oc.fillStyle='white';oc.fillRect(0,0,out.width,out.height);oc.drawImage(c,12,12,out.width-24,out.height-24);return out.toBuffer('image/png');}
  finally{out.width=1;out.height=1;}
 }finally{c.width=1;c.height=1;}
}
function hasInk(r:Raster,b:Box):boolean{
 let n=0;for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(r.pixels[(y*r.width+x)*4]!<135&&++n>=18)return true;return false;
}
function simple(text:string){return text.replace(/\s+/g,' ').trim();}
function strictNumber(text:string){
 const s=simple(text);if(!/^[+\-]?(?:\d[\d.,\u00a0 ]*|\([\d.,\u00a0 ]+\))$/.test(s))return null;
 const p=parseStrictNumeric(s);return p.status==='valid'?p.value:null;
}
function unitKey(text:string):string|null{
 const key=simple(text).toLowerCase().replace(/[.\s]/g,'');
 return /^(?:m|m2|m3|m²|m³|sqm|cum|lm|sqft|cuft|ft|ft2|ft3|in|kg|g|t|ton|tons|tonne|tonnes|l|litre|litres|liter|liters|each|ea|no|nos|nr|piece|pieces|pc|pcs|unit|units|set|sets|lot|lots|ls|sum|month|months|day|days|hour|hours|hr|hrs|week|weeks|roll|rolls|pair|pairs|عدد|م|م٢|م٣|كجم|طن|شهر|يوم|ساعة)$/.test(key)?key:null;
}

/** Recover a ruled BOQ from its pixels. Every value stays attached to the
 * physical description cell it overlaps; column order never supplies a value.
 * Conflicting/low-confidence readings remain empty, with both readings retained.
 * This establishes candidate source facts only, never document authority. */
export async function readRasterBoqTable(image:Uint8Array,provider:OcrProvider,pageNumber:number):Promise<RasterBoqTable|null>{
 const original=await loadImage(Buffer.from(image));
 for(const rotation of [0,90,270,180]){
  const quarter=rotation===90||rotation===270,c=createCanvas(quarter?original.height:original.width,quarter?original.width:original.height),ctx=c.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.translate(c.width/2,c.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(original,-original.width/2,-original.height/2);ctx.resetTransform();
  try{
  const r=raster(c),g=grid(r);if(!g)continue;
  const cache=new Map<string,Promise<RasterCellEvidence>>();
  const read=(b:Box)=>{
   const key=JSON.stringify(b);let p=cache.get(key);if(!p){p=(async()=>{
    const result:OcrPageResult=hasInk(r,b)?await provider.recognize(cropPng(r,b),pageNumber,{segmentation:'block'}):{text:'',confidence:1,diagnostics:[],language:null};
    return {text:result.text.trim(),confidence:result.confidence,bounds:b};
   })();cache.set(key,p);}return p;
  };
  // A header is established by independently located cells sharing a y range.
  // Only the top eight cells are searched; a data row cannot define its columns.
  const readBoxes=async(boxes:Box[])=>{const cells:RasterCellEvidence[]=[];for(const box of boxes)cells.push(await read(box));return cells;};
  const topCells:RasterCellEvidence[][]=[];
  for(const column of g.columns)topCells.push(await readBoxes(column.slice(0,8)));
  const possible=mergePositions(topCells.flat().map(c=>Math.round(c.bounds.y+c.bounds.height/2))).sort((a,b)=>a-b);
  let header:ReturnType<typeof detectBoqHeader>=null,headerBottom=0,headerValues:string[]=[];
  for(const y of possible){
   const cells=topCells.map(col=>col.find(c=>y>=c.bounds.y&&y<=c.bounds.y+c.bounds.height));
   const values=cells.map(c=>c?.text??''),mapped=detectBoqHeader([values]);
   if(mapped){header=mapped;headerValues=values;headerBottom=Math.max(...cells.filter(c=>c).map(c=>c!.bounds.y+c!.bounds.height));break;}
  }
  if(!header)continue;
  const roles=header.roles,descriptionColumn=Number(Object.keys(roles).find(k=>roles[Number(k)]==='description'))-1;
  const rows:string[][]=[headerValues],evidenceRows:Record<string,RasterCellEvidence[]>[]=[{}],diagnostics:string[][]=[[]];
  const descBoxes=(g.columns[descriptionColumn]??[]).filter(b=>b.y>=headerBottom);
  for(const box of descBoxes){
   const desc=await read(box);if(!desc.text.trim())continue;
   const row=Array(g.columns.length).fill('') as string[],evidence:Record<string,RasterCellEvidence[]>={},issues:string[]=[];
   for(const [column,role] of Object.entries(roles)){
    const index=Number(column)-1,boxes=(g.columns[index]??[]).filter(b=>{
     const center=b.y+b.height/2;return center>=box.y-4&&center<=box.y+box.height+4;
    });
    const cells=role==='description'?[desc]:await readBoxes(boxes);evidence[role]=cells;
    const nonempty=cells.filter(c=>c.text.trim());
    if(!nonempty.length)continue;
    if(numericRoles.has(role)){
     if(nonempty.length!==1){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_MULTIPLE_CELLS');continue;}
     const cell=nonempty[0]!;
     const second=await provider.recognize(cropPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
     cell.confirmation={text:second.text.trim(),confidence:second.confidence};
     const third=await provider.recognize(isolatedCellPng(r,cell.bounds,2),pageNumber,{segmentation:'block'});
     const fourth=await provider.recognize(isolatedCellPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
     cell.additionalReadings=[{text:third.text.trim(),confidence:third.confidence},{text:fourth.text.trim(),confidence:fourth.confidence}];
     const readings=[{text:cell.text,confidence:cell.confidence},cell.confirmation,...cell.additionalReadings];
     const numeric=readings.filter(v=>strictNumber(v.text)!==null);
     const confident=numeric.filter(v=>(v.confidence??0)>=.90),values=new Set(numeric.map(v=>strictNumber(v.text)));
     // Preserve disagreement across original and isolated pixels. Two equally
     // readings of 3.00 and 300 must never be silently reconciled. A confidence
     // score cannot discard a contrary, syntactically valid source reading.
     if(confident.length<2||values.size!==1){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_REVIEW_REQUIRED');continue;}
     row[index]=confident[0]!.text;
    }else{
     if(nonempty.length!==1){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_MULTIPLE_CELLS');continue;}
     const cell=nonempty[0]!;
     if(role==='unit'){
      const second=await provider.recognize(cropPng(r,cell.bounds,1),pageNumber,{segmentation:'word'});
      cell.confirmation={text:second.text.trim(),confidence:second.confidence};
      const third=await provider.recognize(cropPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      const fourth=await provider.recognize(isolatedCellPng(r,cell.bounds,2),pageNumber,{segmentation:'block'});
      const fifth=await provider.recognize(isolatedCellPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      cell.additionalReadings=[{text:third.text.trim(),confidence:third.confidence},{text:fourth.text.trim(),confidence:fourth.confidence},{text:fifth.text.trim(),confidence:fifth.confidence}];
      const readings=[{text:cell.text,confidence:cell.confidence},cell.confirmation,...cell.additionalReadings];
      const recognized=readings.filter(v=>unitKey(v.text)!==null);
      const known=recognized.filter(v=>(v.confidence??0)>=.90),keys=new Set(recognized.map(v=>unitKey(v.text)));
      if(known.length<2||keys.size!==1){issues.push('BOQ_RASTER_UNIT_REVIEW_REQUIRED');continue;}
      row[index]=simple(known[0]!.text);continue;
     }
     if(role==='item_number'){
      const second=await provider.recognize(cropPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      cell.confirmation={text:second.text.trim(),confidence:second.confidence};
      const third=await provider.recognize(isolatedCellPng(r,cell.bounds,2),pageNumber,{segmentation:'block'});
      const fourth=await provider.recognize(isolatedCellPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      cell.additionalReadings=[{text:third.text.trim(),confidence:third.confidence},{text:fourth.text.trim(),confidence:fourth.confidence}];
      const readings=[{text:cell.text,confidence:cell.confidence},cell.confirmation,...cell.additionalReadings];
      const nonblank=readings.filter(v=>simple(v.text)),confident=nonblank.filter(v=>(v.confidence??0)>=.90);
      if(confident.length<2||new Set(nonblank.map(v=>simple(v.text))).size!==1){issues.push('BOQ_RASTER_ITEM_NUMBER_REVIEW_REQUIRED');continue;}
      row[index]=simple(confident[0]!.text);continue;
     }
     if(cell.confidence===null||cell.confidence<(role==='description'?.70:.90)){
      issues.push('BOQ_RASTER_'+role.toUpperCase()+'_REVIEW_REQUIRED');
      if(role!=='description')continue;
     }
     row[index]=simple(cell.text);
    }
   }
   rows.push(row);evidenceRows.push(evidence);diagnostics.push(issues);
  }
  if(rows.length>1)return {rows,cells:evidenceRows,diagnostics,rotation,imageWidth:r.width,imageHeight:r.height};
  }finally{c.width=1;c.height=1;}
 }
 return null;
}
