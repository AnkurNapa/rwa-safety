// Builds docs/index.html (GitHub Pages) from the Apps Script sources: same page, same translations,
// same config. Reports go to the Apps Script /exec URL in backend-url.txt. If that file is empty,
// the site runs in demo mode: a banner says nothing is saved, and the ticket reads DEMO.
// Usage: node tools/build_site.js
const fs = require('fs');

global.Logger = { log() {} };
const read = f => fs.readFileSync(f, 'utf8');
const cfg = new Function(read('Code.gs') + ';return pageConfig_()')();
const backend = fs.existsSync('backend-url.txt') ? read('backend-url.txt').trim() : '';
if (backend && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(backend)) {
  throw new Error('backend-url.txt must hold an Apps Script web app URL ending in /exec');
}

const head = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f6f7f9">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="RWA Safety">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<title>RWA Safety</title>`;

// google.script.run look-alike, so Index.html runs unchanged outside Apps Script.
const shim = `<script>
const BACKEND = ${JSON.stringify(backend)};
window.google = { script: { run: (() => {
  let ok = () => {}, fail = () => {};
  const r = {
    withSuccessHandler(f) { ok = f; return r; },
    withFailureHandler(f) { fail = f; return r; },
    submit(form) {
      if (!BACKEND) { setTimeout(() => ok({ ticket: 'DEMO' }), 400); return; }
      // text/plain body: Apps Script accepts it without a CORS preflight.
      fetch(BACKEND, { method: 'POST', body: JSON.stringify(form) })
        .then(res => res.json())
        .then(d => (d.ok ? ok({ ticket: d.ticket }) : fail(new Error(d.error || 'e_generic'))))
        .catch(() => fail(new Error('e_generic')));
    },
  };
  return r;
})() } };
</script>`;

const demoBanner = backend ? '' : `<div style="background:#d65a57;color:#fff;text-align:center;font:600 13px Archivo,sans-serif;padding:8px 12px">
DEMO MODE. Reports are not saved yet. In an emergency call 112.</div>`;

let html = read('Index.html')
  .replace('<base target="_top">', head + '\n' + shim)
  .replace('<div class="app">', demoBanner + '\n<div class="app">')
  .replace("<?!= HtmlService.createHtmlOutputFromFile('I18n').getContent() ?>", read('I18n.html'))
  .replace('<?!= JSON.stringify(cfg) ?>', JSON.stringify(cfg));
if (html.includes('<?')) throw new Error('unreplaced Apps Script scriptlet in Index.html');

const manifest = {
  name: 'RWA Safety', short_name: 'Safety', description: 'Report a safety problem in the building',
  start_url: '.', scope: '.', display: 'standalone', background_color: '#f6f7f9', theme_color: '#f6f7f9',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
};

fs.mkdirSync('docs', { recursive: true });
fs.writeFileSync('docs/index.html', html);
fs.writeFileSync('docs/manifest.webmanifest', JSON.stringify(manifest, null, 2));
fs.writeFileSync('docs/.nojekyll', '');
console.log('docs/ built,', backend ? 'live backend' : 'DEMO mode (backend-url.txt empty)');
