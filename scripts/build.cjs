const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const sources = {
  INVELLA_CSS: read('assets/invella-bundle.css'),
  INVELLA_SDK: read('supabase.min.js'),
  INVELLA_NETWORK: read('assets/invella-network.js'),
  INVELLA_APP: read('assets/invella-app.js'),
  INVELLA_EDITOR: read('assets/invella-premium-fix.js')
};
for (const page of ['index.html', 'admin.html']) {
  const html = read('src/' + page).replace(/\{\{(INVELLA_[A-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(sources, key)) throw new Error('Unknown build token ' + key);
    return sources[key].replace(/<\/(script|style)/gi, '<\\/$1');
  });
  if (/\{\{INVELLA_/.test(html)) throw new Error('Unresolved build token');
  fs.writeFileSync(path.join(root, page), html);
  console.log('Built ' + page + ': ' + Buffer.byteLength(html) + ' bytes; CSS and application code included');
}
