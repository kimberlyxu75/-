/* Validation and portable encrypted backups. No keys are persisted. */
const WalletSecurity = (() => {
  const object = v => v && typeof v === 'object' && !Array.isArray(v);
  const text = (v, max) => typeof v === 'string' && v.length <= max;
  const id = v => text(v, 100) && /^[a-zA-Z0-9_-]+$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
  const validAmount = (v, zero = true) => typeof v === 'number' && Number.isFinite(v) && v >= (zero ? 0 : 0.01) && v <= 1e9 && Math.abs(v * 100 - Math.round(v * 100)) < 0.0001;
  const validDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  function validate(data) {
    const fail = () => { throw new Error('账本字段无效。'); };
    if (!object(data) || !Array.isArray(data.categories) || !Array.isArray(data.expenses) || !object(data.budgets) || data.categories.length > 1000 || data.expenses.length > 100000) fail();
    const seen = new Set();
    const categories = data.categories.map(c => {
      if (!object(c) || !id(c.id) || seen.has(c.id) || !text(c.name, 80) || !c.name.trim() || !text(c.emoji, 32) || typeof c.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(c.color)) fail();
      seen.add(c.id);
      if (c.type !== undefined && !['expense', 'income'].includes(c.type)) fail();
      return { ...(c.type ? { type: c.type } : {}), id: c.id, name: c.name, emoji: c.emoji, color: c.color };
    });
    seen.clear();
    const expenses = data.expenses.map(e => {
      if (!object(e) || !id(e.id) || seen.has(e.id) || !id(e.categoryId) || !validDate(e.date) || !validAmount(e.amount, false) || !text(e.note ?? '', 10000)) fail();
      seen.add(e.id);
      if (e.type !== undefined && !['expense', 'income'].includes(e.type)) fail();
      return { ...(e.type ? { type: e.type } : {}), id: e.id, categoryId: e.categoryId, date: e.date, amount: e.amount, note: e.note ?? '' };
    });
    const budgets = {};
    if (Object.keys(data.budgets).length > 1200) fail();
    for (const [month, b] of Object.entries(data.budgets)) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !object(b) || !validAmount(b.total ?? 0) || !object(b.categories)) fail();
      const limits = {};
      for (const [key, amount] of Object.entries(b.categories)) {
        if (!id(key) || !validAmount(amount)) fail();
        limits[key] = amount;
      }
      budgets[month] = { total: b.total ?? 0, categories: limits };
    }
    if (!text(data.notes?.categories ?? '', 10000)) fail();
    return { categories, expenses, budgets, notes: { categories: data.notes?.categories ?? '' } };
  }
  const encode = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
  const decode = str => Uint8Array.from(atob(str), c => c.charCodeAt(0));
  async function key(password, salt) {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(data, password) {
    if (password.length < 12) throw new Error('密码过短。');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt), new TextEncoder().encode(JSON.stringify(validate(data))));
    return { app: 'personal-wallet-encrypted', version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: 600000, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
  }
  async function decrypt(data, password) {
    if (data.version !== 1 || data.algorithm !== 'AES-256-GCM' || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== 600000 || !text(data.ciphertext, 14000000)) throw new Error('不支持的加密格式。');
    const salt = decode(data.salt), iv = decode(data.iv);
    if (salt.length !== 16 || iv.length !== 12) throw new Error('加密参数无效。');
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(password, salt), decode(data.ciphertext));
    return validate(JSON.parse(new TextDecoder().decode(plaintext)));
  }
  return { validate, validAmount, validDate, encrypt, decrypt };
})();
if (typeof module !== 'undefined') module.exports = WalletSecurity;
