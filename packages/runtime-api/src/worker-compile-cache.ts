import {enableCompileCache,flushCompileCache} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// Every project worker loads the same ~950 compiled JavaScript modules before
// it can read its project. With 4 projects on 2 workers that load sits on the
// critical path at every eviction. Node's V8 compile cache keeps the compiled
// bytecode of those program files (keyed by file content and Node version, so a
// new release recompiles). It holds no project data and no calculated result.
// Imported first by project-http-worker so it applies to the whole module graph.
try{
  if(process.env.CMENG_WORKER_COMPILE_CACHE!=='0')
    enableCompileCache(process.env.CMENG_WORKER_COMPILE_CACHE_DIR?.trim()||join(tmpdir(),'cmeng-worker-compile-cache'));
}catch{/* Startup must never depend on the cache; modules load normally. */}

// Written once the worker has loaded its modules, so a later eviction
// (worker.terminate) cannot lose the compiled bytecode of this start.
export function flushWorkerCompileCache(){try{flushCompileCache();}catch{/* optional */}}
