#!/bin/bash
# Capture all live projects (two streams). Usage: capture_all.sh <tag> [base]
T=$(cd "$(dirname "$0")" && pwd); D=${OUT:-./matrix-out}/cap-$1; B=${2:-https://cmeng-main-production.up.railway.app}; mkdir -p $D
python3 -c "import json,urllib.request;print('\n'.join(p['projectId'] for p in json.load(urllib.request.urlopen('$B/api/portfolio',timeout=120))['projects']))" > $D/projects.txt
mapfile -t P < $D/projects.txt; A=(); Bs=(); for i in "${!P[@]}"; do if (( i % 2 )); then Bs+=("${P[$i]}"); else A+=("${P[$i]}"); fi; done
run(){ for p in "$@"; do o="$D/$(echo "$p" | tr '()' '__')"; mkdir -p "$o"; t0=$(date +%s); timeout 2400 node $T/capture2.cjs $B "$p" "$o" > "$o.log" 2>&1; echo "$(date +%T) $p $(( $(date +%s)-t0 ))s $(grep -c FAILED "$o.log")" >> $D/progress.txt; done; }
run "${A[@]}" & run "${Bs[@]}" & wait; echo CAPTURE_DONE >> $D/progress.txt
