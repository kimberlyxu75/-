/* Container storage and local compatibility. No external services. */
const MiniWalletRuntime = (() => {
  let native = null;
  let readError = false;
  let revision = null;
  let queue = Promise.resolve();
  const key = 'cute-wallet-minitool-state-v1';
  const legacyKey = 'cute-wallet-state-v1';
  function readVersion(options) {
    return Math.floor((Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion) || 0) / 1000);
  }
  async function load() {
    const xhs = window.xhs;
    const sdk = xhs && xhs.miniTool;
    let version = readVersion(xhs && xhs.launchOptions);
    if (!version && sdk && typeof sdk.getLaunchOptions === 'function') {
      try { version = readVersion(await sdk.getLaunchOptions()); } catch (error) { version = 0; }
    }
    if (version >= 9460) {
      if (!sdk || typeof sdk.getStorage !== 'function' || typeof sdk.setStorage !== 'function') {
        readError = true; return null;
      }
      native = sdk;
      try {
        const result = await native.getStorage({ key, encrypt: true });
        if (!result || !Object.prototype.hasOwnProperty.call(result, 'data')) throw new Error('无法读取缓存');
        revision = result.data == null ? null : result.data;
        if (revision !== null && typeof revision !== 'string') throw new Error('缓存格式错误');
        if (revision === null) {
          let old = null;
          try { old = localStorage.getItem(legacyKey); } catch (error) { /* No older browser cache. */ }
          if (old) {
            revision = JSON.stringify(WalletSecurity.validate(JSON.parse(old)));
            await native.setStorage({ key, data: revision, encrypt: true });
          }
        }
        return revision;
      } catch (error) { readError = true; return null; }
    }
    try { revision = localStorage.getItem(legacyKey); return revision; }
    catch (error) { readError = true; return null; }
  }
  function save(serialized) {
    if (readError) return Promise.reject(new Error('读取失败，已保护原始数据并暂停写入。'));
    if (unescape(encodeURIComponent(serialized)).length > 900000) return Promise.reject(new Error('账本已接近单项缓存容量，请先保存加密备份。'));
    const operation = queue.then(async () => {
      if (readError) throw new Error('保存已暂停，请保留备份后重新打开。');
      if (native) {
        const result = await native.getStorage({ key, encrypt: true });
        if (!result || (result.data == null ? null : result.data) !== revision) throw new Error('其他页面已更新账本，请保留备份后重新打开。');
        await native.setStorage({ key, data: serialized, encrypt: true });
      } else {
        if (localStorage.getItem(legacyKey) !== revision) throw new Error('其他页面已更新账本，请保留备份后重新打开。');
        localStorage.setItem(legacyKey, serialized);
      }
      revision = serialized;
      return true;
    });
    queue = operation.catch(() => { readError = true; });
    return operation;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  let counter = 0;
  function id() {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    counter += 1;
    return Date.now().toString(36) + '-' + counter + '-' + Math.random().toString(36).slice(2);
  }
  function cryptoReady() {
    return window.crypto && typeof window.crypto.getRandomValues === 'function' && window.crypto.subtle && typeof window.crypto.subtle.encrypt === 'function' && typeof window.TextEncoder === 'function' && typeof window.TextDecoder === 'function';
  }
  function prepareUI() {
    document.querySelectorAll('dialog').forEach(dialog => {
      if (typeof dialog.showModal === 'function') return;
      dialog.classList.add('dialog-fallback');
      dialog.showModal = function () { this.setAttribute('open', ''); this.querySelector('input,button,textarea').focus(); };
      dialog.close = function (value) { this.returnValue = value || ''; this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
      const form = dialog.querySelector('form[method="dialog"]');
      if (form) {
        let clicked = '';
        form.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { clicked = button.value; }));
        if (dialog.id === 'security-dialog') form.addEventListener('submit', event => { event.preventDefault(); dialog.close(clicked); });
      }
    });
    function viewport() { document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px'); }
    viewport(); window.addEventListener('resize', viewport);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', viewport);
    // Measure real Flex gap support rather than merely parsing the property.
    const flex = document.createElement('div');
    flex.style.cssText = 'position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px;';
    flex.appendChild(document.createElement('div')); flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    if (flex.scrollHeight === 1) document.documentElement.classList.add('supports-flex-gap');
    flex.parentNode.removeChild(flex);
  }
  function layout() {
    if (document.documentElement.classList.contains('supports-flex-gap')) return;
    document.querySelectorAll('*').forEach(element => {
      const style = getComputedStyle(element);
      if (style.display !== 'flex' && style.display !== 'inline-flex') return;
      const gap = style.getPropertyValue('--mini-gap').trim().split(/\s+/);
      if (!gap[0] || !parseFloat(gap[0])) return;
      const vertical = style.flexDirection.indexOf('column') === 0;
      const children = Array.from(element.children).filter(child => getComputedStyle(child).display !== 'none');
      children.forEach((child, index) => {
        child.style.marginLeft = !vertical && index ? (gap[1] || gap[0]) : '0px';
        child.style.marginTop = vertical && index ? gap[0] : '0px';
      });
    });
  }
  return { layout, load, save, clone, id, cryptoReady, prepareUI, blocked: () => readError, native: () => !!native };
})();
if (typeof module !== 'undefined') module.exports = MiniWalletRuntime;
