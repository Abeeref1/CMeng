#!/bin/sh
# TEMPORARY, test service only: the agreed release-latency gate (unchanged script) on Railway
# hardware, alternating the V8 young-generation size to measure garbage-collection cost.
node -e "require('http').createServer((q,s)=>{s.writeHead(200,{'content-type':'application/json'});s.end('{\"status\":\"ok\"}')}).listen(process.env.PORT||3000)" &
unset RAILWAY_VOLUME_MOUNT_PATH
node -e "const os=require('os');console.log('GATE_HOST availableParallelism='+os.availableParallelism()+' cpus='+os.cpus().length+' model='+(os.cpus()[0]||{}).model+' newSpaceMB='+require('v8').getHeapSpaceStatistics().find(s=>s.space_name==='new_space').space_available_size/1048576)"
for k in 1 2 3 4; do for semi in default 32 64; do
  if [ "$semi" = default ]; then unset NODE_OPTIONS; else export NODE_OPTIONS="--max-semi-space-size=$semi"; fi
  CMENG_LATENCY_RESULT=/tmp/lat.json node scripts/release-latency.cjs > /tmp/lat.log 2>&1
  unset NODE_OPTIONS
  node -e "
    const d=JSON.parse(require('fs').readFileSync('/tmp/lat.json','utf8'));const c=d.coldProjectShapes||{};
    const m={};for(const e of d.managementProfileEvents||[])m[e.projectId]=Math.round(e.totalMs);
    const rows=(c.profiles||[]).map(r=>r.projectId.slice(-1)+':'+Math.round(r.durationMs)+'/calc'+m[r.projectId]).join(' ');
    console.log('GATE_AB semi=$semi run $k coldShapesMax='+Math.round(c.maxProjectMs)+' ['+rows+'] priorCold='+Math.round(d.priorColdGate.coldRequestMs)+' firstDash='+Math.round(d.firstDashboardMs)+' uploadToReady='+Math.round(d.uploadToReadyMs)+' passed='+d.passed)" || tail -20 /tmp/lat.log
done; done
echo GATE_DONE
sleep 86400
