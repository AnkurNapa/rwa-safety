// Builds preview.html: real config, real translations, fake google.script.run (saves nothing).
const fs = require('fs');
global.Logger = { log() {} };
const cfg = new Function(fs.readFileSync('Code.gs', 'utf8') + ';return pageConfig_()')();
const stub = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><script>window.google={script:{run:{withSuccessHandler(s){this.s=s;return this},withFailureHandler(){return this},' +
  'submit(f){window.lastSubmit=f;setTimeout(()=>this.s({ticket:"TKT-0042"}),300)}}}};</script>';
const html = fs.readFileSync('Index.html', 'utf8')
  .replace("<?!= HtmlService.createHtmlOutputFromFile('I18n').getContent() ?>", fs.readFileSync('I18n.html', 'utf8'))
  .replace('<?!= JSON.stringify(cfg) ?>', JSON.stringify(cfg))
  .replace('<base target="_top">', stub);
if (html.includes('<?')) throw new Error('unreplaced scriptlet');
fs.writeFileSync('preview.html', html);
