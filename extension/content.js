if (window.location.hostname.includes('xnhau')) {
  // === PROXY MODE: chạy trên tab xnhau.pics ===
  
  // Inject fetch helper vào page context (để dùng cookie của trang, không phải extension)
  // Content script fetch() dùng extension origin → không gửi cookie cf_clearance
  // Page context fetch() dùng page origin → tự động kèm cookie
  const injectedScript = document.createElement('script');
  injectedScript.textContent = `
    window.addEventListener('message', async (event) => {
      if (event.source !== window || !event.data || event.data.type !== '__XNHAU_PAGE_FETCH') return;
      try {
        const res = await fetch(event.data.url, { credentials: 'include' });
        const html = await res.text();
        window.postMessage({ type: '__XNHAU_PAGE_FETCH_RESULT', requestUrl: event.data.url, html: html, status: res.status }, '*');
      } catch (err) {
        window.postMessage({ type: '__XNHAU_PAGE_FETCH_RESULT', requestUrl: event.data.url, error: err.message }, '*');
      }
    });
  `;
  (document.head || document.documentElement).appendChild(injectedScript);

  // Lắng nghe kết quả từ page context và chuyển tiếp cho background
  let pendingResponses = {};

  window.addEventListener('message', (event) => {
    if (event.data?.type === '__XNHAU_PAGE_FETCH_RESULT') {
      const url = event.data.requestUrl;
      if (pendingResponses[url]) {
        const sendResponse = pendingResponses[url];
        delete pendingResponses[url];

        if (event.data.error) {
          chrome.storage.local.set({ debug_html: "Page Fetch Error: " + event.data.error });
          sendResponse({ mp4Url: null, error: "FETCH_FAILED", detail: event.data.error });
          return;
        }

        const html = event.data.html;
        chrome.storage.local.set({ debug_html: html.substring(0, 1000) });

        // Kiểm tra Cloudflare challenge
        const isCaptcha = html.includes('cf-turnstile') ||
          html.includes('Just a moment') ||
          html.includes('cf-browser-verification') ||
          html.includes('captcha-box');

        if (isCaptcha) {
          sendResponse({ mp4Url: null, error: "CAPTCHA" });
          return;
        }

        // Parse video URL — hỗ trợ format mới: video_url: 'https://...get_file/.../37851.mp4/'
        let mp4Url = null;

        // 1. Tìm video_url trong JavaScript object (chính xác nhất)
        const videoUrlMatch = html.match(/video_url:\s*['"]([^'"]+)['"]/);
        if (videoUrlMatch) {
          mp4Url = videoUrlMatch[1];
        }

        // 2. Fallback: tìm URL .mp4 bất kỳ (kể cả có / sau .mp4)
        if (!mp4Url) {
          const mp4Match = html.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/i);
          if (mp4Match) mp4Url = mp4Match[0];
        }

        // 3. Fallback: tìm .m3u8
        if (!mp4Url) {
          const m3u8Match = html.match(/https:\/\/[^"'\s]*\.m3u8[^"'\s]*/i);
          if (m3u8Match) mp4Url = m3u8Match[0];
        }

        // 4. Cleanup: loại bỏ trailing quote/comma nếu bị regex bắt thừa
        if (mp4Url) {
          mp4Url = mp4Url.replace(/['"',;\s]+$/, '');
        }

        if (mp4Url) {
          sendResponse({ mp4Url: mp4Url });
        } else {
          sendResponse({ mp4Url: null, error: "NO_MP4", debug: html.substring(0, 500) });
        }
      }
    }
  });

  // Nhận request từ background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      // Lưu callback để nhận kết quả từ page fetch
      pendingResponses[request.url] = sendResponse;

      // Gửi request fetch vào page context
      window.postMessage({ type: '__XNHAU_PAGE_FETCH', url: request.url }, '*');

      // Timeout nếu page fetch không phản hồi
      setTimeout(() => {
        if (pendingResponses[request.url]) {
          const cb = pendingResponses[request.url];
          delete pendingResponses[request.url];
          cb({ mp4Url: null, error: "TIMEOUT" });
        }
      }, 15000);

      return true; // async sendResponse
    }
  });
} else {
  // === INJECT MODE: chạy trên xtok-app (web app) ===
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.type !== "FETCH_XNHAU") return;
    
    chrome.runtime.sendMessage({ type: "FETCH_XNHAU", url: event.data.url }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({ 
          type: "FETCH_XNHAU_RESULT", 
          url: event.data.url, 
          error: "EXTENSION_DISCONNECTED"
        }, "*");
        return;
      }
      window.postMessage({ 
        type: "FETCH_XNHAU_RESULT", 
        url: event.data.url, 
        mp4Url: response ? response.mp4Url : null,
        error: response ? response.error : null
      }, "*");
    });
  });
}
