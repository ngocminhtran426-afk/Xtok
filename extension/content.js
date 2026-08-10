window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data || event.data.type !== "FETCH_XNHAU") return;
  
  chrome.runtime.sendMessage({ type: "FETCH_XNHAU", url: event.data.url }, (response) => {
    window.postMessage({ 
      type: "FETCH_XNHAU_RESULT", 
      url: event.data.url, 
      mp4Url: response ? response.mp4Url : null 
    }, "*");
  });
});
