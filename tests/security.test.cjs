const { test } = require('node:test');
const assert = require('node:assert/strict');
global.crypto = require('node:crypto').webcrypto;
const security = require('../security.js');
const ledger = { categories: [{id:'food',name:'餐饮',emoji:'🍴',color:'#123456'}], expenses:[{id:'entry1',categoryId:'food',date:'2026-10-10',amount:10.25,note:'午餐'}], budgets:{'2026-10':{total:100,categories:{food:50}}},notes:{categories:''} };
test('valid legacy backup preserves records and strips unknown fields', () => {
  assert.deepEqual(security.validate({...ledger,app:'personal-wallet-pwa',unexpected:'ignored'}),ledger);
});
test('reject malformed, duplicate and injection-bearing attributes', () => {
  for (const mutation of [
    d => d.categories[0].color = '#fff\" onmouseover=\"alert(1)',
    d => d.categories[0].id = '__proto__',
    d => d.expenses.push({...d.expenses[0]}),
    d => d.expenses[0].amount = -1,
    d => d.expenses[0].amount = 0.001,
    d => d.expenses[0].date = '2026-02-30',
    d => d.budgets['2026-10'].categories = JSON.parse('{"__proto__":1}'),
    d => d.notes.categories = 'x'.repeat(10001)
  ]) { const d = structuredClone(ledger); mutation(d); assert.throws(() => security.validate(d)); }
});
test('encrypted backup round trip, wrong password and tamper protection', async () => {
  const encrypted = await security.encrypt(ledger,'a-long-test-password');
  assert.equal(JSON.stringify(encrypted).includes('午餐'),false);
  assert.deepEqual(await security.decrypt(encrypted,'a-long-test-password'),ledger);
  await assert.rejects(security.decrypt(encrypted,'a-wrong-test-password'));
  const damaged = {...encrypted,ciphertext: (encrypted.ciphertext[0] === 'A' ? 'B' : 'A') + encrypted.ciphertext.slice(1)};
  await assert.rejects(security.decrypt(damaged,'a-long-test-password'));
});
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function functionSource(name, next) { return source.slice(source.indexOf(`function ${name}(`),source.indexOf(`function ${next}(`)); }
function storageContext(saved = JSON.stringify(ledger)) {
  const values = new Map([['cute-wallet-state-v1',saved]]);
  const context = vm.createContext({WalletSecurity:security,localStorage:{getItem:k=>values.get(k) ?? null,setItem:(k,v)=>values.set(k,v)},STORAGE_KEY:'cute-wallet-state-v1',state:structuredClone(ledger),stateRevision:saved,storageBlocked:false,temporaryMode:false,starterCategories:ledger.categories,structuredClone,setTimeout:fn=>fn(),notify:()=>{}});
  vm.runInContext(functionSource('loadState','normalizeState')+functionSource('saveState','todayISO'),context);
  return { context,values };
}
test('corrupt storage is not overwritten on boot', () => {
  const {context,values}=storageContext('{bad json');
  vm.runInContext('state = loadState(); saveState()',context);
  assert.equal(context.storageBlocked,true);
  assert.equal(values.get('cute-wallet-state-v1'),'{bad json');
});
test('other tab changes are preserved; quota failures report unsuccessful save', () => {
  const {context,values}=storageContext();
  values.set('cute-wallet-state-v1','other-tab-data');
  assert.equal(vm.runInContext('saveState()',context),false);
  assert.equal(values.get('cute-wallet-state-v1'),'other-tab-data');
  const other=storageContext();
  other.context.localStorage.setItem=()=>{throw new Error('QuotaExceededError')};
  assert.equal(vm.runInContext('saveState()',other.context),false);
});
test('category text is rendered as text, not executable HTML', () => {
  const context=vm.createContext({recordType:'expense',categoriesOf:() => context.state.categories,typeLabel:()=> '支出',document:{querySelector:()=>({})},state:{categories:[{id:'safe',name:'<img src=x onerror=alert(1)>',emoji:'<svg onload=alert(1)>'}]},els:{expenseNote:{},expenseCategory:{value:'',innerHTML:'',setAttribute(){}}}});
  vm.runInContext(functionSource('escapeHTML','notify')+functionSource('renderCategoryOptions','renderExpenses')+'renderCategoryOptions()',context);
  assert.equal(context.els.expenseCategory.innerHTML.includes('<img'),false);
  assert.equal(context.els.expenseCategory.innerHTML.includes('<svg'),false);
});
test('separate browser stores keep independent ledgers under the same key', () => {
  const a=storageContext(), b=storageContext();
  a.context.state.expenses[0].note='only-device-a';
  assert.equal(vm.runInContext('saveState()',a.context),true);
  assert.equal(JSON.parse(b.values.get('cute-wallet-state-v1')).expenses[0].note,'午餐');
  assert.equal(JSON.parse(a.values.get('cute-wallet-state-v1')).expenses[0].note,'only-device-a');
});
test('local-only release loads no cloud SDK or cloud sync scripts', () => {
  const root=require('node:path').join(__dirname,'..');
  const html=fs.readFileSync(require('node:path').join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(require('node:path').join(root,'sw.js'),'utf8');
  assert.equal(/cloud-login|cloud-sync|cloud-ui|cloud-config|vendor\/cloudbase/.test(html),false);
  assert.equal(/cloud-sync|cloud-ui|cloud-config|vendor\/cloudbase/.test(sw),false);
});
