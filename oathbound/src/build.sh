#!/bin/sh
# Assemble the single-file game from its parts.
cd "$(dirname "$0")" && { cat head.html logic.js; echo "// ===LOGIC-END==="; cat ui.js; echo "</script></body></html>"; } > ../index.html
