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
  hasText?:boolean;
}
export interface RasterBoqTable {
  rows:string[][];
  cells:Record<string,RasterCellEvidence[]>[];
  diagnostics:string[][];
  rotation:number;
  imageWidth:number;
  imageHeight:number;
  columnEdges:number[];
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
/** Faded rules can cross several pixel rows. Require an almost continuous
 * stroke across the cell, so pale text cannot supply a new row boundary. */
function faintHorizontal(r:Raster,x:number,width:number,top:number,bottom:number,minStroke=.75,bridgeGaps=false,inkThreshold=235,minDensity=.92):number[]{
 const selected:number[]=[],maxGap=Math.max(2,Math.ceil(width*.01));
 for(let y=Math.max(2,top);y<Math.min(r.height-2,bottom);y++){
  let dark=0,run=0,longest=0,gaps=0;
  for(let xx=x;xx<x+width;xx++){
   let ink=false;for(let dy=-2;dy<=2;dy++)if(r.pixels[((y+dy)*r.width+xx)*4]!<inkThreshold){ink=true;break;}
   // A scan can erase tiny portions of a long rule. Bridge at most one
   // percent of the cell width, retaining the high total stroke density.
   if(ink){dark++;run++;gaps=0;longest=Math.max(longest,run);}
   else if(bridgeGaps&&run&&++gaps<=maxGap)run++;else run=0;
  }
  if(dark>=width*minDensity&&longest>=Math.max(40,width*minStroke))selected.push(y);
 }
 return groupedPositions(selected);
}
/** Pale column rules must form a long continuous stroke. Counting scattered
 * text pixels at a lighter threshold would invent columns through the numbers. */
function faintVertical(r:Raster,minHeightFraction=.26,inkThreshold=245):number[]{
 const selected:number[]=[];
 for(let x=2;x<r.width-2;x++){
  let run=0,longest=0;
  for(let y=0;y<r.height;y++){
   let ink=false;for(let dx=-2;dx<=2;dx++)if(r.pixels[(y*r.width+x+dx)*4]!<inkThreshold){ink=true;break;}
   if(ink){run++;longest=Math.max(longest,run);}else run=0;
  }
  if(longest>r.height*minHeightFraction)selected.push(x);
 }
 return groupedPositions(selected);
}
function grid(r:Raster,enhanced=false,compact=false){
 const vertical:number[]=[];
 for(let x=0;x<r.width;x++){let dark=0;for(let y=0;y<r.height;y++)if(r.pixels[(y*r.width+x)*4]!<170)dark++;
  if(dark>r.height*.26)vertical.push(x);
 }
 const xs=groupedPositions(vertical).filter((x,i,a)=>!i||x-a[i-1]!>12);
 const paleColumns=xs.length<4;
 if(enhanced&&(paleColumns||compact))for(const x of faintVertical(r,compact?.10:.26,compact?250:245))if(!xs.some(old=>Math.abs(old-x)<=12))xs.push(x);
 xs.sort((a,b)=>a-b);
 if(xs.length<4||xs.length>80)return null;
 // A section can interrupt the item/description separator for much of the
 // page. Recover actual shorter vertical strokes inside the established grid;
 // never infer a column from the expected order of BOQ fields.
 const shortRules:number[]=[];
 for(let x=xs[0]!;x<=xs.at(-1)!;x++){
  let dark=0,run=0,longest=0;
  for(let y=0;y<r.height;y++){
   const at=(y*r.width+x)*4;
   // Broad shaded bands are not vertical rules. A real thin stroke has
   // lighter pixels beside it; otherwise every column in a band would qualify.
   if(r.pixels[at]!<185&&(r.pixels[at-16]!>=185||r.pixels[at+16]!>=185)){dark++;run++;longest=Math.max(longest,run);}else run=0;
  }
  if(longest>=Math.max(40,r.height*.02)&&dark>r.height*.1)shortRules.push(x);
 }
 for(const x of groupedPositions(shortRules))if(!xs.some(old=>Math.abs(old-x)<=12))xs.push(x);
 xs.sort((a,b)=>a-b);
 if(xs.length>80)return null;
 // Find the extent in individual columns. A slightly tilted rule can cross
 // an entire page without occupying most pixels on any single full-width row.
 const ys=xs.slice(0,-1).flatMap((x,i)=>{
  const width=xs[i+1]!-x-8;
  return width>=10?horizontal(r,x+4,width,0,r.height,135,.67):[];
 }).sort((a,b)=>a-b);
 // The dark header can be the only dark horizontal part of a scanned table.
 // Establish the body extent from pale rules independently present in at least
 // two columns; searching only within the dark extent would erase its rows.
 const faintRules=xs.slice(0,-1).flatMap((x,i)=>{
  const width=xs[i+1]!-x-8;
  return width>=10?faintHorizontal(r,x+4,width,0,r.height,.75,true,compact?250:enhanced?245:235).map(y=>({y,column:i})):[];
 });
 const darkTop=ys[0]??0,darkBottom=ys.at(-1)??0;
 const paleExtent=enhanced&&(paleColumns||darkBottom-darkTop<r.height*.25);
 for(const rule of faintRules)if(paleExtent&&faintRules.some(other=>other.column!==rule.column&&Math.abs(other.y-rule.y)<=8)&&!ys.some(y=>Math.abs(y-rule.y)<=8))ys.push(rule.y);
 ys.sort((a,b)=>a-b);
 if(ys.length<3)return null;
 const top=ys[0]!,bottom=ys.at(-1)!;
 const inferredCells=new Set<Box>();
 const columns=xs.slice(0,-1).map((x,i)=>{
  const l=x+4,width=xs[i+1]!-l-4;
  if(width<10)return [];
  const recoveredBoundaries:number[]=[];
  const boundaries=mergePositions([top,bottom,...horizontal(r,l,width,top,bottom+1,135,.67),...horizontal(r,l,width,top,bottom+1,185,.50)]);
  // Preserve the coordinates of established dark rules and supplement only
  // missing ones; changing a good crop can unnecessarily change OCR evidence.
  for(const y of faintHorizontal(r,l,width,top,bottom+1,.75,enhanced,compact?250:enhanced?245:235))if(!boundaries.some(old=>Math.abs(old-y)<=8))boundaries.push(y);
  // A damaged rule may consist of several long strokes in this column. It
  // can divide cells only when a separate column corroborates its position.
  for(const y of enhanced?faintHorizontal(r,l,width,top,bottom+1,.35,true,compact?250:245,.50):[])if(new Set(faintRules.filter(rule=>rule.column!==i&&Math.abs(rule.y-y)<=8).map(rule=>rule.column)).size>=2&&!boundaries.some(old=>Math.abs(old-y)<=8))boundaries.push(y);
  // A missing divider in one column can be recovered from three independent
  // ruled columns only through a clear band, never through visible cell text.
  for(const rule of enhanced?faintRules:[]){
   const y=rule.y;if(y<=top+10||y>=bottom-10||boundaries.some(old=>Math.abs(old-y)<=8)||new Set(faintRules.filter(other=>other.column!==i&&Math.abs(other.y-y)<=5).map(other=>other.column)).size<3)continue;
   let ink=0;for(let yy=y-2;yy<=y+2;yy++)for(let xx=l+4;xx<l+width-4;xx++)if(r.pixels[(yy*r.width+xx)*4]!<235)ink++;
   if(ink<=width*.02){boundaries.push(y);recoveredBoundaries.push(y);}
  }
  boundaries.sort((a,b)=>a-b);
  return boundaries.slice(0,-1).flatMap((y,j)=>{
   // Keep descenders and comma tails near the rule. A large fixed inset can
   // turn "sq.m." into "sa.m." or a thousands comma into a decimal point.
   const height=boundaries[j+1]!-y-4;
   if(height<10)return [];
   const box={x:l,y:y+2,width,height};
   if(recoveredBoundaries.includes(y)||recoveredBoundaries.includes(boundaries[j+1]!))inferredCells.add(box);
   return [box];
  });
 });
 return {xs,top,bottom,columns,inferredCells};
}
/** Estimate small scan skew from long vertical strokes, not recognized values.
 * A tilted table spreads each rule across many image columns, so a fixed-column
 * histogram can miss an entire page. Header and cell validation still apply. */
function verticalSkew(r:Raster):number|null{
 const step=8,threshold=r.height/step*.26;
 let bestAngle=0,bestScore=0,zeroScore=0;
 for(let n=-20;n<=20;n++){
  const angle=n/10,slope=Math.tan(angle*Math.PI/180),hist=new Uint16Array(r.width+2*r.height);
  for(let y=0;y<r.height;y+=step){const offset=r.height-Math.round(y*slope);
   for(let x=0;x<r.width;x++)if(r.pixels[(y*r.width+x)*4]!<170)hist[x+offset]!++;
  }
  const peaks:number[]=[];let peak=0;
  for(const value of hist){if(value>threshold)peak=Math.max(peak,value);else if(peak){peaks.push(peak);peak=0;}}
  if(peak)peaks.push(peak);
  const score=peaks.length>=4&&peaks.length<=80?peaks.reduce((sum,value)=>sum+value*value,0):0;
  if(n===0)zeroScore=score;
  if(score>bestScore){bestAngle=angle;bestScore=score;}
 }
 return bestAngle!==0&&bestScore>zeroScore*1.2?bestAngle:null;
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
/** Text-only contrast reading. Dark lettering on a coloured band can be
 * unreadable to OCR even when the cell geometry is clear. Never use this
 * transform to certify a body number; originals and numeric policy stay intact. */
function contrastTextPng(r:Raster,b:Box):Buffer{
 const canvas=crop(r,b),ctx=canvas.getContext('2d');
 try{
  const data=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<data.data.length;i+=4){
   const value=Math.max(data.data[i]!,data.data[i+1]!,data.data[i+2]!)<100?0:255;
   data.data[i]=data.data[i+1]=data.data[i+2]=value;
  }
  ctx.putImageData(data,0,0);return canvas.toBuffer('image/png');
 }finally{canvas.width=1;canvas.height=1;}
}
/** Clear connected crop-edge rules for description rereads only. Interior
 * pixels stay intact; numeric reads never use this text transform. */
function descriptionCellPng(r:Raster,b:Box):Buffer{
 const c=createCanvas(b.width,b.height),ctx=c.getContext('2d');
 try{
  ctx.drawImage(r.canvas,b.x,b.y,b.width,b.height,0,0,b.width,b.height);
  const image=ctx.getImageData(0,0,c.width,c.height),p=image.data,w=c.width,h=c.height;
  const columns:number[]=[],rows:number[]=[];
  for(let x=0;x<w;x++)if(x<5||x>=w-5){let n=0;for(let y=0;y<h;y++)if(p[(y*w+x)*4]!<235)n++;if(n>=h*.8)columns.push(x);}
  for(let y=0;y<h;y++)if(y<5||y>=h-5){let n=0;for(let x=0;x<w;x++)if(p[(y*w+x)*4]!<235)n++;if(n>=w*.8)rows.push(y);}
  for(const x of columns)for(let y=0;y<h;y++){const i=(y*w+x)*4;p[i]=p[i+1]=p[i+2]=255;}
  for(const y of rows)for(let x=0;x<w;x++){const i=(y*w+x)*4;p[i]=p[i+1]=p[i+2]=255;}
  ctx.putImageData(image,0,0);
  const out=createCanvas(w*3+24,h*3+24),oc=out.getContext('2d');
  try{oc.fillStyle='white';oc.fillRect(0,0,out.width,out.height);oc.drawImage(c,2,2,w-4,h-4,18,18,(w-4)*3,(h-4)*3);return out.toBuffer('image/png');}
  finally{out.width=1;out.height=1;}
 }finally{c.width=1;c.height=1;}
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
 let n=0;for(let y=b.y;y<b.y+b.height;y++)for(let x=b.x;x<b.x+b.width;x++)if(r.pixels[(y*r.width+x)*4]!<235&&++n>=18)return true;return false;
}
/** Distinguish a numeral-sized mark from a blank cell's border or shading.
 * This only decides whether OCR has text to inspect; it never supplies a value. */
function hasNumericInk(r:Raster,b:Box):boolean{
 const w=b.width,h=b.height,visited=new Uint8Array(w*h);
 const dark=(at:number)=>r.pixels[((b.y+Math.floor(at/w))*r.width+b.x+at%w)*4]!<235;
 for(let start=0;start<w*h;start++){
  if(visited[start]||!dark(start))continue;
  const queue=[start];visited[start]=1;let minX=w,maxX=0,minY=h,maxY=0;
  for(let i=0;i<queue.length;i++){
   const at=queue[i]!,x=at%w,y=Math.floor(at/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const next of [at-1,at+1,at-w,at+w])if(next>=0&&next<w*h&&!visited[next]&&Math.abs(next%w-x)+Math.abs(Math.floor(next/w)-y)===1&&dark(next)){visited[next]=1;queue.push(next);}
  }
  const height=maxY-minY+1,width=maxX-minX+1;
  if(queue.length>=15&&height>=Math.max(7,h*.25)&&width>=2&&width<=height*2&&width<w*.5&&minX>1&&maxX<w-2&&minY>0&&maxY<h-1)return true;
 }
 return false;
}
function simple(text:string){return text.replace(/\s+/g,' ').trim();}
function strictNumber(text:string){
 const s=simple(text);if(!/^[+\-]?(?:\d[\d.,\u00a0 ]*|\([\d.,\u00a0 ]+\))$/.test(s))return null;
 const p=parseStrictNumeric(s);return p.status==='valid'?p.value:null;
}
function unitKey(text:string):string|null{
 const key=simple(text).toLowerCase().replace(/[.\s]/g,'');
 return /^(?:m|m2|m3|m²|m³|sqm|cum|lm|sqft|cuft|ft|ft2|ft3|in|kg|g|t|ton|tons|tonne|tonnes|l|litre|litres|liter|liters|each|ea|no|nos|nr|piece|pieces|pc|pcs|unit|units|set|sets|lot|lots|ls|sum|lumpsum|month|months|day|days|hour|hours|hr|hrs|week|weeks|roll|rolls|pair|pairs|عدد|م|م٢|م٣|كجم|طن|شهر|يوم|ساعة)$/.test(key)?key:null;
}

/** Recover a ruled BOQ from its pixels. Every value stays attached to the
 * physical description cell it overlaps; column order never supplies a value.
 * Conflicting/low-confidence readings remain empty, with both readings retained.
 * This establishes candidate source facts only, never document authority. */
export async function readRasterBoqTable(image:Uint8Array,provider:OcrProvider,pageNumber:number,previous?:RasterBoqTable):Promise<RasterBoqTable|null>{
 const original=await loadImage(Buffer.from(image));
 let mergedFallback:RasterBoqTable|null=null;
 let tableOrientation:number|null=null;
 // Exhaust established orientation/skew recovery before expanding pale rules.
 // Otherwise a tilted pale grid can win early and change valid numeric crops.
 // A short table can occupy less than a quarter of a full page. Try shorter
 // continuous rules only after established geometry and pale recovery fail;
 // recognized physical header cells still have to establish every role.
 for(const recovery of ['standard','pale','compact'] as const){
 const enhanced=recovery!=='standard';
 const rotations:number[]=tableOrientation===null?[0,90,270,180]:[tableOrientation];
 for(let orientationIndex=0;orientationIndex<rotations.length;orientationIndex++){
  const rotation=rotations[orientationIndex]!;
  const quarter=rotation===90||rotation===270,rigid=rotation%90===0,angle=rotation*Math.PI/180;
  const width=rigid?(quarter?original.height:original.width):Math.ceil(Math.abs(original.width*Math.cos(angle))+Math.abs(original.height*Math.sin(angle)));
  const height=rigid?(quarter?original.width:original.height):Math.ceil(Math.abs(original.width*Math.sin(angle))+Math.abs(original.height*Math.cos(angle)));
  const c=createCanvas(width,height),ctx=c.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.translate(c.width/2,c.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(original,-original.width/2,-original.height/2);ctx.resetTransform();
  try{
  const r=raster(c),g=grid(r,enhanced,recovery==='compact');
  const queueDeskew=()=>{if(rigid){const correction=verticalSkew(r);if(correction!==null)rotations.push(rotation+correction);}};
  if(!g){queueDeskew();continue;}
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
  let header:ReturnType<typeof detectBoqHeader>=null,headerBottom=0,headerValues:string[]=[],inheritedHeader=false;
  for(const y of possible){
   const cells=topCells.map(col=>col.find(c=>y>=c.bounds.y&&y<=c.bounds.y+c.bounds.height));
   const values=cells.map(c=>c?.text??''),mapped=detectBoqHeader([values]);
   if(mapped){
    header=mapped;headerValues=values;
    const descriptionIndex=Number(Object.keys(mapped.roles).find(k=>mapped.roles[Number(k)]==='description'))-1;
    // Body rows are anchored to description cells. An unrelated column's
    // tilted/merged header can end a few pixels below the first body cell.
    // Using that maximum silently discarded a real first line item.
    const descriptionHeader=cells[descriptionIndex]!;
    headerBottom=descriptionHeader.bounds.y+descriptionHeader.bounds.height;break;
   }
  }
  if(enhanced&&!header&&topCells.flat().some(cell=>/description|quantit|amount|unit|rate/i.test(cell.text))){
   // Shading can split one column's header into two apparent cells. Try the
   // enclosing physical spans present in other columns, at the top of the
   // table only. Roles still require recognized headings, never column order.
   const spans=[...new Map(topCells.flatMap(col=>col.slice(0,3)).map(cell=>[
    cell.bounds.y+':'+cell.bounds.height,{y:cell.bounds.y,height:cell.bounds.height}
   ])).values()].sort((a,b)=>a.y-b.y||b.height-a.height);
   for(const span of spans){
    const boxes=g.columns.map(col=>{
     const first=col[0];return first?{x:first.x,width:first.width,...span}:null;
    });
    const values:string[]=[];
    for(const box of boxes){
     const result=box&&box.width>=12&&box.height>=12&&hasInk(r,box)?await provider.recognize(contrastTextPng(r,box),pageNumber,{segmentation:'line'}):null;
     values.push(result?.text.trim()??'');
    }
    const mapped=detectBoqHeader([values]);
    if(mapped){header=mapped;headerValues=values;headerBottom=span.y+span.height;break;}
   }
  }
  // A continuation may omit the repeated header. Reuse only the immediately
  // preceding page's explicit roles when every ruled column aligns, the page
  // orientation agrees, and independent quantity/unit cells establish a body.
  // This never certifies its readings: inherited roles remain review evidence.
  if(!header&&previous&&!topCells.flat().some(cell=>/description|quantity|\bqty\b|unit cost|item code|item no/i.test(cell.text))&&
     g.xs.length===previous.columnEdges.length&&Math.abs(r.width/r.height-previous.imageWidth/previous.imageHeight)<.02&&
     Math.abs(rotation-previous.rotation)<.6&&g.xs.every((x,i)=>Math.abs(x/r.width-previous.columnEdges[i]!/previous.imageWidth)<.015)){
   const mapped=detectBoqHeader([previous.rows[0]!]);
   const readings=(role:BoqColumnRole)=>topCells[Number(Object.keys(mapped?.roles??{}).find(k=>mapped!.roles[Number(k)]===role))-1]??[];
   if(mapped&&readings('quantity').filter(cell=>strictNumber(cell.text)!==null).length>=2&&readings('unit').filter(cell=>unitKey(cell.text)!==null).length>=2){
    header=mapped;headerValues=[...previous.rows[0]!];headerBottom=g.top;inheritedHeader=true;
   }
  }
  if(!header){queueDeskew();continue;}
  const roles=header.roles,descriptionColumn=Number(Object.keys(roles).find(k=>roles[Number(k)]==='description'))-1;
   // Recovery must not erase columns already established by a physical
   // header. A tilted/pale alternative recognizing only price headings is
   // not a replacement for an existing quantity-and-unit table.
   const established=mergedFallback&&detectBoqHeader([mergedFallback.rows[0]!]);
   if(established&&Object.values(established.roles).some(role=>!Object.values(roles).includes(role))){queueDeskew();continue;}

  const rows:string[][]=[headerValues],evidenceRows:Record<string,RasterCellEvidence[]>[]=[{}],diagnostics:string[][]=[[]];
  const recoveredDescriptionBoxes=new Set<Box>(g.inferredCells);
  let descriptionStart=descriptionColumn;
  const continuousDividers=descriptionStart>0?faintVertical(r,.26,245):[];
  while(descriptionStart>0&&!roles[descriptionStart]&&!headerValues[descriptionStart-1]?.trim()&&!continuousDividers.some(x=>Math.abs(x-g.xs[descriptionStart]!)<=8))descriptionStart--;
  const descriptionLeft=g.columns[descriptionStart]?.[0]?.x;
  const roleColumn=(role:BoqColumnRole)=>g.columns[Number(Object.keys(roles).find(k=>roles[Number(k)]===role))-1]??[];
  const descBoxes=(g.columns[descriptionColumn]??[]).filter(b=>b.y>=headerBottom).map(box=>{
   // A short spurious separator must not clip the first characters of a
   // description. Include adjacent blank-header, unmapped columns in its crop;
   // explicitly identified item-code and numeric columns remain separate.
   if(descriptionLeft===undefined||descriptionLeft>=box.x)return box;
   const expanded={...box,x:descriptionLeft,width:box.x+box.width-descriptionLeft};
   if(recoveredDescriptionBoxes.has(box))recoveredDescriptionBoxes.add(expanded);
   return expanded;
  }).flatMap(box=>{
   if(!enhanced)return [box];
   // Some originals omit the description divider entirely. A cut then needs
   // aligned physical boundaries in quantity, unit and a pricing column, plus
   // a blank band through the description itself. Never split on text wrapping
   // or an OCR number alone; both resulting description spans must contain ink.
   const cuts=roleColumn('quantity').flatMap((cell,index,column)=>{
    const next=column[index+1];if(!next||next.y-cell.y-cell.height>10)return [];
    const y=Math.round((cell.y+cell.height+next.y)/2);
    if(y<box.y+12||y>box.y+box.height-12)return [];
    const aligns=(role:BoqColumnRole)=>roleColumn(role).some((other,j,a)=>a[j+1]&&Math.abs((other.y+other.height+a[j+1]!.y)/2-y)<=8&&a[j+1]!.y-other.y-other.height<=10);
    if(!aligns('unit')||!(['rate','amount'] as const).some(aligns))return [];
    for(let yy=y-2;yy<=y+2;yy++)for(let x=box.x+4;x<box.x+box.width-4;x++)if(r.pixels[(yy*r.width+x)*4]!<235)return [];
    return [y];
   });
   if(!cuts.length)return [box];
   const edges=[box.y-2,...cuts,box.y+box.height+2];
   const pieces=edges.slice(0,-1).map((y,i)=>({...box,y:y+2,height:edges[i+1]!-y-4}));
   if(pieces.some(piece=>piece.height<10||!hasInk(r,piece)))return [box];
   pieces.forEach(piece=>recoveredDescriptionBoxes.add(piece));return pieces;
  });
  for(const box of descBoxes){
   const desc=await read(box);
   let descriptionText=desc.text;
   if((!desc.text.trim()||(desc.confidence??0)<.90)&&hasInk(r,box)){
    const contrast=await provider.recognize(contrastTextPng(r,box),pageNumber,{segmentation:'block'});
    const isolated=await provider.recognize(descriptionCellPng(r,box),pageNumber,{segmentation:'line'});
    desc.confirmation={text:contrast.text.trim(),confidence:contrast.confidence};
    desc.additionalReadings=[{text:isolated.text.trim(),confidence:isolated.confidence}];
    const candidate=[desc,desc.confirmation,...desc.additionalReadings].filter(reading=>(reading.text.match(/[a-z\u0600-\u06ff]/gi)?.length??0)>=2).sort((a,b)=>(b.confidence??0)-(a.confidence??0))[0];
    if(candidate)descriptionText=candidate.text;
   }
   if(!descriptionText.trim())continue;
   const row=Array(g.columns.length).fill('') as string[],evidence:Record<string,RasterCellEvidence[]>={},issues:string[]=[...(recoveredDescriptionBoxes.has(box)?['BOQ_RASTER_DESCRIPTION_BOUNDARY_REVIEW_REQUIRED']:[]),...(inheritedHeader?['BOQ_RASTER_CONTINUATION_HEADER_REVIEW_REQUIRED']:[])];
   for(const [column,role] of Object.entries(roles)){
    const index=Number(column)-1,boxes=(g.columns[index]??[]).filter(b=>{
     const center=b.y+b.height/2;return center>=box.y-4&&center<=box.y+box.height+4;
    });
    const cells=role==='description'?[desc]:await readBoxes(boxes);evidence[role]=cells;
    if(role==='description'){
     row[index]=simple(descriptionText);
     if(simple(desc.text)!==row[index])issues.push('BOQ_RASTER_DESCRIPTION_REVIEW_REQUIRED');
     continue;
    }
    if(numericRoles.has(role)){
     // An empty first OCR result is not evidence that the physical cell is
     // empty. Read every ink-bearing cell before deciding its row population.
     for(const cell of cells)cell.hasText=hasNumericInk(r,cell.bounds);
     const textCells=cells.filter(c=>strictNumber(c.text)!==null||c.hasText);
     for(const cell of textCells){
      const second=await provider.recognize(cropPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      cell.confirmation={text:second.text.trim(),confidence:second.confidence};
      const third=await provider.recognize(isolatedCellPng(r,cell.bounds,2),pageNumber,{segmentation:'block'});
      const fourth=await provider.recognize(isolatedCellPng(r,cell.bounds,1.5),pageNumber,{segmentation:'line'});
      cell.additionalReadings=[{text:third.text.trim(),confidence:third.confidence},{text:fourth.text.trim(),confidence:fourth.confidence}];
     }
     const readingsOf=(c:RasterCellEvidence)=>[{text:c.text,confidence:c.confidence},...(c.confirmation?[c.confirmation]:[]),...(c.additionalReadings??[])];
     const nonempty=textCells.filter(c=>readingsOf(c).some(v=>v.text.trim()));
     if(!nonempty.length)continue;
     if(nonempty.length!==1){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_MULTIPLE_CELLS');continue;}
     const cell=nonempty[0]!;
     if(cell.bounds.y<box.y-8||cell.bounds.y+cell.bounds.height>box.y+box.height+8){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_ROW_SPAN_REVIEW_REQUIRED');continue;}
     // Grid removal can make several correlated rereads confidently agree on
     // a lost decimal. A weak original reading needs another unaltered crop;
     // processed-image agreement alone cannot certify a pale source number.
     let originalConfirmed=true;
     if((cell.confidence??0)<.90){
      const fifth=await provider.recognize(cropPng(r,cell.bounds,3),pageNumber,{segmentation:'block'});
      cell.additionalReadings!.push({text:fifth.text.trim(),confidence:fifth.confidence});
      originalConfirmed=[cell.confirmation!,{text:fifth.text.trim(),confidence:fifth.confidence}].every(v=>(v.confidence??0)>=.90&&strictNumber(v.text)!==null);
     }
     const readings=[{text:cell.text,confidence:cell.confidence},cell.confirmation,...cell.additionalReadings!];
     const numeric=readings.filter((v):v is {text:string;confidence:number|null}=>!!v&&strictNumber(v.text)!==null);
     const confident=numeric.filter(v=>(v.confidence??0)>=.90),values=new Set(numeric.map(v=>strictNumber(v.text)));
     // Preserve disagreement across original and isolated pixels. Two equally
     // readings of 3.00 and 300 must never be silently reconciled. A confidence
     // score cannot discard a contrary, syntactically valid source reading.
     if(!originalConfirmed)issues.push('BOQ_RASTER_'+role.toUpperCase()+'_ORIGINAL_CONFIRMATION_REQUIRED');
     if(!originalConfirmed||confident.length<2||values.size!==1){issues.push('BOQ_RASTER_'+role.toUpperCase()+'_REVIEW_REQUIRED');continue;}
     row[index]=confident[0]!.text;
    }else{
     const nonempty=cells.filter(c=>c.text.trim());
     if(!nonempty.length)continue;
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
     if(cell.confidence===null||cell.confidence<.90){
      issues.push('BOQ_RASTER_'+role.toUpperCase()+'_REVIEW_REQUIRED');
      continue;
     }
     row[index]=simple(cell.text);
    }
   }
   const physicalCells=Object.values(evidence).flat().sort((a,b)=>a.bounds.x-b.bounds.x);
   const physicalTexts=[false,true].map(confirmed=>physicalCells.map(cell=>(confirmed?cell.confirmation?.text:undefined)??cell.text).join('').replace(/\s+/g,''));
   // OCR can divide "Page 1 of 8" across projected description/quantity
   // columns and read its g as j. This whole-row footer is never a BOQ item.
   if(physicalTexts.some(text=>/^pa[gji]e\d+(?:of|0f)\d+$/i.test(text)))continue;
   rows.push(row);evidenceRows.push(evidence);diagnostics.push(issues);
  }
  if(rows.length>1){
   const result={rows,cells:evidenceRows,diagnostics,rotation,imageWidth:r.width,imageHeight:r.height,columnEdges:[...g.xs]};
   // A recognizable header is not enough when one description cell spans
   // several quantity/unit cells. Let pale/compact geometry try to separate
   // the physical rows; retain the unresolved original if none succeeds.
   if(diagnostics.some(row=>row.includes('BOQ_RASTER_QUANTITY_MULTIPLE_CELLS')||row.includes('BOQ_RASTER_UNIT_MULTIPLE_CELLS')||row.some(issue=>issue.endsWith('_ROW_SPAN_REVIEW_REQUIRED')))){
    if(!mergedFallback||rows.length>mergedFallback.rows.length)mergedFallback=result;
    // A recognized table with body rows establishes its orientation. Further
    // geometry recovery should inspect that table and its small skew, rather
    // than repeatedly OCR the same page sideways and upside down.
    tableOrientation=rotation;
    queueDeskew();
    rotations.splice(orientationIndex+1,rotations.length-orientationIndex-1,...rotations.slice(orientationIndex+1).filter(angle=>angle%90!==0));
    continue;
   }
   return result;
  }
  }finally{c.width=1;c.height=1;}
 }
 }
 return mergedFallback;
}
