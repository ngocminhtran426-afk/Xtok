// Lưu trữ cookie hiện tại để tránh update rule liên tục
let currentClearance = '';

// Default domain — sẽ bị ghi đè nếu user đã cấu hình trong Settings
const DEFAULT_DOMAIN = 'xnhau.pics';
let PRIMARY_DOMAIN = DEFAULT_DOMAIN;

// Load domain từ storage (user có thể đã đổi qua Settings)
chrome.storage.local.get(['primary_domain'], (result) => {
  if (result.primary_domain) {
    PRIMARY_DOMAIN = result.primary_domain;
  }
  // Sau khi có domain, khởi tạo rules
  initRules();
});

function initRules() {
  chrome.storage.local.get(['cf_clearance'], (result) => {
    if (result.cf_clearance) {
      currentClearance = result.cf_clearance;
      updateDynamicRule(currentClearance);
    } else {
      checkExistingCookies();
    }
  });
}

function checkExistingCookies() {
  chrome.cookies.getAll({ domain: PRIMARY_DOMAIN }, (cookies) => {
    const debugInfo = (cookies || []).map(c => c.name + ':' + c.domain).join(', ');
    chrome.storage.local.set({ debug_cookies: debugInfo });

    if (cookies && cookies.length > 0) {
      const cfCookie = cookies.find(c => c.name === 'cf_clearance');
      if (cfCookie) {
        const cookieString = `cf_clearance=${cfCookie.value}`;
        chrome.storage.local.set({ cf_clearance: cookieString });
        updateDynamicRule(cookieString);
      }
    }
  });
}

// Lắng nghe sự kiện cookie thay đổi (khi người dùng giải captcha)
chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  // Dùng 'xnhau' để match tất cả domain (ink, pics, loan, tech...)
  if (!cookie.domain.includes('xnhau')) return;

  chrome.storage.local.get(['debug_cookies'], (result) => {
    chrome.storage.local.set({
      debug_cookies: (result.debug_cookies || '') + ' | chg:' + cookie.name + '=' + (changeInfo.removed ? 'rem' : 'set')
    });
  });

  chrome.cookies.getAll({ domain: PRIMARY_DOMAIN }, (allCookies) => {
    if (allCookies && allCookies.length > 0) {
      const cfCookie = allCookies.find(c => c.name === 'cf_clearance');
      if (cfCookie) {
        const cookieString = `cf_clearance=${cfCookie.value}`;
        chrome.storage.local.set({ cf_clearance: cookieString });
        updateDynamicRule(cookieString);
      }
    } else {
      chrome.storage.local.remove(['cf_clearance']);
      removeDynamicRule();
    }
  });
});

function updateDynamicRule(cookieValue) {
  const rule = {
    id: 2,
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Cookie', operation: 'append', value: cookieValue },
        { header: 'Referer', operation: 'set', value: `https://${PRIMARY_DOMAIN}/` }
      ]
    },
    condition: {
      resourceTypes: ['sub_frame', 'media', 'xmlhttprequest'],
      initiatorDomains: ['xtok-app.onrender.com', 'localhost', '127.0.0.1']
    }
  };

  chrome.declarativeNetRequest.updateDynamicRules(
    { removeRuleIds: [2], addRules: [rule] },
    () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to update dynamic rule:', chrome.runtime.lastError);
      } else {
        console.log(`Dynamic Rule updated for ${PRIMARY_DOMAIN}`);
      }
    }
  );
}

function removeDynamicRule() {
  chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [2] });
}

// Lắng nghe message từ popup (đổi domain)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Popup báo domain đã thay đổi
  if (request.type === 'DOMAIN_CHANGED') {
    PRIMARY_DOMAIN = request.domain;
    console.log(`Domain changed to: ${PRIMARY_DOMAIN}`);
    // Xóa cookie cũ, kiểm tra lại với domain mới
    chrome.storage.local.remove(['cf_clearance']);
    removeDynamicRule();
    checkExistingCookies();
    sendResponse({ success: true });
    return;
  }
});
