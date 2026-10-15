const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const security=require('../security.js');
const ledger={categories:[{id:'food',name:'餐饮',emoji:'🥐',color:'#d99b8d'},{id:'salary',type:'income',name:'工资',emoji:'💼',color:'#83b59c'}],expenses:[{id:'e1',categoryId:'food',date:'2026-10-15',amount:20,note:''},{id:'i1',type:'income',categoryId:'salary',date:'2026-10-15',amount:8000,note:''}],budgets:{},notes:{categories:''}};
test('income survives validation and encrypted backup restore',async()=>{
 const validated=security.validate(ledger);
 assert.equal(validated.expenses[1].type,'income');
 assert.deepEqual(await security.decrypt(await security.encrypt(ledger,'test-income-password'),'test-income-password'),validated);
 assert.throws(()=>security.validate({...ledger,expenses:[{...ledger.expenses[1],type:'invalid'}]}));
});
const app=fs.readFileSync('app.js','utf8');
function source(start,end){return app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));}
test('income and expense totals and distributions remain separate; budgets default to expense',()=>{
 const context=vm.createContext({state:structuredClone(ledger)});
 vm.runInContext(`const typeOf = item => item.type || 'expense'; const categoriesOf = type => state.categories.filter(item => typeOf(item) === type); const recordsOf = type => state.expenses.filter(item => typeOf(item) === type); let statsType = 'income';`+source('function sumExpenses','function dateISO'),context);
 assert.equal(vm.runInContext(`sumExpenses(expensesForMonth('2026-10'))`,context),20);
 assert.equal(vm.runInContext(`sumExpenses(expensesForMonth('2026-10','income'))`,context),8000);
 assert.equal(vm.runInContext(`categoryTotals(recordsOf('income'))[0].total`,context),8000);
 assert.equal(vm.runInContext(`categoryTotals(recordsOf('expense'),'expense')[0].total`,context),20);
});
