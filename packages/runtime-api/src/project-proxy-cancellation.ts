import type {IncomingMessage,ClientRequest,ServerResponse} from 'node:http';

/**
 * A project may be waiting for a cold calculation when a browser changes
 * projects or closes its tab. The detached HTTP response must not keep its
 * gateway lane reserved until the obsolete result has finished streaming.
 *
 * This only aborts the upstream transport. It never marks an upload, a
 * calculation, or an evidence decision complete, and it never deletes data.
 */
export function abortProjectProxyOnDisconnect(
  request:IncomingMessage,
  response:ServerResponse,
  upstream:ClientRequest,
  onCancellation?:()=>void,
){
  let active=true;
  const cleanup=()=>{
    if(!active)return;
    active=false;
    request.off('aborted',onAbort);
    response.off('close',onResponseClose);
    upstream.off('close',cleanup);
  };
  const cancel=()=>{
    if(!active||response.writableFinished)return;
    cleanup();
    onCancellation?.();
    upstream.destroy(new Error('CMENG_CLIENT_CONNECTION_CLOSED'));
  };
  const onAbort=()=>cancel();
  const onResponseClose=()=>{
    if(response.writableFinished)cleanup();
    else cancel();
  };
  request.once('aborted',onAbort);
  response.once('close',onResponseClose);
  upstream.once('close',cleanup);
  // Disconnection can occur while the request was waiting for a worker.
  if(request.aborted||(response.destroyed&&!response.writableFinished))cancel();
  return cleanup;
}
