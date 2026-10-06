#!/bin/bash
# render listed chunks sequentially (args: chunk names, or none for all)
cd "$(dirname "$0")"
while read n a b; do
  if [ $# -gt 0 ] && [[ ! " $* " =~ " $n " ]]; then continue; fi
  node render.js $n $a $b
done < chunks.txt
