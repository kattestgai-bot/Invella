const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/invella-app.js','utf8'),premium=fs.readFileSync('assets/invella-premium-fix.js','utf8');
const nodes={eventType:{value:'Свадьба'},message:{value:'Сохранённый текст'},wishes:{value:'Мои пожелания'}};
const context=vm.createContext({$:id=>nodes[id]});vm.runInContext(source.slice(source.indexOf('var eventMessages='),source.indexOf('function setBlockVisible(')),context);
context.updateEventCopy(false);assert.equal(nodes.message.value,'Сохранённый текст');
for(const event of Object.keys(context.eventMessages).slice(1).concat('Свадьба')){nodes.eventType.value=event;context.updateEventCopy(true);assert.equal(nodes.message.value,context.eventMessages[event]);assert.equal(nodes.wishes.value,'Мои пожелания');nodes.message.value='Свой текст';context.updateEventCopy(false);context.updateEventCopy(true);assert.equal(nodes.message.value,'Свой текст','Duplicate input/change must not reset editing');}
const children={textContent:'Дети на празднике',style:{display:'none'}},flowers={textContent:'Без цветов',style:{display:'none'}};
const c=vm.createContext({document:{querySelectorAll:selector=>selector.includes('wish-presets')?[flowers]:[children]}});vm.runInContext(premium.slice(premium.indexOf('function context(){'),premium.indexOf('function makeField(')),c);c.context();assert.equal(children.style.display,'');assert.equal(flowers.style.display,'');
console.log('PASS: event selection replaces invitation text, load and duplicate events preserve edits, wishes preserved, children and flowers remain available');
