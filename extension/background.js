// Lưu trữ cookie hiện tại để tránh update rule liên tục
let currentClearance = '';

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
  chrome.cookies.getAll({ domain: 'xnhau.ink' }, (cookies) => {
    chrome.storage.local.set({ debug_cookies: cookies.map(c => c.name + ':' + c.domain).join(', ') });
    if (cookies && cookies.length > 0) {
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      chrome.storage.local.set({ cf_clearance: cookieString });
      updateDynamicRule(cookieString);
    }
  });
}

// Lắng nghe sự kiện cookie thay đổi (khi người dùng giải captcha)
chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  if (cookie.domain.includes('xnhau')) {
    chrome.storage.local.get(['debug_cookies'], (result) => {
      chrome.storage.local.set({ debug_cookies: (result.debug_cookies || '') + ' | chg:' + cookie.name + '=' + (changeInfo.removed ? 'rem' : 'set') });
    });
    
    chrome.cookies.getAll({ domain: 'xnhau.ink' }, (allCookies) => {
      if (allCookies && allCookies.length > 0) {
        const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
        chrome.storage.local.set({ cf_clearance: cookieString });
        updateDynamicRule(cookieString);
      } else {
        chrome.storage.local.remove(['cf_clearance']);
        removeDynamicRule();
      }
    });
  }
});

function updateDynamicRule(cookieValue) {
  const rule = {
    id: 2, // ID 1 đã dành cho rules.json
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Cookie', operation: 'set', value: cookieValue },
        { header: 'Referer', operation: 'set', value: 'https://xnhau.ink/' }
      ]
    },
    condition: {
      urlFilter: 'xnhau',
      resourceTypes: ['sub_frame', 'media', 'xmlhttprequest'],
      initiatorDomains: ['xtok-app.onrender.com', 'localhost', '127.0.0.1']
    }
  };

  chrome.declarativeNetRequest.updateDynamicRules(
    {
      removeRuleIds: [2],
      addRules: [rule]
    },
    () => {
      console.log('Đã cập nhật Dynamic Rule ép Cookie cf_clearance thành công!');
    }
  );
}

function removeDynamicRule() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [2]
  });
}

let fetchQueue = [];
let isFetching = false;

function processQueue() {
  if (isFetching || fetchQueue.length === 0) return;
  isFetching = true;
  
  const { request, sendResponse } = fetchQueue.shift();

  chrome.tabs.query({}, (tabs) => {
    // Lọc các tab có URL chứa xnhau
    const xnhauTabs = tabs.filter(t => t.url && t.url.includes('xnhau'));
    if (xnhauTabs.length > 0) {
      chrome.tabs.sendMessage(xnhauTabs[0].id, { type: "FETCH_XNHAU_PROXY", url: request.url }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ mp4Url: null, error: "Tab proxy failed" });
        } else {
          sendResponse(response);
        }
        
        // Nghỉ 1 giây giữa các request để tránh bị hệ thống Anti-bot block do rate limit
        setTimeout(() => {
          isFetching = false;
          processQueue();
        }, 1000);
      });
    } else {
      sendResponse({ mp4Url: null, error: "No xnhau tab open" });
      isFetching = false;
      processQueue();
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_XNHAU") {
    fetchQueue.push({ request, sendResponse });
    processQueue();
    return true; // async
  }
});
