// Lưu trữ cookie hiện tại để tránh update rule liên tục
let currentClearance = '';

// Danh sách domain xnhau hỗ trợ (đồng bộ với manifest.json)
const XNHAU_DOMAINS = ['xnhau.pics', 'xnhau.ink', 'xnhau.loan', 'xnhau.tech'];
const PRIMARY_DOMAIN = 'xnhau.pics';

// Khởi tạo rule từ storage khi extension bật lên
chrome.storage.local.get(['cf_clearance'], (result) => {
  if (result.cf_clearance) {
    currentClearance = result.cf_clearance;
    updateDynamicRule(currentClearance);
  } else {
    // Nếu chưa có trong storage, thử tìm trong trình duyệt
    checkExistingCookies();
  }
});

function checkExistingCookies() {
  // Kiểm tra tất cả domain xnhau
  const allCookiePromises = XNHAU_DOMAINS.map(domain =>
    new Promise(resolve => {
      chrome.cookies.getAll({ domain }, cookies => resolve(cookies || []));
    })
  );

  Promise.all(allCookiePromises).then(results => {
    const allCookies = results.flat();
    const debugInfo = allCookies.map(c => c.name + ':' + c.domain).join(', ');
    chrome.storage.local.set({ debug_cookies: debugInfo });

    if (allCookies.length > 0) {
      // Ưu tiên cookies từ primary domain, hoặc lấy tất cả
      const primaryCookies = allCookies.filter(c => c.domain.includes(PRIMARY_DOMAIN));
      const cookiesToUse = primaryCookies.length > 0 ? primaryCookies : allCookies;
      const cookieString = cookiesToUse.map(c => `${c.name}=${c.value}`).join('; ');
      chrome.storage.local.set({ cf_clearance: cookieString });
      updateDynamicRule(cookieString);
    }
  });
}

// Lắng nghe sự kiện cookie thay đổi (khi người dùng giải captcha)
chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  // Kiểm tra tất cả domain xnhau, không chỉ 1
  const isXnhau = XNHAU_DOMAINS.some(d => cookie.domain.includes(d));
  if (!isXnhau) return;

  chrome.storage.local.get(['debug_cookies'], (result) => {
    chrome.storage.local.set({
      debug_cookies: (result.debug_cookies || '') + ' | chg:' + cookie.name + '=' + (changeInfo.removed ? 'rem' : 'set')
    });
  });

  // Sau khi cookie thay đổi, lấy lại tất cả cookies mới nhất
  chrome.cookies.getAll({ domain: PRIMARY_DOMAIN }, (allCookies) => {
    if (allCookies && allCookies.length > 0) {
      const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
      chrome.storage.local.set({ cf_clearance: cookieString });
      updateDynamicRule(cookieString);
    } else {
      chrome.storage.local.remove(['cf_clearance']);
      removeDynamicRule();
    }
  });
});

function updateDynamicRule(cookieValue) {
  const rule = {
    id: 2, // ID 1 đã dành cho rules.json (static)
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Cookie', operation: 'set', value: cookieValue },
        { header: 'Referer', operation: 'set', value: `https://${PRIMARY_DOMAIN}/` }
      ]
    },
    condition: {
      // Match tất cả domain xnhau
      urlFilter: '||xnhau.',
      resourceTypes: ['sub_frame', 'media', 'xmlhttprequest'],
      initiatorDomains: ['xtok-app.onrender.com', 'localhost', '127.0.0.1', ...XNHAU_DOMAINS]
    }
  };

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [2],
      addRules: [rule]
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update dynamic rule:', chrome.runtime.lastError);
      } else {
        console.log('Đã cập nhật Dynamic Rule ép Cookie cf_clearance thành công!');
      }
    }
  );
}

function removeDynamicRule() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [2]
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_XNHAU") {
    // Tìm tab xnhau.ink đang mở để gửi proxy request
    chrome.tabs.query({}, (allTabs) => {
      // Tìm tab xnhau từ tất cả domain
      const xnhauTab = allTabs.find(tab =>
        tab.url && XNHAU_DOMAINS.some(d => tab.url.includes(d))
      );

      if (xnhauTab) {
        chrome.tabs.sendMessage(xnhauTab.id, { type: "FETCH_XNHAU_PROXY", url: request.url }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ mp4Url: null, error: "Tab proxy failed", detail: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ mp4Url: null, error: "No xnhau tab open" });
      }
    });
    return true; // async
  }
});
