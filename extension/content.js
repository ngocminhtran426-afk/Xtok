if (window.location.hostname.includes('xnhau')) {
  // Proxy mode: running on xnhau.ink
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      fetch(request.url)
        .then(res => res.text())
        .then(html => {
          chrome.storage.local.set({ debug_html: html.substring(0, 1000) });
          const isCaptcha = html.includes('cf-turnstile') || html.includes('Just a moment') || html.includes('cf-browser-verification');
          
          // Cố gắng tìm link mp4 hoặc m3u8. Nhiều khi link bị ẩn trong flashvars hoặc mã hóa
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
          chrome.storage.local.set({ debug_html: "Error: " + err.message });
          sendResponse({ mp4Url: null });
        });
      return true; // async
    }
  });
} else {
  // Inject mode: running on xtok-app
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
