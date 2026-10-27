const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'public');
fs.mkdirSync(out, { recursive: true });
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sources = {
  INVELLA_CSS: read('assets/invella-bundle.css'),
  INVELLA_SDK: read('supabase.min.js'),
  INVELLA_NETWORK: read('assets/invella-network.js'),
  INVELLA_APP: read('assets/invella-app.js'),
  INVELLA_EDITOR: read('assets/invella-premium-fix.js'),
  INVELLA_READY: read('assets/invella-ready.js')
};
for (const page of ['index.html', 'admin.html']) {
  const html = read('src/' + page).replace(/\{\{(INVELLA_[A-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(sources, key)) throw new Error('Unknown build token ' + key);
    return sources[key].replace(/<\/(script|style)/gi, '<\\/$1');
  });
  if (/\{\{INVELLA_/.test(html)) throw new Error('Unresolved build token');
  fs.writeFileSync(path.join(root, page), html);
  fs.writeFileSync(path.join(out, page), html);
  console.log('Built ' + page + ': ' + Buffer.byteLength(html) + ' bytes; CSS and application code included');
}

for (const file of ['connection-check.html','supabase.min.js','assets/invella-bundle.css','assets/invella-app.js','assets/invella-premium-fix.js','assets/atelier-preview.css']) {
 const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);
}
