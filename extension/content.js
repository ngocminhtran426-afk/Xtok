if (window.location.hostname.includes('xnhau')) {
  // Proxy mode: running on xnhau.ink
  // Dùng fetch() thay vì iframe vì iframe.contentDocument bị cross-origin block
  // (Cloudflare challenge redirect thay đổi origin, khiến contentDocument luôn bị denied)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      // fetch() trên cùng origin sẽ tự động gửi kèm cookie cf_clearance
      fetch(request.url, {
        credentials: 'include',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          return res.text();
        })
        .then(html => {
          chrome.storage.local.set({ debug_html: html.substring(0, 1000) });

          const isCaptcha = html.includes('cf-turnstile') ||
            html.includes('Just a moment') ||
            html.includes('cf-browser-verification') ||
            html.includes('captcha-box');

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
            sendResponse({ mp4Url: null, error: "NO_MP4", debug: html.substring(0, 500) });
          }
        })
        .catch(err => {
          chrome.storage.local.set({ debug_html: "Fetch Error: " + err.message });

          // Nếu fetch bị lỗi 403, rất có thể cf_clearance đã hết hạn
          if (err.message.includes('403')) {
            sendResponse({ mp4Url: null, error: "CAPTCHA" });
          } else {
            sendResponse({ mp4Url: null, error: "FETCH_FAILED", detail: err.message });
          }
        });

      return true; // async sendResponse
    }
  });
} else {
  // Inject mode: running on xtok-app (web app)
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
