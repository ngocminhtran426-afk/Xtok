if (window.location.hostname.includes('xnhau')) {
  // Proxy mode: running on xnhau.ink
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_XNHAU_PROXY") {
      fetch(request.url)
        .then(res => res.text())
        .then(html => {
          chrome.storage.local.set({ debug_html: html.substring(0, 1000) });
          const isCaptcha = html.includes('cf-turnstile') || html.includes('Just a moment') || html.includes('cf-browser-verification');
          const match = html.match(/https:\/\/[^"']*\.mp4/);
          if (isCaptcha) {
            sendResponse({ mp4Url: null, error: "CAPTCHA" });
          } else if (match) {
            sendResponse({ mp4Url: match[0] });
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
      window.postMessage({ 
        type: "FETCH_XNHAU_RESULT", 
        url: event.data.url, 
        mp4Url: response ? response.mp4Url : null,
        error: response ? response.error : null
      }, "*");
    });
  });
}
