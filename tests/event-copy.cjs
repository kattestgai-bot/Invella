const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/invella-app.js','utf8'),premium=fs.readFileSync('assets/invella-premium-fix.js','utf8');
const nodes={eventType:{value:'Свадьба'},message:{value:'Сохранённый текст'},wishes:{value:'Мои пожелания'}};
for(const id of ['p1t','p1','p2t','p2','p3t','p3','time','dress','programExtra'])nodes[id]={value:id==='programExtra'?'[]':''};
const context=vm.createContext({$:id=>nodes[id],window:{}});vm.runInContext(source.slice(source.indexOf('var eventDetails='),source.indexOf('function setBlockVisible(')),context);
context.updateEventCopy(false);assert.equal(nodes.message.value,'Сохранённый текст');
for(const event of Object.keys(context.eventMessages).slice(1).concat('Свадьба')){nodes.eventType.value=event;context.updateEventCopy(true);assert.equal(nodes.message.value,context.eventMessages[event]);assert.equal(nodes.wishes.value,context.eventCopy().wishes);nodes.message.value='Свой текст';context.updateEventCopy(false);context.updateEventCopy(true);assert.equal(nodes.message.value,'Свой текст','Duplicate input/change must not reset editing');}
nodes.programExtra.value=JSON.stringify([{time:'22:00',text:'Дополнительный пункт'}]);assert.equal(context.extraProgram()[0].text,'Дополнительный пункт');nodes.programExtra.value='invalid';assert.equal(context.extraProgram().length,0);
for(const event of Object.keys(context.eventDetails)){nodes.eventType.value=event;context.applyEventDefaults();assert.equal(nodes.p2.value,context.eventDetails[event].program[1][1]);if(event!=='Свадьба')assert.doesNotMatch(nodes.p2.value,/свадебная церемония/i);assert.ok(context.eventDetail().heading);assert.ok(context.eventCopy().gifts);}
const children={textContent:'Дети на празднике',style:{display:'none'}},flowers={textContent:'Без цветов',style:{display:'none'}};
const c=vm.createContext({document:{querySelectorAll:selector=>selector.includes('wish-presets')?[flowers]:[children]}});vm.runInContext(premium.slice(premium.indexOf('function context(){'),premium.indexOf('function makeField(')),c);c.context();assert.equal(children.style.display,'');assert.equal(flowers.style.display,'');
console.log('PASS: event selection replaces invitation text, load and duplicate events preserve edits, wishes preserved, children and flowers remain available');
