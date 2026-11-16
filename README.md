# Games

Two browser games, each a single self-contained HTML file with no build step.

- `hex-dominion/index.html` : turn-based hex strategy, 1 to 4 players (human or AI)
- `wardens-of-the-vale/index.html` : tower defense with an 8-level campaign
- `index.html` : landing page linking to both
- `tests/` : Node scripts that play the games headlessly to check rules and balance

## Playing

With GitHub Pages turned on, the games are at:

    https://<username>.github.io/<repo>/hex-dominion/
    https://<username>.github.io/<repo>/wardens-of-the-vale/

## How the code is laid out

Each game file has its rules between `// ===LOGIC-START===` and `// ===LOGIC-END===`. Nothing in that section touches the page, so the test scripts extract it and run it in Node.

## Running the tests

Needs Node 18 or newer. From the repository root:

    node tests/hex-dominion/feat.js hex-dominion/index.html        # rule checks
    node tests/hex-dominion/eco.js hex-dominion/index.html 40 all  # 40 all-AI games
    node tests/hex-dominion/rivercheck.js hex-dominion/index.html 300
    node tests/hex-dominion/bridgepos.js hex-dominion/index.html
    node tests/wardens-of-the-vale/lv.js wardens-of-the-vale/index.html maps
    node tests/wardens-of-the-vale/lv.js wardens-of-the-vale/index.html check
    node tests/wardens-of-the-vale/ui2.js wardens-of-the-vale/index.html


## Oathbound

Co-op RPG, 1 to 4 heroes (human or AI), one generated three-act adventure per run. Play: `oathbound/`.
The game file is assembled from `oathbound/src/` with `sh oathbound/src/build.sh`.
Tests: `node tests/oathbound/sim.js oathbound/index.html 300 warrior,rogue,mage,priest` (full AI runs) and `node tests/oathbound/uitest.js oathbound/index.html 10 1` (random clicks through the UI).
Campaign mode: `node tests/oathbound/simc.js oathbound/index.html 60 warrior,rogue,mage,priest` plays whole five-chapter campaigns with an AI party and reports per-chapter win rates.
