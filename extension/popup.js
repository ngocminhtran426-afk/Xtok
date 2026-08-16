const DEFAULT_DOMAIN = 'xnhau.pics';
const DEFAULT_BAIT_URL = 'https://xnhau.pics/embed/37851';

document.addEventListener('DOMContentLoaded', () => {
  const statusBox = document.getElementById('statusBox');
  const btnBypass = document.getElementById('btnBypass');
  const btnSettings = document.getElementById('btnSettings');
  const btnDebug = document.getElementById('btnDebug');
  const btnRunTest = document.getElementById('btnRunTest');
  
  const settingsPanel = document.getElementById('settingsPanel');
  const debugPanel = document.getElementById('debugPanel');
  
  const inputDomain = document.getElementById('inputDomain');
  const inputBaitUrl = document.getElementById('inputBaitUrl');
  const btnSave = document.getElementById('btnSave');
  const saveMsg = document.getElementById('saveMsg');
  const debugLog = document.getElementById('debugLog');

  function logToDebug(msg, type = 'info') {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    const el = document.createElement('div');
    el.className = type;
    el.textContent = `[${time}] ${msg}`;
    debugLog.appendChild(el);
    debugLog.scrollTop = debugLog.scrollHeight;
  }

  // --- Status check ---
  function checkStatus() {
    chrome.storage.local.get(['cf_clearance', 'debug_cookies', 'debug_html'], (result) => {
      if (result.cf_clearance || result.debug_cookies) {
        statusBox.textContent = 'Đã Kích Hoạt ✅ (Cookies OK)';
        statusBox.className = 'status active';
      } else {
        statusBox.textContent = 'Chưa có thẻ bài ❌';
        statusBox.className = 'status inactive';
      }
    });
  }

  checkStatus();

  // --- Bypass button: mở trang mồi ---
  btnBypass.addEventListener('click', () => {
    chrome.storage.local.get(['bait_url'], (result) => {
      const url = result.bait_url || DEFAULT_BAIT_URL;
      chrome.tabs.create({ url });
    });
  });

  // --- Settings toggle ---
  btnSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('show');
    debugPanel.classList.remove('show');
    if (settingsPanel.classList.contains('show')) {
      chrome.storage.local.get(['primary_domain', 'bait_url'], (result) => {
        inputDomain.value = result.primary_domain || DEFAULT_DOMAIN;
        inputBaitUrl.value = result.bait_url || DEFAULT_BAIT_URL;
      });
    }
  });

  // --- Save settings ---
  btnSave.addEventListener('click', () => {
    const domain = inputDomain.value.trim();
    const baitUrl = inputBaitUrl.value.trim();

    if (!domain) {
      alert('Vui lòng nhập tên miền!');
      return;
    }

    chrome.storage.local.set({
      primary_domain: domain,
      bait_url: baitUrl || `https://${domain}/embed/37851`
    }, () => {
      chrome.runtime.sendMessage({ type: 'DOMAIN_CHANGED', domain });
      saveMsg.style.display = 'block';
      setTimeout(() => { saveMsg.style.display = 'none'; }, 3000);
    });
  });

  inputDomain.addEventListener('input', () => {
    const domain = inputDomain.value.trim();
    if (domain) {
      inputBaitUrl.value = `https://${domain}/embed/37851`;
    }
  });

  // --- Lắng nghe storage change ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.cf_clearance) {
      checkStatus();
    }
  });

  // --- Diagnostic Tools ---
  btnDebug.addEventListener('click', () => {
    debugPanel.classList.toggle('show');
    settingsPanel.classList.remove('show');
    if (debugPanel.classList.contains('show')) {
      runDiagnostics();
    }
  });

  btnRunTest.addEventListener('click', () => {
    debugLog.innerHTML = '';
    runDiagnostics();
  });

  async function runDiagnostics() {
    logToDebug('Bắt đầu chẩn đoán hệ thống...', 'info');
    
    // 1. Kiểm tra domain hiện tại
    const storage = await new Promise(r => chrome.storage.local.get(['primary_domain', 'cf_clearance'], r));
    const domain = storage.primary_domain || DEFAULT_DOMAIN;
    logToDebug(`Domain đang dùng: ${domain}`, 'info');

    // 2. Kiểm tra cookies
    if (storage.cf_clearance) {
      logToDebug('✅ Cookie cf_clearance: CÓ', 'ok');
    } else {
      logToDebug('❌ Cookie cf_clearance: KHÔNG (Bạn cần giải captcha trước)', 'err');
    }

    // 3. Tìm tab xnhau để test fetch
    chrome.tabs.query({}, (tabs) => {
      const xnhauTabs = tabs.filter(t => t.url && t.url.includes(domain));
      if (xnhauTabs.length === 0) {
        logToDebug(`❌ Không tìm thấy tab nào mở trang ${domain}`, 'err');
        logToDebug('Vui lòng bấm nút đỏ ở trên để mở trang mồi', 'warn');
        return;
      }
      
      const tabId = xnhauTabs[0].id;
      logToDebug(`✅ Đã tìm thấy tab ${domain} (ID: ${tabId})`, 'ok');
      
      // 4. Test fetch qua content script
      logToDebug('Đang thử fetch trang mồi qua tab này...', 'info');
      const testUrl = `https://${domain}/embed/37851`;
      
      chrome.tabs.sendMessage(tabId, { type: "FETCH_XNHAU_PROXY", url: testUrl }, (response) => {
        if (chrome.runtime.lastError) {
          logToDebug(`❌ Lỗi kết nối Content Script: ${chrome.runtime.lastError.message}`, 'err');
          logToDebug('Hãy tải lại trang mồi (F5)', 'warn');
          return;
        }
        
        if (!response) {
          logToDebug('❌ Không có phản hồi từ Content Script', 'err');
          return;
        }

        if (response.error) {
          logToDebug(`❌ Lỗi Fetch: ${response.error}`, 'err');
          if (response.detail) logToDebug(`Detail: ${response.detail}`, 'err');
          if (response.debug) logToDebug(`HTML Preview: ${response.debug}`, 'warn');
        } else if (response.mp4Url) {
          logToDebug(`✅ Lấy video THÀNH CÔNG!`, 'ok');
          logToDebug(`URL: ${response.mp4Url.substring(0, 50)}...`, 'ok');
        } else {
          logToDebug(`⚠️ Phản hồi không rõ: ${JSON.stringify(response)}`, 'warn');
        }
      });
    });
  }
});
