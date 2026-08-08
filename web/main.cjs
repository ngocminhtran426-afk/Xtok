const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

let settings = { mainDomain: 'https://xnhau.loan', cdnDomain: 'https://m.xnhau.loan' };
try {
  const settingsPath = path.join(process.cwd(), 'settings.json');
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }
} catch (e) {
  console.log('No settings.json found, using defaults.');
}

// KHÔNG sử dụng disable-site-isolation-trials ở đây vì nó gây lỗi IPC 114 (trắng màn hình) khi dùng iframe!

let mainWindow;
let globalCfClearance = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 450,
    height: 850,
    title: 'Tiktok Web UI',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  mainWindow.maximize();

  // CHIÊU TRÒ: Bẻ khóa X-Frame-Options và Content-Security-Policy
  // Bỏ qua Cloudflare challenge URLs
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (details.url.includes('/cdn-cgi/') || 
        details.url.includes('challenges.cloudflare.com') ||
        details.url.includes('cloudflareinsights.com')) {
      return callback({ cancel: false, responseHeaders: details.responseHeaders });
    }

    const responseHeaders = Object.assign({}, details.responseHeaders);
    delete responseHeaders['X-Frame-Options'];
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Cross-Origin-Embedder-Policy'];
    delete responseHeaders['cross-origin-embedder-policy'];
    delete responseHeaders['Cross-Origin-Opener-Policy'];
    delete responseHeaders['cross-origin-opener-policy'];
    delete responseHeaders['Cross-Origin-Resource-Policy'];
    delete responseHeaders['cross-origin-resource-policy'];
    
    callback({ cancel: false, responseHeaders: responseHeaders });
  });

  const realUA = session.defaultSession.getUserAgent().replace(/Electron\/[\d.]+\s/g, '');
  app.userAgentFallback = realUA; // ĐỒNG BỘ User-Agent trên TOÀN BỘ session (cả HTTP lẫn JavaScript navigator.userAgent)

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // KHÔNG CAN THIỆP vào request của Cloudflare challenge!
    if (details.url.includes('/cdn-cgi/') || 
        details.url.includes('challenges.cloudflare.com') ||
        details.url.includes('cloudflareinsights.com') ||
        details.url.includes('turnstile') ||
        details.url.includes('__cf_chl')) {
      return callback({ cancel: false, requestHeaders: details.requestHeaders });
    }

    // CHỈ fake Referer nếu request xuất phát từ localhost (từ App)
    // KHÔNG đổi Referer của webview/iframe vì JWPlayer cần Referer đúng (trang embed)
    const currentReferer = details.requestHeaders['Referer'] || details.requestHeaders['referer'] || '';
    if (currentReferer.includes('localhost')) {
      if (details.url.includes('xnhau')) {
        details.requestHeaders['Referer'] = settings.mainDomain + '/';
      }
    }

    // ÉP BỘC COOKIE cho MỌI request tới xnhau (cả trang embed lẫn CDN)
    // Lý do: Cookie cf_clearance bị SameSite=Lax, nên iframe cross-origin (từ localhost) sẽ KHÔNG tự động gửi!
    // Phải tiêm thủ công thì iframe mới qua được Cloudflare mà không bị kẹt ở màn hình xám.
    if (globalCfClearance && details.url.includes('xnhau')) {
      const currentCookie = details.requestHeaders['Cookie'] || details.requestHeaders['cookie'] || '';
      if (!currentCookie.includes('cf_clearance')) {
        details.requestHeaders['Cookie'] = currentCookie ? `${currentCookie}; cf_clearance=${globalCfClearance}` : `cf_clearance=${globalCfClearance}`;
      }
    }
    
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5174';
  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(startUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

function createCloudflareBypasser(onSuccess) {
  console.log("Đang mở cửa sổ vượt Cloudflare...");
  const bypassWin = new BrowserWindow({
    width: 600,
    height: 600,
    title: 'Đang vượt Cloudflare...',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  bypassWin.loadURL(settings.mainDomain + '/embed/505311');

  const checkInterval = setInterval(async () => {
    if (bypassWin.isDestroyed()) {
      clearInterval(checkInterval);
      return;
    }
    const title = await bypassWin.getTitle();
    
    // Nếu tiêu đề không còn là Just a moment / Chờ một chút...
    if (title && !title.includes('Chờ một chút') && !title.includes('Just a moment') 
             && !title.includes('Cloudflare') && !title.includes('Xác minh')
             && !title.includes('xNhau')) {
      
      clearInterval(checkInterval); // CHẶN NGAY LẬP TỨC ĐỂ KHÔNG BỊ LẶP LẠI

      // Lấy thẻ bài cf_clearance
      session.defaultSession.cookies.get({ url: settings.mainDomain })
        .then((cookies) => {
          const cfCookie = cookies.find(c => c.name === 'cf_clearance');
          if (cfCookie) {
            globalCfClearance = cfCookie.value;
            console.log("Đã lấy được thẻ bài (cf_clearance)! Sẵn sàng vượt tường lửa...");
          }
        }).catch(err => console.log(err));

      setTimeout(() => {
        console.log("Đã lấy được Cookie Cloudflare! Bắt đầu mở Tiktok UI...");
        onSuccess();
        setTimeout(() => {
          if (!bypassWin.isDestroyed()) bypassWin.close();
        }, 1000);
      }, 2000);
    }
  }, 1500);
}

let isAppQuitting = false;

app.whenReady().then(() => {
  createCloudflareBypasser(() => {
    createWindow();
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createCloudflareBypasser(() => {
        createWindow();
      });
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin' && isAppQuitting) app.quit();
});

app.on('before-quit', () => {
  isAppQuitting = true;
});
