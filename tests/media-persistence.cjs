const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/invella-premium-fix.js'), 'utf8');
function editor() {
  const nodes = Object.fromEntries(['invStart', 'invEnd', 'invGalleryText', 'backgroundCustomUrl', 'backgroundCustomPath', 'backgroundStyle'].map(id => [id, { value: '' }]));
  nodes.invTimer = { checked: true };
  const uploads = [];
  let fail = false;
  const window = { location: { origin: 'https://example.invalid' }, invellaSupabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-owner' } } } }) },
    storage: { from: () => ({ upload: async (path, file, options) => { uploads.push({ path, file, options }); return { error: fail ? { message: 'offline' } : null }; }, getPublicUrl: path => ({ data: { publicUrl: 'https://example.invalid/media/' + path } }) }) }
  } };
  const document = { readyState: 'loading', addEventListener() {}, getElementById: id => nodes[id] || null, querySelector: () => null, querySelectorAll: () => [] };
  vm.runInNewContext(source, { window, document, console: { error() {} }, URL: { createObjectURL: () => 'blob:test-background' }, setTimeout: () => 1, clearTimeout() {} });
  return { window, nodes, uploads, setFailure: v => { fail = v; } };
}
(async () => {
  const e = editor();
  e.nodes.invStart.value = '3'; e.nodes.invEnd.value = '8';
  let saved = await e.window.invellaBeforeCloudSave({ id: 'test-invitation' });
  assert.equal(saved.content.premiumMusicStart, 3, 'Save must read the field even if change/blur has not fired');
  assert.equal(saved.content.premiumMusicEnd, 8);
  e.nodes.invEnd.value = '1';
  saved = await e.window.invellaBeforeCloudSave({ id: 'test-invitation' });
  assert.equal(saved.content.premiumMusicEnd, 0, 'An end before the start means play to the end');
  e.window.invellaQueueBackground({ name: 'background.jpg', type: 'image/jpeg' });
  e.setFailure(true);
  await assert.rejects(e.window.invellaBeforeCloudSave({ id: 'test-invitation' }), /Не удалось загрузить/);
  assert.equal(e.nodes.backgroundCustomUrl.value, 'blob:test-background', 'A failed upload must keep the selected file for retry');
  e.setFailure(false);
  await e.window.invellaBeforeCloudSave({ id: 'test-invitation' });
  assert.match(e.nodes.backgroundCustomUrl.value, /^https:\/\/example.invalid\/media\/test-owner\/test-invitation\/background-/);
  assert.equal(e.nodes.backgroundCustomPath.value, '');
  assert.equal(e.uploads.length, 2);
  assert.equal(e.uploads[1].options.upsert, false, 'Unique media uploads do not require storage SELECT permissions');
  const fresh = editor();
  fresh.window.invellaQueueBackground({ name: 'background.jpg', type: 'image/jpeg' });
  await fresh.window.invellaBeforeCloudSave({});
  assert.equal(await fresh.window.invellaAfterCloudSave({ id: 'new-invitation' }), true, 'The first save must flush files after creating the invitation');
  await fresh.window.invellaBeforeCloudSave({ id: 'new-invitation' });
  assert.match(fresh.nodes.backgroundCustomUrl.value, /new-invitation\/background-/);
  const mediaNodes={},created=[];
  const stage={appendChild(node){mediaNodes[node.id]=node;}};
  const mediaWindow={location:{origin:'https://example.invalid'},invellaMediaUrl:value=>value.replace('https://example.invalid/sb/','https://lwanymjmbcstvggmhevx.supabase.co/')};
  const mediaDocument={querySelector:()=>stage,body:stage,createElement(tag){const node={style:{},getAttribute(name){return this[name];},pause(){this.paused=true;},remove(){delete mediaNodes[this.id];}};if(tag==='audio')created.push(node);return node;}};
  const renderSource=source.slice(source.indexOf('function render(){'),source.indexOf('function toggleAudio('));
  const urlSource=source.match(/function publicMediaUrl\(u\)\{[^\n]+\}/)[0];
  const context=vm.createContext({window:mediaWindow,document:mediaDocument,$:id=>mediaNodes[id]||null,photos:[],cover:'',music:'https://example.invalid/sb/storage/v1/object/public/invitation-media/fixture.mp3',removeEditorialNumber(){},enforceEnd(){},toggleAudio(){}});
  vm.runInContext(urlSource+'\n'+renderSource+'\nrender();',context);
  const audio=mediaNodes.invAudio;audio.currentTime=5;vm.runInContext('render();',context);
  assert.equal(created.length,1,'Switching the public media delivery origin must not recreate music on every render');assert.equal(mediaNodes.invAudio,audio);assert.equal(audio.currentTime,5);
  console.log('PASS: unblurred fragment inputs, failed-upload retry, background persistence, first-save media flush, stable music across media delivery paths');
})().catch(error => { console.error(error); process.exitCode = 1; });
