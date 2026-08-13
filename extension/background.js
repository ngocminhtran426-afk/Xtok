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
        { header: 'Referer', operation: 'set', value: 'https://xnhau.ink/' },
        { header: 'Sec-Fetch-Site', operation: 'set', value: 'same-origin' },
        { header: 'Sec-Fetch-Mode', operation: 'set', value: 'no-cors' },
        { header: 'Sec-Fetch-Dest', operation: 'set', value: 'video' }
      ]
    },
    condition: {
      regexFilter: "(get_file|\\.mp4|\\.m3u8)",
      resourceTypes: ['media', 'xmlhttprequest', 'other']
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
  const targetUrl = request.url;

  fetch(targetUrl, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'User-Agent': navigator.userAgent
    }
  })
  .then(res => res.text())
  .then(html => {
    const isCaptcha = html.includes('cf-turnstile') || html.includes('Just a moment') || html.includes('cf-browser-verification') || html.includes('captcha-box');
    
    let mp4Url = null;
    const mp4Match = html.match(/https:\/\/[^"']*\.mp4[^"']*/i);
    const m3u8Match = html.match(/https:\/\/[^"']*\.m3u8[^"']*/i);
    const rawMatch = html.match(/(?:video_url|src)["'\s:]+([^"']+)/i);
    
    if (mp4Match) mp4Url = mp4Match[0];
    else if (m3u8Match) mp4Url = m3u8Match[0];
    else if (rawMatch && rawMatch[1].startsWith('http')) mp4Url = rawMatch[1];
    
    if (isCaptcha) {
      sendResponse({ mp4Url: null, error: "CAPTCHA" });
    } else if (mp4Url) {
      sendResponse({ mp4Url: mp4Url });
    } else {
      sendResponse({ mp4Url: null, error: "NO_MP4" });
    }
  })
  .catch(err => {
    sendResponse({ mp4Url: null, error: "FETCH_FAILED", details: err.message });
  })
  .finally(() => {
    setTimeout(() => {
      isFetching = false;
      processQueue();
    }, 300);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_XNHAU") {
    fetchQueue.push({ request, sendResponse });
    processQueue();
    return true; // async
  }
});
