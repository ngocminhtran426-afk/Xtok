if (window.location.hostname.includes('xnhau')) {
  // Proxy mode: running on xnhau.ink
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      // Thay vì dùng fetch (bị WAF chặn do thiếu header điều hướng), ta dùng Iframe ẩn để giả lập tải trang thật.
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = request.url;
      
      const timeoutId = setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        sendResponse({ mp4Url: null, error: "TIMEOUT" });
      }, 15000);

      iframe.onload = () => {
        clearTimeout(timeoutId);
        try {
          const html = iframe.contentDocument.body.innerHTML;
          chrome.storage.local.set({ debug_html: html.substring(0, 1000) });
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
        } catch (err) {
          chrome.storage.local.set({ debug_html: "Iframe Error: " + err.message });
          sendResponse({ mp4Url: null, error: "IFRAME_ACCESS_DENIED" });
        } finally {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }
      };
      
      document.body.appendChild(iframe);
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
