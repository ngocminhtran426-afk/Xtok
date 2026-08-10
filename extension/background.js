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
  chrome.cookies.getAll({ name: 'cf_clearance' }, (cookies) => {
    if (cookies && cookies.length > 0) {
      const xnhauCookie = cookies.find(c => c.domain.includes('xnhau'));
      if (xnhauCookie) {
        currentClearance = xnhauCookie.value;
        chrome.storage.local.set({ cf_clearance: currentClearance });
        updateDynamicRule(currentClearance);
      }
    }
  });
}

// Lắng nghe sự kiện cookie thay đổi (khi người dùng giải captcha)
chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  if (cookie.name === 'cf_clearance' && cookie.domain.includes('xnhau')) {
    if (!changeInfo.removed && cookie.value !== currentClearance) {
      currentClearance = cookie.value;
      console.log('Phát hiện thẻ bài mới:', currentClearance);
      // Lưu lại
      chrome.storage.local.set({ cf_clearance: currentClearance });
      // Cập nhật luật ép cookie
      updateDynamicRule(currentClearance);
    } else if (changeInfo.removed) {
      currentClearance = '';
      chrome.storage.local.remove(['cf_clearance']);
      removeDynamicRule();
    }
  }
});

function updateDynamicRule(cookieValue) {
  const rule = {
    id: 2, // ID 1 đã dành cho rules.json
    priority: 2,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'Cookie', operation: 'append', value: `cf_clearance=${cookieValue}` }
      ]
    },
    condition: {
      urlFilter: 'xnhau',
      resourceTypes: ['sub_frame', 'xmlhttprequest', 'media', 'main_frame']
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
