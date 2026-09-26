import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import type {OcrPageResult,OcrProvider} from './types';

export interface TesseractOcrOptions {
  languages?:string|string[];
  langPath?:string;
  cachePath?:string;
  timeoutMs?:number;
}
type Session={worker:Worker;ready:Promise<void>;fail:(error:Error)=>void;pending:Map<number,{resolve:(value:OcrPageResult)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>};

// Tesseract can throw from a worker message listener rather than reject its
// public promise. Keep that library in a dedicated, disposable worker boundary.
// An OCR failure must never terminate the project server or its upload request.
export class TesseractOcrProvider implements OcrProvider {
  readonly name='tesseract.js';
  private session:Session|null=null;
  private sequence=0;
  private closed=false;
  private tail:Promise<unknown>=Promise.resolve();
  private terminations:Promise<unknown>[]=[];
  constructor(private readonly options:TesseractOcrOptions={}){}

  private timeout(){const configured=this.options.timeoutMs??Number(process.env.CMENG_OCR_TIMEOUT_MS??120000);return Number.isFinite(configured)&&configured>0?configured:120000;}
  private start():Session {
    if(this.closed)throw new Error('OCR_READER_CLOSED');
    if(this.session)return this.session;
    const worker=new Worker(join(__dirname,'tesseract-worker.js'),{workerData:this.options});
    let resolveReady!:()=>void,rejectReady!:(error:Error)=>void,failed=false;
    const ready=new Promise<void>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const timer=setTimeout(()=>session.fail(new Error('OCR_INITIALIZATION_TIMEOUT')),this.timeout());
    const session:Session={worker,ready,pending:new Map(),fail:error=>{
      if(failed)return;failed=true;clearTimeout(timer);rejectReady(error);
      for(const task of session.pending.values()){clearTimeout(task.timer);task.reject(error);}session.pending.clear();
      if(this.session===session)this.session=null;
      this.terminations.push(worker.terminate().catch(()=>{}));
    }};
    void ready.catch(()=>{});
    worker.on('message',message=>{
      if(failed)return;
      if(message.type==='ready'){clearTimeout(timer);resolveReady();return;}
      if(message.type==='failed'){session.fail(new Error('OCR_READING_FAILED: '+String(message.message)));return;}
      const task=session.pending.get(message.id);if(!task)return;
      clearTimeout(task.timer);session.pending.delete(message.id);task.resolve(message.result);
    });
    worker.on('error',error=>session.fail(new Error('OCR_READING_FAILED: '+error.message,{cause:error})));
    worker.on('exit',code=>session.fail(new Error('OCR_WORKER_STOPPED: '+code)));
    this.session=session;return session;
  }

  recognize(image:Uint8Array,pageNumber:number):Promise<OcrPageResult>{
    const task=this.tail.then(async()=>{
      const session=this.start();await session.ready;
      if(this.closed||this.session!==session)throw new Error('OCR_READER_CLOSED');
      return new Promise<OcrPageResult>((resolve,reject)=>{
        const id=++this.sequence,timer=setTimeout(()=>session.fail(new Error('OCR_PAGE_TIMEOUT: '+pageNumber)),this.timeout());
        session.pending.set(id,{resolve,reject,timer});
        try{session.worker.postMessage({type:'recognize',id,image});}catch(error){session.fail(error instanceof Error?error:new Error(String(error)));}
      });
    });
    this.tail=task.catch(()=>{});return task;
  }

  async close():Promise<void>{
    this.closed=true;this.session?.fail(new Error('OCR_READER_CLOSED'));
    await Promise.all(this.terminations);await this.tail;
  }
}
