if (window.location.hostname.includes('xnhau')) {
  // Proxy mode: running on xnhau.ink
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // ... proxy mode logic remains the same
    if (request.type === "FETCH_XNHAU_PROXY") {
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
          sendResponse({ mp4Url: null, error: "IFRAME_ACCESS_DENIED" });
        } finally {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }
      };
      
      document.body.appendChild(iframe);
      return true; // async
    }
  });

  // Nếu đang bị nhúng trong iframe (trên xtok-app), hãy ẩn giao diện của xnhau.ink đi để trông giống video native!
  if (window !== window.top) {
    const style = document.createElement('style');
    style.textContent = `
      /* Chỉ ẩn các thành phần dư thừa, giữ nguyên cấu trúc DOM để player hoạt động bình thường */
      body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000 !important; }
      
      /* Ẩn UI của player */
      .vjs-control-bar, .vjs-big-play-button, .vjs-loading-spinner, .vjs-text-track-display, .vjs-poster, .vjs-overlay, .vjs-hidden, .ad-banner { display: none !important; opacity: 0 !important; pointer-events: none !important; }
      
      /* Làm video to tràn viền */
      video, .vjs-tech { 
        position: fixed !important; 
        top: 0 !important; 
        left: 0 !important; 
        width: 100vw !important; 
        height: 100vh !important; 
        object-fit: contain !important; 
        z-index: 2147483647 !important; 
        pointer-events: none !important; /* Click pass through */
      }
      
      /* Đảm bảo Captcha hiển thị trên cùng */
      #cf-wrapper, #cf-wrapper *, #cf-turnstile, #cf-turnstile *, .cf-turnstile, .cf-turnstile *, iframe[src*="cloudflare"] { 
        z-index: 2147483647 !important; 
        pointer-events: auto !important; 
      }
    `;
    document.documentElement.appendChild(style);

    // Auto-skip ads script
    setInterval(() => {
      const skipBtn = document.querySelector('.vjs-ad-skip-button, .videoAdUiSkipButton, [class*="skip-button"]');
      if (skipBtn) {
        try { skipBtn.click(); } catch (e) {}
      } else {
        const elements = document.querySelectorAll('div, span, button, a');
        for (const el of elements) {
          const text = el.innerText?.toLowerCase() || '';
          if ((text.includes('skip') || text.includes('bỏ qua')) && !text.includes('in') && el.offsetHeight > 0) {
            try { el.click(); } catch (e) {}
          }
        }
      }
    }, 500);

    // Lắng nghe lệnh từ app cha (xtok-app)
    window.addEventListener("message", (event) => {
      const video = document.querySelector('video');
      if (!video) return;
      if (event.data.type === "XTOK_PLAY") {
        video.play().catch(e => console.log("Play error:", e));
      }
      if (event.data.type === "XTOK_PAUSE") {
        video.pause();
      }
      if (event.data.type === "XTOK_MUTE") {
        video.muted = event.data.value;
      }
    });

    // Báo cáo trạng thái video lên cho app cha
    setInterval(() => {
      const video = document.querySelector('video');
      if (video) {
        window.parent.postMessage({
          type: "XTOK_VIDEO_STATE",
          currentTime: video.currentTime,
          duration: video.duration,
          paused: video.paused
        }, "*");
      }
    }, 250);
  }
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
