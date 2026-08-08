// Preload script chạy ẩn bên trong tất cả các Iframe
function injectTiktokHacks() {
  if (!window.location.href.includes('xnhau.tech')) return;

  // 1. TÀNG HÌNH GIAO DIỆN GỐC, CHỈ ĐỂ LẠI LÕI VIDEO
  const style = document.createElement('style');
  style.textContent = `
    /* Reset nền đen tuyệt đối */
    body, html { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; background: #000 !important; }
    
    /* Ẩn TOÀN BỘ giao diện của player (thanh tiến trình, nút play, logo...) */
    .fp-ui, .fp-controls, .vjs-control-bar, .kt-player-controls, .embed-btn, 
    [class*="control"], [class*="overlay"], [class*="logo"], [class*="btn"], 
    header, footer, nav, a, iframe, canvas {
      display: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
    
    /* Ngoại trừ thẻ video gốc */
    video {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      object-fit: cover !important;
      z-index: 9999 !important;
      pointer-events: none !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  
  // Dùng setInterval để chắc chắn style được nhúng vào (phòng khi body chưa load)
  const tryInject = setInterval(() => {
    if (document.head || document.documentElement) {
      (document.head || document.documentElement).appendChild(style);
      clearInterval(tryInject);
    }
  }, 50);

  // 2. LẮNG NGHE LỆNH ĐIỀU KHIỂN TỪ REACT (TIKTOK UI)
  window.addEventListener('message', (event) => {
    const video = document.querySelector('video');
    if (!video) return;
    
    if (event.data && event.data.action === 'togglePlay') {
      if (video.paused) {
        video.play().catch(e => console.log("Play failed:", e));
      } else {
        video.pause();
      }
    }
  });

  // 3. ÉP TỰ ĐỘNG PHÁT KHI VỪA TẢI XONG
  let playAttempts = 0;
  const tryPlay = setInterval(() => {
    const video = document.querySelector('video');
    if (video) {
      // Ép style liên tục đề phòng player nó override lại
      video.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: cover !important; z-index: 9999 !important; pointer-events: none !important; display: block !important;";
      
      if (video.paused) {
        video.play().catch(() => {});
      } else {
        // Đã play thành công
        clearInterval(tryPlay);
      }
    }
    playAttempts++;
    if (playAttempts > 40) clearInterval(tryPlay); // Dừng sau 20 giây nếu không có video
  }, 500);
}

injectTiktokHacks();
