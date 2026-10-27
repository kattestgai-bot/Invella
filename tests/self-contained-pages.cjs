const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
execFileSync(process.execPath, [path.join(root, 'scripts/build.cjs')]);
for (const page of ['index.html', 'admin.html']) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(?:supabase|invella)/i);
  assert.doesNotMatch(html, /<link[^>]+href=["'][^"']*invella-bundle/i);
  assert.doesNotMatch(html, /\{\{INVELLA_|invellaStartupLoader|api\/startup-assets/);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
  assert.match(html, /id="invellaSdk"/);
  assert.match(html, /id="invellaNetwork"/);
  if (page === 'index.html') {
    assert.match(html, /id="invellaLoadedStyles"/);
    assert.match(html, /id="invellaApp"/);
    assert.match(html, /id="invellaEditor"/);
    assert.ok(html.indexOf('id="invellaLoadedStyles"') < html.indexOf('<body>'));
  }
}
console.log('PASS: main and admin pages carry all core CSS/JS, every inline script parses');
