const DEFAULT_DOMAIN = 'xnhau.pics';
const DEFAULT_BAIT_URL = 'https://xnhau.pics/embed/37851';

document.addEventListener('DOMContentLoaded', () => {
  const statusBox = document.getElementById('statusBox');
  const btnBypass = document.getElementById('btnBypass');
  const btnSettings = document.getElementById('btnSettings');
  const settingsPanel = document.getElementById('settingsPanel');
  const inputDomain = document.getElementById('inputDomain');
  const inputBaitUrl = document.getElementById('inputBaitUrl');
  const btnSave = document.getElementById('btnSave');
  const saveMsg = document.getElementById('saveMsg');

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
      
      const debugBox = document.getElementById('debugBox');
      if (debugBox) {
        debugBox.textContent = 'Cookies: ' + (result.debug_cookies || 'None') + '\n\nHTML: ' + (result.debug_html || 'None');
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
    if (settingsPanel.classList.contains('show')) {
      // Load saved settings
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
      // Thông báo cho background.js cập nhật domain mới
      chrome.runtime.sendMessage({ type: 'DOMAIN_CHANGED', domain });

      saveMsg.style.display = 'block';
      setTimeout(() => { saveMsg.style.display = 'none'; }, 3000);
    });
  });

  // --- Auto-fill bait URL khi đổi domain ---
  inputDomain.addEventListener('input', () => {
    const domain = inputDomain.value.trim();
    if (domain) {
      inputBaitUrl.value = `https://${domain}/embed/37851`;
    }
  });

  // --- Lắng nghe storage change để tự update UI ---
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.cf_clearance) {
      checkStatus();
    }
  });
});
