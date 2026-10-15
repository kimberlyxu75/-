const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
function harness({version=9460000, data=null, failRead=false, failWrite=false, old=null}={}) {
 const store=new Map(old ? [['cute-wallet-state-v1',old]] : []); const calls=[];
 let stored=data;
 const sdk={async getStorage(args){calls.push(['get',args]);if(failRead)throw Error('read');return {data:stored};},async setStorage(args){calls.push(['set',args]);if(failWrite)throw Error('write');stored=args.data;}};
 const context=vm.createContext({window:{xhs:{launchOptions:{miniToolEnv:{buildVersion:version}},miniTool:sdk},crypto},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},console,TextEncoder,TextDecoder,Uint8Array,btoa,atob,setTimeout,clearTimeout});
 vm.runInContext(fs.readFileSync('minitool-dist/security.js','utf8'),context);
 vm.runInContext(fs.readFileSync('minitool-dist/runtime.js','utf8'),context);
 return {context,api:vm.runInContext('MiniWalletRuntime',context),calls,get stored(){return stored;},store};
}
test('native storage honors client version, encrypted read/write and serialized saves',async()=>{
 const h=harness();await h.api.load();await Promise.all([h.api.save('{"v":1}'),h.api.save('{"v":2}')]);assert.equal(h.stored,'{"v":2}');assert.ok(h.calls.every(c=>c[1].encrypt===true));
});
test('old client uses browser storage and does not call unsupported SDK',async()=>{
 const h=harness({version:9459999});await h.api.load();await h.api.save('{"v":1}');assert.equal(h.calls.length,0);assert.equal(h.store.get('cute-wallet-state-v1'),'{"v":1}');
});
test('failed native read protects data and never silently switches stores',async()=>{
 const h=harness({failRead:true});await h.api.load();assert.ok(h.api.blocked());await assert.rejects(h.api.save('{}'));assert.equal(h.store.size,0);
});
test('failed write blocks following queued writes',async()=>{
 const h=harness({failWrite:true});await h.api.load();await assert.rejects(h.api.save('{}'));await assert.rejects(h.api.save('{"v":2}'));assert.equal(h.calls.filter(c=>c[0]==='set').length,1);
});
test('validated older browser ledger migrates without deleting source',async()=>{
 const old=JSON.stringify({categories:[],expenses:[],budgets:{},notes:{categories:''}});const h=harness({old});assert.equal(await h.api.load(),old);assert.equal(h.stored,old);assert.equal(h.store.get('cute-wallet-state-v1'),old);
});
test('invalid migration and oversized snapshots do not overwrite ledger',async()=>{
 const h=harness({old:'broken'});await h.api.load();assert.ok(h.api.blocked());assert.equal(h.stored,null);
 const h2=harness();await h2.api.load();await assert.rejects(h2.api.save('a'.repeat(900001)));assert.equal(h2.stored,null);
});
test('generated app initializes and persists transaction with native storage in DOM model',async()=>{
 const h=harness();const elements=new Map();
 function el(selector){if(!elements.has(selector))elements.set(selector,{children:[],value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},style:{setProperty(){}},classList:{add(){},contains(){return true;},toggle(){}},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},querySelector(){return el('dummy');},querySelectorAll(){return [];},appendChild(){},focus(){},scrollIntoView(){},setAttribute(){},removeAttribute(){},getAttribute(){return null;},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(selector);}
 h.context.document={querySelector:el,querySelectorAll(){return [];},documentElement:el('root'),body:{appendChild(){},removeChild(){}},createElement(){return {style:{},appendChild(){},scrollHeight:1,parentNode:{removeChild(){}}};},addEventListener(){}};
 h.context.window.innerHeight=800;h.context.window.addEventListener=()=>{};h.context.requestAnimationFrame=fn=>fn();
 vm.runInContext(fs.readFileSync('minitool-dist/app.js','utf8'),h.context);
 await new Promise(r=>setTimeout(r,20));
 assert.ok(el('#expense-form').listeners.submit,'boot reached event bindings');
 assert.doesNotMatch(el('#data-status').textContent,/初始化失败/);
 el('#expense-amount').value='12.34';el('#expense-category').value='food';
 await el('#expense-form').listeners.submit({preventDefault(){}});
 await new Promise(r=>setTimeout(r,20));
 const saved=JSON.parse(h.stored);assert.equal(saved.expenses.length,1);assert.equal(saved.expenses[0].amount,12.34);
});
