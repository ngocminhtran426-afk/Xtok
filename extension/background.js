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
      resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'main_frame', 'other']
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_XNHAU") {
    fetch(request.url, { credentials: 'include' }) 
      .then(res => res.text())
      .then(html => {
        chrome.storage.local.set({ debug_html: html.substring(0, 1000) });
        const match = html.match(/https:\/\/[^"']*\.mp4/);
        sendResponse({ mp4Url: match ? match[0] : null });
      })
      .catch(err => {
        console.error(err);
        chrome.storage.local.set({ debug_html: err.toString() });
        sendResponse({ mp4Url: null });
      });
    return true; // async
  }
});
