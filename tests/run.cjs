const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
let failed=false,count=0;
for(const file of fs.readdirSync(__dirname).filter(n=>n.endsWith('.cjs')&&n!=='run.cjs').sort()){
 const r=spawnSync(process.execPath,[path.join(__dirname,file)],{encoding:'utf8'});
 process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');
 if(r.status!==0||!r.stdout.includes('PASS:')){failed=true;console.error('FAILED '+file)}count++;
}
console.log((failed?'FAILED':'PASS:')+' '+count+' regression suites');
process.exitCode=failed?1:0;
