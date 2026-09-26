import type {IncomingMessage,OutgoingHttpHeaders,ServerResponse} from 'node:http';
import {Readable,pipeline} from 'node:stream';
import {createBrotliCompress,createGzip,constants} from 'node:zlib';

type Encoding='br'|'gzip';
/** Negotiate supported encodings, including explicit exclusions and preferences. */
function encodingFor(header:string|undefined):Encoding|null {
  const accepted=new Map<string,number>();
  for(const part of (header??'').split(',')){
    const [name,...parameters]=part.trim().toLowerCase().split(';');if(!name)continue;
    const parameter=parameters.find(p=>p.trim().startsWith('q='));
    const q=parameter===undefined?1:Number(parameter.trim().slice(2));
    accepted.set(name,Number.isFinite(q)&&q>=0&&q<=1?q:0);
  }
  const quality=(name:string)=>accepted.get(name)??accepted.get('*')??0;
  const chosen:Encoding=quality('br')>=quality('gzip')?'br':'gzip';
  return quality(chosen)>0&&(accepted.get('identity')??0)<=quality(chosen)?chosen:null;
}

function prepare(res:ServerResponse,status:number,input:OutgoingHttpHeaders,size:number|null){
  const headers:OutgoingHttpHeaders=Object.fromEntries(Object.entries(input).map(([k,v])=>[k.toLowerCase(),v]));
  const type=String(headers['content-type']??res.getHeader('content-type')??'');
  const eligible=res.req.method!=='HEAD'&&status>=200&&![204,206,304].includes(status)&&!res.req.headers.range&&
    !headers['content-encoding']&&!headers['content-range']&&
    !/\bno-transform\b/i.test(String(headers['cache-control']??res.getHeader('cache-control')??''))&&
    /^(?:application\/(?:json|[^;]+\+json|javascript)|text\/(?:html|plain|css|csv|javascript))(?:;|$)/i.test(type)&&
    (size===null||size>=1024);
  let encoding:Encoding|null=null;
  if(eligible){
    const vary=String(headers.vary??res.getHeader('vary')??'').split(',').map(x=>x.trim()).filter(Boolean);
    if(!vary.some(x=>x==='*'||x.toLowerCase()==='accept-encoding'))vary.push('Accept-Encoding');
    headers.vary=vary.join(', ');
    encoding=encodingFor(res.req.headers['accept-encoding']);
  }
  if(encoding){
    headers['content-encoding']=encoding;
    delete headers['content-length'];delete headers['transfer-encoding'];
    res.removeHeader('content-length');res.removeHeader('transfer-encoding');
  }
  res.writeHead(status,headers);
  return encoding;
}

function transfer(source:Readable,res:ServerResponse,encoding:Encoding|null){
  // Streaming zlib work uses the worker pool and preserves network backpressure.
  // A disconnected reader cancels its stream; no synchronous compression blocks other projects.
  const done=(error:NodeJS.ErrnoException|null)=>{if(error&&!res.destroyed)res.destroy(error);};
  if(encoding==='br')pipeline(source,createBrotliCompress({params:{[constants.BROTLI_PARAM_QUALITY]:4}}),res,done);
  else if(encoding==='gzip')pipeline(source,createGzip({level:4}),res,done);
  else pipeline(source,res,done);
}

export function sendHttpBody(res:ServerResponse,status:number,headers:OutgoingHttpHeaders,body:string|Buffer){
  if(res.destroyed||res.writableEnded)return;
  const bytes=Buffer.isBuffer(body)?body:Buffer.from(body);
  const encoding=prepare(res,status,{'content-length':bytes.length,...headers},bytes.length);
  if(encoding)transfer(Readable.from([bytes]),res,encoding);else res.end(bytes);
}

/** Internal workers send identity bytes; the public edge negotiates per request.
 * The persisted calculation cache therefore never depends on a client's encoding. */
export function forwardHttpBody(res:ServerResponse,incoming:IncomingMessage){
  if(res.destroyed){incoming.resume();return;}
  const length=Number(incoming.headers['content-length']);
  const encoding=prepare(res,incoming.statusCode??502,incoming.headers,Number.isFinite(length)?length:null);
  transfer(incoming,res,encoding);
}
