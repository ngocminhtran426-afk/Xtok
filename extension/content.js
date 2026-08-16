if (window.location.hostname.includes('xnhau')) {
  // === PROXY MODE: chạy trên tab xnhau.pics ===
  // Lắng nghe request từ background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      
      // Tạo iframe để load trang embed, giống như trình duyệt thật
      // TRÁNH dùng display: 'none' vì Chrome có thể ngưng tải iframe trong background tab
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.left = '-9999px';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.opacity = '0';
      
      // Đặt timeout nếu iframe không load được
      const timeoutId = setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        sendResponse({ mp4Url: null, error: "TIMEOUT" });
      }, 25000);

      iframe.onload = () => {
        clearTimeout(timeoutId);
        try {
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const html = doc.body.innerHTML;
          chrome.storage.local.set({ debug_html: html.substring(0, 1000) });

          // Kiểm tra Cloudflare challenge
          if (html.includes('cf-turnstile') || html.includes('Just a moment') || html.includes('cf-browser-verification')) {
            document.body.removeChild(iframe);
            sendResponse({ mp4Url: null, error: "CAPTCHA" });
            return;
          }

          let mp4Url = null;
          const videoUrlMatch = html.match(/video_url:\s*['"]([^'"]+)['"]/);
          if (videoUrlMatch) {
            mp4Url = videoUrlMatch[1];
          }
          if (!mp4Url) {
            const mp4Match = html.match(/https:\/\/[^"'\s]*\.mp4[^"'\s]*/i);
            if (mp4Match) mp4Url = mp4Match[0];
          }
          if (!mp4Url) {
            const m3u8Match = html.match(/https:\/\/[^"'\s]*\.m3u8[^"'\s]*/i);
            if (m3u8Match) mp4Url = m3u8Match[0];
          }
          if (mp4Url) {
            mp4Url = mp4Url.replace(/['"',;\s]+$/, '');
          }

          document.body.removeChild(iframe);
          
          if (mp4Url) {
            sendResponse({ mp4Url: mp4Url });
          } else {
            sendResponse({ mp4Url: null, error: "NO_MP4", debug: html.substring(0, 500) });
          }
        } catch (err) {
          document.body.removeChild(iframe);
          chrome.storage.local.set({ debug_html: "Iframe Error: " + err.message });
          // Lỗi cross-origin nghĩa là CF đã redirect sang trang thử thách
          sendResponse({ mp4Url: null, error: "CAPTCHA", detail: err.message });
        }
      };

      iframe.src = request.url;
      document.body.appendChild(iframe);

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
