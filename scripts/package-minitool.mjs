import fs from 'node:fs';
import { transformSync } from 'esbuild';
import { execFileSync } from 'node:child_process';
const out = 'minitool-dist';
fs.mkdirSync(out, {recursive:true});
function between(source, start, end, replacement) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('Source marker missing: ' + start);
  return source.slice(0,a) + replacement + '\n\n' + source.slice(b);
}
let app = fs.readFileSync('app.js','utf8');
app = app.slice(0,app.indexOf('if ("serviceWorker" in navigator)'));
app = app.replace('let state = loadState();','let state = await loadState();');
app = between(app,'function loadState() {','function normalizeState',`async function loadState() {
  const saved = await MiniWalletRuntime.load();
  storageBlocked = MiniWalletRuntime.blocked();
  try { if (saved) { const raw = JSON.parse(saved); const next = WalletSecurity.validate(raw); if (!raw.categories.some(item => item.type !== undefined)) { next.categories.forEach(item => { item.type = 'expense'; }); next.categories.push(...MiniWalletRuntime.clone(starterCategories.filter(item => item.type === 'income' && !next.categories.some(existing => existing.id === item.id)))); } return next; } }
  catch (error) { storageBlocked = true; }
  if (storageBlocked) setTimeout(() => notify('账本读取失败，已暂停保存以保护原始数据。请勿清除缓存。'), 0);
  return { categories: MiniWalletRuntime.clone(starterCategories), expenses: [], budgets: {}, notes: { categories: '' } };
}`);
app = between(app,'function saveState() {','function todayISO',`async function saveState() {
  if (storageBlocked) return false;
  try {
    const serialized = JSON.stringify(WalletSecurity.validate(state));
    notify('正在保存，请等到显示保存成功后再关闭页面。');
    await MiniWalletRuntime.save(serialized);
    notify('账本已保存在本机，不上传云端。');
    return true;
  } catch (error) {
    storageBlocked = true;
    notify('保存失败，当前修改尚未保存。请保存加密备份。' + error.message);
    return false;
  }
}`);
app = between(app,'function updateStorageLabel() {','function askSecurityDialog',`function updateStorageLabel() {
  document.querySelector('#storage-mode-btn').textContent = '本机保存';
  document.querySelector('#storage-disclosure').textContent = MiniWalletRuntime.native()
    ? '账本保存在当前小工具的本机缓存，不上传云端。清理数据或卸载可能丢失账本，请保存加密备份文本。'
    : '当前客户端不支持小工具存储，使用浏览器缓存。缓存可能失效或被清理，请保存加密备份文本。';
}
document.querySelector('#storage-mode-btn').addEventListener('click', () => notify('账本仅在本机保存，不支持自动跨设备同步。请在备份窗口保留加密文本；清理缓存前务必备份。'));`);
app = between(app,'function downloadJSON(payload, suffix) {','async function exportBackup',`function showEncryptedBackup(payload) {
  const dialog = document.querySelector('#backup-text-dialog');
  document.querySelector('#backup-text').value = JSON.stringify(payload);
  dialog.showModal();
  document.querySelector('#backup-text').select();
}`);
app = app.replace('downloadJSON(await WalletSecurity.encrypt(state, password), "encrypted-backup");','showEncryptedBackup(await WalletSecurity.encrypt(state, password));');
app = app.replace('async function exportBackup() {','async function exportBackup() {\n  if (!MiniWalletRuntime.cryptoReady()) return notify("当前环境不支持安全加密，备份已暂停。请勿清除缓存。");');
app = app.replace('请通过 HTTPS 或本机 localhost 打开应用后重试。','当前环境可能不支持安全加密，请勿清除缓存。');
app = app.replace('async function importBackup(file) {','async function importBackup(text) {');
app = app.replace('if (file.size > 10 * 1024 * 1024) throw new Error("文件超过 10MB 限制。");\n    let backup = JSON.parse(await file.text());', 'if (text.length > 2000000) throw new Error("备份文本过大。");\n    let backup = JSON.parse(text);');
app = app.replace('if (backup.app === "personal-wallet-encrypted") {','if (backup.app === "personal-wallet-encrypted") {\n      if (!MiniWalletRuntime.cryptoReady()) throw new Error("当前环境不支持安全解密。");');
app = app.replace('downloadJSON(await WalletSecurity.encrypt(previous, safetyPassword), "before-restore");','if (!MiniWalletRuntime.cryptoReady()) throw new Error("当前环境不支持安全加密，恢复已取消。");\n    showEncryptedBackup(await WalletSecurity.encrypt(previous, safetyPassword));\n    await new Promise(resolve => document.querySelector("#backup-text-dialog").addEventListener("close", resolve, { once: true }));');
app = app.replaceAll('if (!saveState())','if (!await saveState())');
app = app.replace('} finally { els.importDataInput.value = ""; }','} finally { document.querySelector("#restore-text").value = ""; }');
app = between(app,'els.importDataInput.addEventListener("change",','els.expenseForm.addEventListener',`document.querySelector('#restore-text-btn').addEventListener('click', () => document.querySelector('#restore-text-dialog').showModal());
document.querySelector('#restore-text-confirm').addEventListener('click', () => {
  const text = document.querySelector('#restore-text').value;
  document.querySelector('#restore-text-dialog').close();
  importBackup(text);
});
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));`);
app = app.replace('  importDataInput: document.querySelector("#import-data-input"),\n', '');
app = app.replaceAll('structuredClone(', 'MiniWalletRuntime.clone(').replaceAll('crypto.randomUUID()', 'MiniWalletRuntime.id()');
app = app.replaceAll('已下载并妥善保存','已复制或手动保存到安全位置').replaceAll('导出加密备份','保存加密备份文本');
// Bounded expense pages: totals continue to use all records.
app = app.replace('const grouped = ordered.reduce', `const pageCount = Math.max(1, Math.ceil(ordered.length / 50));
  recentPage = Math.min(recentPage, pageCount - 1);
  const visible = ordered.slice(recentPage * 50, recentPage * 50 + 50);
  document.querySelector('#recent-page-label').textContent = (recentPage + 1) + ' / ' + pageCount;
  const grouped = visible.reduce`);
const dayStart = app.indexOf('function openDayExpenseDialog');
const dayEnd = app.indexOf('function ', dayStart + 10);
let daySource = app.slice(dayStart, dayEnd);
daySource = daySource.replace('daily.length ? daily.map((expense)', 'daily.length ? daily.slice(dayPage * 50, dayPage * 50 + 50).map((expense)');
daySource = daySource.replace('const total = sumExpenses(daily);', `dayPage = Math.min(dayPage, Math.max(0, Math.ceil(daily.length / 50) - 1));
  document.querySelector('#day-page-label').textContent = (dayPage + 1) + ' / ' + Math.max(1, Math.ceil(daily.length / 50));
  const total = sumExpenses(daily);`);
daySource = daySource.replace('els.dayExpenseDialog.showModal();','if (!els.dayExpenseDialog.open) els.dayExpenseDialog.showModal();');
app = app.slice(0, dayStart) + daySource + app.slice(dayEnd);
app = app.replace('daily.length ? daily.map((expense)', 'daily.length ? daily.slice(0, 50).map((expense)');
app = app.replace('<div class="week-expense-list">', '<div class="week-expense-list">${daily.length > 50 ? `<button type="button" data-calendar-date="${isoDate}">查看全部 ${daily.length} 笔（分页）</button>` : ""}');
app = app.replace('boot();',`els.categoryBars.addEventListener('click', event => { const button = event.target.closest('[data-calendar-date]'); if (button) { dayPage = 0; openDayExpenseDialog(button.dataset.calendarDate); } });
let recentPage = 0;
let dayPage = 0;
document.querySelectorAll('[data-recent-page]').forEach(button => button.addEventListener('click', () => { recentPage = Math.max(0, recentPage + Number(button.dataset.recentPage)); renderExpenses(); }));
document.querySelectorAll('[data-day-page]').forEach(button => button.addEventListener('click', () => { dayPage = Math.max(0, dayPage + Number(button.dataset.dayPage)); openDayExpenseDialog(selectedDayDialogDate); }));
boot();`);
app = app.replace('  renderCategories();', '  renderCategories();\n  requestAnimationFrame(MiniWalletRuntime.layout);');
app = app.replace('els.tabs.forEach((tab) => {', 'document.addEventListener("click", () => requestAnimationFrame(MiniWalletRuntime.layout));\nels.tabs.forEach((tab) => {');
app = app.replace('openDayExpenseDialog(date);', 'dayPage = 0; openDayExpenseDialog(date);');
app = app.replace('function renderMonthlyDonut(totals, total) {', 'function renderMonthlyDonut(totals, total) {\n  if (!window.CSS || typeof CSS.supports !== "function" || !CSS.supports("background", "conic-gradient(red, blue)")) return renderCategoryBars(totals, total);');
for (const id of ['period-summary','calendar-title','category-notes','today-pill']) app = app.replaceAll('document.querySelector("#' + id + '")', 'null');
app = 'MiniWalletRuntime.prepareUI();\n(async () => {\n' + app + '\n})().catch(() => { const status = document.querySelector("#data-status"); status.hidden = false; status.textContent = "初始化失败，未修改已有账本。请重新打开。"; });';
for (const [name,text] of [['app.js',app],['security.js',fs.readFileSync('security.js','utf8')],['runtime.js',fs.readFileSync('minitool-src/runtime.js','utf8')]]) {
 fs.writeFileSync(out+'/'+name,transformSync(text,{target:['es2017','chrome61'],legalComments:'none'}).code);
}
let html = fs.readFileSync('index.html','utf8');
html = html.replace('initial-scale=1.0"','initial-scale=1.0, viewport-fit=cover"');
html = html.replace(/\s*<meta name="apple-mobile[^>]+>/g,'').replace(/\s*<link rel="manifest"[^>]+>/g,'').replace(/\?v=\d+/g,'');
html = html.replace('<label class="tool-btn" for="import-data-input" title="导入恢复">⇧</label>','<button class="tool-btn" id="restore-text-btn" type="button" title="粘贴备份恢复">⇧</button>').replace(/\s*<input id="import-data-input"[^>]+>/,'');
html = html.replace('<script src="./security.js">','<script src="./security.js">');
html = html.replace('<script src="./app.js">','<script src="./runtime.js"></script>\n    <script src="./app.js">');
html = html.replace('</head>','<link rel="stylesheet" href="./compat.css" />\n  </head>');
html = html.replace('<div class="day-dialog-list" id="day-dialog-list"></div>','<div class="day-dialog-list" id="day-dialog-list"></div><div class="page-controls"><button data-day-page="-1" type="button">上一页</button><span id="day-page-label"></span><button data-day-page="1" type="button">下一页</button></div>');
html = html.replace('<div class="expense-list" id="expense-list"></div>','<div class="expense-list" id="expense-list"></div>');
const match = html.match(/<[^>]+id="expense-list"[^>]*><\/[^>]+>/);
if (!match) throw new Error('Missing list');
html = html.replace(match[0],match[0]+'<div class="page-controls"><button data-recent-page="-1" type="button">上一页</button><span id="recent-page-label"></span><button data-recent-page="1" type="button">下一页</button></div>');
html = html.replace('<script src="./security.js">',`<dialog id="backup-text-dialog"><div class="dialog-card"><h3>加密备份文本</h3><p>选择下方完整文本，手动保存到安全位置。不要公开分享；密码丢失无法恢复。此窗口关闭不代表已完成备份。</p><textarea id="backup-text" rows="10" readonly aria-label="加密备份文本"></textarea><button type="button" data-close-dialog>关闭</button></div></dialog>
<dialog id="restore-text-dialog"><div class="dialog-card"><h3>粘贴备份恢复</h3><textarea id="restore-text" rows="10" aria-label="备份文本"></textarea><button type="button" data-close-dialog>取消</button><button id="restore-text-confirm" type="button">验证并恢复</button></div></dialog>
<script src="./security.js">`);
fs.writeFileSync(out+'/index.html',html);
fs.copyFileSync('icon.svg',out+'/icon.svg');
execFileSync('python3',['scripts/minitool-css.py']);

execFileSync('python3',['scripts/check-minitool.py'],{stdio:'inherit'});
