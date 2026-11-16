#!/bin/bash
: > tests/hex-dominion/meta.out
r(){ echo "$1 $3 $(node tests/hex-dominion/meta.js $2 200 "$3" | cut -c1-75)" >> tests/hex-dominion/meta.out; }
r BEFORE tests/hex-dominion/before.html '["eco","mixed","tech","troops"]' & r BEFORE tests/hex-dominion/before.html '["workshops","works","eco","mixed"]' & wait
r AFTER hex-dominion/index.html '["eco","mixed","tech","troops"]' & r AFTER hex-dominion/index.html '["workshops","works","eco","mixed"]' & wait
r AFTER hex-dominion/index.html '["techM","techE","techN","mixed"]' & r BEFORE tests/hex-dominion/before.html '["techM","techE","techN","mixed"]' & wait
echo done >> tests/hex-dominion/meta.out
