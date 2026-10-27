const {createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {minify_sync}=require('terser');
function script(text){return minify_sync(text,{ecma:2017,compress:{passes:2},mangle:true,format:{comments:false}}).code;}
function extract(html,id){
 const match=new RegExp('<(div|section)\\b[^>]*\\bid="'+id+'"[^>]*>').exec(html);
 if(!match)throw Error('Missing fragment '+id);
 const tags=new RegExp('</?'+match[1]+'\\b[^>]*>','g');tags.lastIndex=match.index;let depth=0,item;
 while((item=tags.exec(html))){depth+=item[0].startsWith('</')?-1:1;if(depth===0)return html.slice(match.index,tags.lastIndex)}
 throw Error('Unclosed fragment '+id);
}
function critical(css,html){
 const classes=new Set(['hidden','active','error','ok','public-route','public-pending']);
 for(const match of html.matchAll(/class="([^"]*)"/g))match[1].split(/\s+/).forEach(c=>classes.add(c));
 const ids=new Set(Array.from(html.matchAll(/id="([^"]*)"/g),m=>m[1]));
 function keep(selector){
  return Array.from(selector.matchAll(/\.([a-zA-Z_][\w-]*)/g),m=>m[1]).every(c=>classes.has(c))&&
    Array.from(selector.matchAll(/#([a-zA-Z_][\w-]*)/g),m=>m[1]).every(id=>ids.has(id));
 }
 function rules(text){let output='',start=0,quote='',escaped=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote='';continue}if(c==='"'||c==="'"){quote=c;continue}
   if(c===';'&&text.slice(start,i).trim().startsWith('@')){start=i+1;continue}
   if(c!=='{')continue;
   const prelude=text.slice(start,i).trim();let depth=1,j=i+1,q='',esc=false;
   for(;j<text.length;j++){const x=text[j];if(q){if(esc)esc=false;else if(x==='\\')esc=true;else if(x===q)q='';continue}if(x==='"'||x==="'"){q=x;continue}if(x==='{')depth++;if(x==='}'&&!--depth)break;}
   const body=text.slice(i+1,j);
   if(/^@(media|supports|layer)\b/.test(prelude)){const inner=rules(body);if(inner)output+=prelude+'{'+inner+'}'}
   else if(prelude.startsWith('@'))output+=prelude+'{'+body+'}';
   else {const selectors=prelude.split(',').filter(keep);if(selectors.length)output+=selectors.join(',')+'{'+body+'}'}
   i=j;start=j+1;
  }return output;
 }
 return rules(css.replace(/\/\*[\s\S]*?\*\//g,''));
}
function controls(html){return html.replace(/onclick="(openAuth|closeAuth|openTemplates|chooseTemplate|setAuthMode|togglePassword|submitAuth|forgotPassword|login)\(([^"<>]*)\)"/g,(_,name,args)=>{
 const value=args.match(/^'([^']*)'/);return 'data-shell="'+name+'"'+(value?' data-value="'+value[1]+'"':'');
});}
function build(root){
 const read=file=>fs.readFileSync(path.join(root,file),'utf8'),write=(file,text)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text)};
 let main=read('src/index.html');const fragments=['app','publishModal','paymentSuccessModal','dashboardModal','resetPasswordModal','offer','privacy'].map(id=>extract(main,id));
 for(const fragment of fragments)main=main.replace(fragment,'');
 const auth=extract(main,'authModal');main=main.replace(auth,'').replace('<body>','<body>'+auth);
 main=main.replace(/<script id="invella(?:Sdk|Network|App|Editor|ReadyReport)">[\s\S]*?<\/script>/g,'');
 const fragment=fragments.join('\n');write('assets/invella-fragment.html',fragment);
 let admin=read('src/admin.html'),match=/<script>\s*if\(!window\.supabase\)[\s\S]*?<\/script>/.exec(admin);
 if(!match)throw Error('Admin application not found');
 const adminCode=match[0].replace(/^<script>/,'').replace(/<\/script>$/,'')+'\nwindow.invellaAdminReady=true;';
 write('assets/invella-admin.js',adminCode);admin=admin.replace(match[0],'').replace(/<script id="invella(?:Sdk|Network)">[\s\S]*?<\/script>/g,'');
 const files={styles:'assets/invella-bundle.css',sdk:'supabase.min.js',network:'assets/invella-network.js',app:'assets/invella-app.js',premium:'assets/invella-premium-fix.js',fragment:'assets/invella-fragment.html',admin:'assets/invella-admin.js'};
 const hashes=Object.fromEntries(Object.entries(files).map(([key,file])=>[key,createHash('sha256').update(read(file)).digest('hex')]));
 const buildId=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
 write('assets/invella-startup-manifest.json',JSON.stringify({build:buildId,hashes}));
 for(const [page,input]of [['index.html',main],['admin.html',admin]]){
  let html=controls(input),keys=page==='index.html'?['styles','sdk','network','app','premium','fragment']:['sdk','network','admin'];
  const config={build:buildId,page:page==='index.html'?'main':'admin',assets:Object.fromEntries(keys.map(key=>[key,'/'+files[key]])),mirror:'https://lwanymjmbcstvggmhevx.supabase.co/functions/v1/invella-assets',mirrorKey:'sb_publishable_EY50r1gV7v1zyD9vBgrteA_JVcOg4_J'};
  const early=script(read('assets/invella-early.js').replace('__INVELLA_BUILD__',buildId)),shell=script(read('assets/invella-shell.js').replace('__INVELLA_BOOT_CONFIG__',JSON.stringify(config)).replace(/\bconfig\.page\b/g,JSON.stringify(config.page)));
  if(page==='index.html')html=html.replace('</head>','<script id="invellaAuth">'+script(read('assets/invella-auth.js'))+'</script></head>');
  html=html.replace('{{INVELLA_CSS}}',critical(read(files.styles),html)).replace('id="invellaLoadedStyles"','id="invellaCriticalStyles"');
  html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><script id="invellaEarly">'+early+'</script>');
  if(!html.includes('id="invellaEarly"'))html=html.replace('<head>','<head><script id="invellaEarly">'+early+'</script>');
  html=html.replace('</head>','<script id="invellaShell">'+shell+'</script><style>[hidden]{display:none!important}.boot-status{position:fixed;bottom:12px;left:12px;right:12px;z-index:100002;background:#fffdf8;border:1px solid #d9d0c6;padding:12px;color:#201d1b;font:14px Arial}.boot-status button{margin-left:12px}a.ghost,a.primary,a.navbtn{display:inline-block;text-decoration:none}</style></head>');
  html=html.replace('<body>','<body><div id="invellaBootStatus" class="boot-status" hidden role="status"><span></span><button type="button" onclick="invellaRetryBoot()">Повторить</button></div><noscript><p>Для входа и редактора нужно разрешить JavaScript для invella.ru в настройках браузера.</p></noscript>');
  html=html.replace('</body>','<span id="invellaShellReady" hidden></span></body>');
  write(page,html);write('public/'+page,html);console.log('Built '+page+': '+Buffer.byteLength(html)+' bytes; small initial shell, early controls');
 }
 for(const file of new Set([...Object.values(files),'assets/atelier-preview.css','connection-check.html'])){write('public/'+file,read(file));}
 return {build:buildId,files};
}
module.exports={build,critical,extract};
