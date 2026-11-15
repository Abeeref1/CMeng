#!/bin/bash
# Capture listed projects (two streams). Usage: capture_list.sh <out dir> <base> <project...>
T=$(cd "$(dirname "$0")" && pwd); D=$1; B=$2; shift 2; mkdir -p $D; P=("$@"); A=(); Bs=()
for i in "${!P[@]}"; do if (( i % 2 )); then Bs+=("${P[$i]}"); else A+=("${P[$i]}"); fi; done
run(){ for p in "$@"; do o="$D/$(echo "$p" | tr '()' '__')"; mkdir -p "$o"; t0=$(date +%s); timeout 3600 node $T/capture2.cjs $B "$p" "$o" > "$o.log" 2>&1; echo "$(date +%T) $p $(( $(date +%s)-t0 ))s $(grep -c FAILED "$o.log")" >> $D/progress.txt; done; }
run "${A[@]}" & run "${Bs[@]}" & wait; echo CAPTURE_DONE >> $D/progress.txt
