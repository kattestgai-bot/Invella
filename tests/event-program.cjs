const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/invella-app.js','utf8');
class Node{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.value='';this._text='';this.attributes={};}appendChild(child){child.parentElement=this;this.children.push(child);if(child.id)nodes[child.id]=child;return child;}setAttribute(key,value){this.attributes[key]=value;}set textContent(value){this.children=[];this._text=String(value);}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}querySelectorAll(selector){return this.children.filter(x=>x.attributes['data-extra-program']);}remove(){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}}
const nodes={},field=new Node(),timeline=new Node();
for(const id of ['eventType','message','wishes','dress','time','p1t','p1','p2t','p2','p3t','p3'])nodes[id]=new Node('input');
const first=new Node();first.appendChild(nodes.p1);field.appendChild(first);
nodes.eventType.value='День рождения';nodes.blockProgram={querySelector:()=>timeline};
const document={createElement:tag=>new Node(tag),createTextNode:value=>{const n=new Node();n.textContent=value;return n;}};
let renders=0;const context=vm.createContext({window:{},document,$:id=>nodes[id],render:()=>{renders++;context.renderExtraProgram();},alert:()=>assert.fail('Unexpected alert')});
vm.runInContext(source.slice(source.indexOf('var eventDetails='),source.indexOf('function setBlockVisible(')),context);
context.ensureProgramUI();context.ensureProgramUI();assert.equal(field.children.filter(x=>x.id==='programExtra').length,1);
context.applyEventDefaults();assert.match(nodes.p2.value,/ужин/);assert.doesNotMatch(nodes.p2.value,/церемония/i);
context.window.addProgramItem();let row=nodes.programExtraRows.children[0];row.children[0].value='22:00';row.children[1].value='Фейерверк <img onerror=bad>';row.children[1].oninput();assert.equal(nodes.programExtraRows.children[0],row,'Typing must retain focus and existing inputs');assert.equal(timeline.children.length,1);assert.match(timeline.textContent,/Фейерверк <img/);assert.equal(timeline.children[0].children[1].tagName,'DIV','Title must be a text node, not parsed HTML');
const fields=source.match(/var fields=(\[[^\n]+?\]);/)[0];const collect=source.slice(source.indexOf('function collectData(){'),source.indexOf('function makeSlug(){'));vm.runInContext(fields+'\n'+collect,context);
const saved=JSON.parse(JSON.stringify(context.collectData()));assert.equal(JSON.parse(saved.programExtra)[0].time,'22:00');
nodes.programExtra.value='[]';context.renderExtraProgram();nodes.programExtra.value=saved.programExtra;context.renderExtraProgram();assert.equal(nodes.programExtraRows.children[0].children[1].value,'Фейерверк <img onerror=bad>');
nodes.programExtraRows.children[0].children[2].onclick();assert.equal(context.extraProgram().length,0);assert.equal(timeline.children.length,0);assert.ok(renders>=3);
assert.match(source,/classList\.toggle\('hidden',cp==='unspecified'\)/);
console.log('PASS: event-specific starter program, add/edit/remove extra entries, stable inputs, safe rendering, serialization and restored guest timeline, unspecified children hidden');
