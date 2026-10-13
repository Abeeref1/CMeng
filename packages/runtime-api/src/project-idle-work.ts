/** Low-priority per-project work: foreground page requests always get the next idle turn.
 * Tasks run serially and never restart simply because the page is opened.
 * A running document cannot be interrupted; its page checkpoints remain durable.
 */
export function scheduleIdleProjectWork(
  next:()=>Promise<boolean>,
  options:{idleMillis?:number;onError?:(error:unknown)=>void}={}
){
  const idleMillis=Math.max(0,Math.floor(options.idleMillis??4000));
  let inFlight=0,running=false,complete=false,closed=false;
  let timer:NodeJS.Timeout|undefined;
  const clear=()=>{if(timer){clearTimeout(timer);timer=undefined;}};
  const arm=()=>{
    if(closed||complete||running||inFlight>0||timer)return;
    timer=setTimeout(()=>{
      timer=undefined;
      if(closed||complete||running||inFlight>0)return;
      running=true;
      void Promise.resolve().then(next).then(hasMore=>{
        if(!hasMore)complete=true;
      }).catch(error=>{
        complete=true;
        options.onError?.(error);
      }).finally(()=>{
        running=false;
        arm();
      });
    },idleMillis);
    timer.unref?.();
  };
  return {
    start:arm,
    requestStarted:()=>{if(closed)return;inFlight++;clear();},
    requestFinished:()=>{if(inFlight>0)inFlight--;arm();},
    close:()=>{closed=true;clear();},
  };
}
