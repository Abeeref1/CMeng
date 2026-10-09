import {parentPort,workerData} from 'node:worker_threads';
import {existsSync,mkdirSync,copyFileSync,renameSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createWorker,PSM} from 'tesseract.js';
import type {TesseractOcrOptions} from './tesseract-provider';

const options=workerData as TesseractOcrOptions;
const languages=typeof options.languages==='string'?options.languages.split('+'):options.languages??['eng'];
void (async()=>{
  // English and Arabic ship with the application, so a new project does not
  // need a CDN request before its first scanned document can be read.
  const bundled:Record<string,string>={eng:'@tesseract.js-data/eng',ara:'@tesseract.js-data/ara'};
  let langPath=options.langPath;
  if(!langPath&&languages.every(code=>bundled[code])){
    langPath=join(options.cachePath??join(tmpdir(),'cmeng-ocr-'+process.pid),'bundled-1.0.0');mkdirSync(langPath,{recursive:true});
    for(const code of languages){
      const target=join(langPath,code+'.traineddata.gz');if(existsSync(target))continue;
      const temporary=target+'.'+randomUUID()+'.tmp';
      copyFileSync(join(dirname(require.resolve(bundled[code]!+'/package.json')),'4.0.0_best_int',code+'.traineddata.gz'),temporary);renameSync(temporary,target);
    }
  }
  const reader=await createWorker(languages,undefined,{
    ...(langPath?{langPath}:{}),
    ...(options.cachePath?{cachePath:options.cachePath}:{}),
  });
  parentPort!.on('message',message=>{
    if(message.type!=='recognize')return;
    void (async()=>{
      // Per-recognition parameters are saved/restored by Tesseract.js, so a
      // cell reading cannot change a subsequent whole-page request.
      const recognitionOptions=message.options?{tessedit_pageseg_mode:message.options.segmentation==='line'?PSM.SINGLE_LINE:message.options.segmentation==='word'?PSM.SINGLE_WORD:PSM.SINGLE_BLOCK}:{};
      return reader.recognize(Buffer.from(message.image),recognitionOptions as Partial<import('tesseract.js').RecognizeOptions> & Partial<import('tesseract.js').WorkerParams>);
    })().then(({data})=>parentPort!.postMessage({type:'result',id:message.id,result:{
      text:data.text??'',confidence:typeof data.confidence==='number'?data.confidence/100:null,language:languages.join('+'),diagnostics:[],
    }}),error=>parentPort!.postMessage({type:'failed',id:message.id,message:error instanceof Error?error.message:String(error)}));
  });
  parentPort!.postMessage({type:'ready'});
})().catch(error=>parentPort!.postMessage({type:'failed',message:error instanceof Error?error.message:String(error)}));
