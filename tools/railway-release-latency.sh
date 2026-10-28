#!/bin/sh
# TEMPORARY, test service only: run the agreed release-latency gate
# (scripts/release-latency.cjs, unchanged) on Railway hardware. A tiny health
# responder keeps the platform health check green while the gate runs.
node -e "require('http').createServer((q,s)=>{s.writeHead(200,{'content-type':'application/json'});s.end('{\"status\":\"ok\"}')}).listen(process.env.PORT||3000)" &
unset RAILWAY_VOLUME_MOUNT_PATH
node -e "const os=require('os');console.log('GATE_HOST availableParallelism='+os.availableParallelism()+' cpus='+os.cpus().length+' model='+(os.cpus()[0]||{}).model)"
for k in 1 2 3; do
  CMENG_LATENCY_RESULT=/tmp/lat-$k.json node scripts/release-latency.cjs > /tmp/lat-$k.log 2>&1
  node -e "
    const d=JSON.parse(require('fs').readFileSync('/tmp/lat-$k.json','utf8'));const c=d.coldProjectShapes||{};
    const m={};for(const e of d.managementProfileEvents||[])m[e.projectId]=Math.round(e.totalMs);
    const rows=(c.profiles||[]).map(r=>r.projectId.slice(-1)+':'+Math.round(r.durationMs)+'/calc'+m[r.projectId]).join(' ');
    console.log('GATE_RESULT run $k coldShapesMax='+Math.round(c.maxProjectMs)+' wall='+Math.round(c.wallMs)+' ['+rows+'] priorCold='+Math.round(d.priorColdGate.coldRequestMs)+' prep='+Math.round(d.priorColdGate.preparationMs)+' firstDash='+Math.round(d.firstDashboardMs)+' uploadToReady='+Math.round(d.uploadToReadyMs)+' accountabilityMax='+Math.round(d.accountabilityConcurrency.maxProjectMs)+' passed='+d.passed)" || tail -30 /tmp/lat-$k.log
done
echo GATE_DONE
sleep 86400
