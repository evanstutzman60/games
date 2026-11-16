#!/bin/bash

run(){ node tests/hex-dominion/var.js tests/hex-dominion/snap.html 36 "$1" >> tests/hex-dominion/vars.out 2>&1; }
: > tests/hex-dominion/vars.out
run '{"cap":1.2,"capMin":8}' & run '{"mergeK":0.15}' & wait
run '{"danger":6}' & run '{"lose":0.5}' & wait
run '{"gain":0.4,"town":45}' & run '{"garr":30}' & wait
echo done >> tests/hex-dominion/vars.out
