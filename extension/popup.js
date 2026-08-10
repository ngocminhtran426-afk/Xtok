document.addEventListener('DOMContentLoaded', () => {
  const statusBox = document.getElementById('statusBox');
  const btnBypass = document.getElementById('btnBypass');

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

  // Chạy ngay khi mở popup
  checkStatus();

  // Bấm nút mở trang mồi
  btnBypass.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://xnhau.ink/embed/37851' });
  });

  // Lắng nghe thay đổi storage để tự update UI
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.cf_clearance) {
      checkStatus();
    }
  });
});
