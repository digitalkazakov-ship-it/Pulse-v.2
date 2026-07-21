// vite-plugin-singlefile inlines the JS as a classic IIFE (no import/export),
// but Vite's HTML plugin still tags the <script> as type="module" and places it
// in <head> — which works for modules (implicitly deferred regardless of
// position) but breaks classic scripts two ways once we strip that type:
//   1. Safari refuses to execute type="module" scripts opened via file://.
//   2. `defer` is spec-ignored on inline (no-src) scripts, so simply adding it
//      back does nothing — a bare script in <head> still runs immediately,
//      before <div id="root"> exists in <body> (React error #299: no container).
// Fix: strip type="module", and physically move the script block to just
// before </body>, after the root div, so synchronous execution finds the DOM ready.
import { readFileSync, writeFileSync } from 'fs';

const path = 'dist-archive/archive.html';
let html = readFileSync(path, 'utf-8');

const openTag = '<script type="module" crossorigin>';
const startIdx = html.indexOf(openTag);
if (startIdx === -1) throw new Error('Could not find inlined module script tag');
const endIdx = html.indexOf('</script>', startIdx) + '</script>'.length;

const scriptBlock = '<script>' + html.slice(startIdx + openTag.length, endIdx);
html = html.slice(0, startIdx) + html.slice(endIdx);

// NOTE: deliberately NOT using html.replace('</body>', scriptBlock + '</body>') here.
// String.replace()'s *string* replacement argument treats $&, $`, $', $$ as special
// patterns (even though the search argument is a plain string, not a regex) — and the
// bundle's own minified code contains the literal two-char sequence $` (a regex
// ending in "$" immediately followed by a template-literal backtick), which JS
// interprets as "insert everything before the match". That silently spliced in a
// huge chunk of the document and corrupted the script. Plain slicing has no such gotcha.
const bodyCloseIdx = html.lastIndexOf('</body>');
if (bodyCloseIdx === -1) throw new Error('Could not find </body>');
html = html.slice(0, bodyCloseIdx) + scriptBlock + html.slice(bodyCloseIdx);

writeFileSync(path, html);
console.log('Moved inlined script (as classic, non-module) to end of <body>');
