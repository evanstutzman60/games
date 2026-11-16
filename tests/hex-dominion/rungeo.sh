#!/bin/bash
# usage: rungeo.sh <html> <tag> <games per process>

node tests/hex-dominion/geo.js $1 $3 100000 tests/hex-dominion/geo_$2_a.jsonl & node tests/hex-dominion/geo.js $1 $3 200000 tests/hex-dominion/geo_$2_b.jsonl & wait
echo done > tests/hex-dominion/geo_$2.done
