#!/bin/bash
# Fresh-project test: a new local server on an empty data folder, one project per programme kind, each made by uploading its file.
# Usage: fresh.sh <data dir> <port> <PROJECT=file> ...
D=$1; PORT=$2; shift 2; B=http://127.0.0.1:$PORT
cd "$(cd "$(dirname "$0")/../.." && pwd)"
CMENG_DATA_DIR=$D PORT=$PORT HOST=127.0.0.1 CMENG_OCR_ENABLED=0 nohup node dist/packages/runtime-api/src/project-gateway.js > $D/server.log 2>&1 &
echo $! > $D/server.pid
for i in $(seq 1 90); do curl -s --max-time 5 $B/health >/dev/null && break; sleep 2; done
for pair in "$@"; do P=${pair%%=*}; F=${pair#*=}
  t0=$(date +%s)
  curl -s -X POST $B/api/projects -H 'content-type: application/json' -d "{\"projectId\":\"$P\",\"testProject\":true}" > /dev/null
  code=$(curl -s -o $D/upload-$P.json -w '%{http_code}' --max-time 3600 -X POST "$B/api/projects/$P/evidence/uploads" -H "x-source-filename: $(basename $F)" -H "x-upload-id: up-$P" -H 'content-type: application/octet-stream' --data-binary @$F)
  echo "$(date +%T) $P upload http $code in $(( $(date +%s)-t0 ))s" >> $D/progress.txt
done
echo UPLOADS_DONE >> $D/progress.txt
