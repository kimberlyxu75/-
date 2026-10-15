const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const security=require('../security.js');
function harness(fail=false){
 const elements=new Map(), values=new Map();
 function el(key){if(!elements.has(key)) elements.set(key,{value:'',textContent:'',innerHTML:'',hidden:true,children:[],listeners:{},style:{},dataset:{},classList:{toggle(){}},addEventListener(k,fn){this.listeners[k]=fn;},querySelectorAll(){return [];},setAttribute(){},close(){this.closed=true;}});return elements.get(key);}
 const context=vm.createContext({WalletSecurity:security,Intl,Date,structuredClone,crypto:require('node:crypto').webcrypto,setTimeout,console,document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{if(fail)throw Error('quota');values.set(k,v);}}});
 const source=fs.readFileSync('app.js','utf8');vm.runInContext(source.slice(0,source.lastIndexOf('\nboot();')),context);
 return {context,el,values};
}
test('failed transaction keeps form draft and rolls back ledger',async()=>{
 const h=harness(true);h.el('#expense-amount').value='12.34';h.el('#expense-date').value='2026-10-15';h.el('#expense-category').value='food';h.el('#expense-note').value='draft';
 await h.el('#expense-form').listeners.submit({preventDefault(){}});
 assert.equal(h.el('#expense-amount').value,'12.34');assert.equal(h.el('#expense-note').value,'draft');
 assert.equal(vm.runInContext('state.expenses.length',h.context),0);assert.equal(h.values.size,0);
 assert.match(h.el('#data-status').textContent,/未保存/);
});
test('successful delete can be undone and both changes persist',async()=>{
 const h=harness();vm.runInContext(`state.expenses.push({id:'record1',date:'2026-10-15',amount:10,categoryId:'food',note:''})`,h.context);
 await h.el('#expense-list').listeners.click({target:{closest:()=>({dataset:{deleteExpense:'record1'}})}});
 assert.equal(JSON.parse(h.values.get('cute-wallet-state-v1')).expenses.length,0);
 await h.el('#undo-delete-btn').listeners.click();
 assert.equal(JSON.parse(h.values.get('cute-wallet-state-v1')).expenses[0].id,'record1');assert.equal(h.el('#undo-delete-btn').hidden,true);
});
test('failed deletion retains record without offering a false undo',async()=>{
 const h=harness(true);vm.runInContext(`state.expenses.push({id:'record1',date:'2026-10-15',amount:10,categoryId:'food',note:''})`,h.context);
 await h.el('#expense-list').listeners.click({target:{closest:()=>({dataset:{deleteExpense:'record1'}})}});
 assert.equal(vm.runInContext('state.expenses.length',h.context),1);assert.equal(h.el('#undo-delete-btn').hidden,true);
});
test('queued asynchronous writes preserve order and rollback failed edits',async()=>{
 const h=harness();vm.runInContext(`let saved=[]; saveState=async()=>{await new Promise(resolve=>setTimeout(resolve,1));if(state.notes.categories==='bad')return false;saved.push(state.notes.categories);return true;};`,h.context);
 await vm.runInContext(`Promise.all([commitChange(()=>state.notes.categories='first'),commitChange(()=>state.notes.categories='bad'),commitChange(()=>state.notes.categories+='-last')])`,h.context);
 assert.equal(vm.runInContext('state.notes.categories',h.context),'first-last');assert.equal(vm.runInContext('saved.join(",")',h.context),'first,first-last');
});
