import express from 'express';
import { loadConfig } from './config';
import { GoogleSheetsAdapter } from './adapters/google-sheets/adapter';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const tabs = [
  { id: 1, name: 'Mới Nhất (Trang chủ)', url: 'https://xnhau.pics/' },
  { id: 2, name: 'Hot Nhất', url: 'https://xnhau.pics/clip-sex-hot/' },
  { id: 3, name: 'Hay Nhất', url: 'https://xnhau.pics/clip-sex-hay/' },
  { id: 4, name: 'Dài Nhất', url: 'https://xnhau.pics/top-rated/?sort_by=duration' },
  { id: 5, name: 'Bình luận nhiều nhất', url: 'https://xnhau.pics/top-rated/?sort_by=most_commented' },
  { id: 6, name: 'Được yêu thích nhất', url: 'https://xnhau.pics/top-rated/?sort_by=most_favourited' }
];

let isCrawling = false;

// HTML Dashboard
app.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>XTok Crawler Dashboard</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #111; color: #fff; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
        .container { max-width: 600px; width: 100%; background: #222; padding: 30px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        h1 { margin-top: 0; color: #fe2c55; text-align: center; }
        .tab-btn { display: block; width: 100%; padding: 15px; margin-bottom: 10px; background: #333; border: 1px solid #444; color: #fff; font-size: 16px; border-radius: 8px; cursor: pointer; transition: 0.2s; text-align: left; }
        .tab-btn:hover { background: #fe2c55; border-color: #fe2c55; transform: translateY(-2px); }
        .status { margin-top: 20px; padding: 15px; border-radius: 8px; text-align: center; font-weight: bold; }
        .status.idle { background: #333; color: #aaa; }
        .status.crawling { background: #28a745; color: #fff; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>XTok Crawler</h1>
        <p style="text-align: center; color: #ccc; margin-bottom: 30px;">Chọn chuyên mục bạn muốn cào dữ liệu từ xNhau:</p>
        
        <form action="/start" method="POST" id="crawlForm">
          ${tabs.map(tab => `
            <button type="submit" name="tabUrl" value="${tab.url}" class="tab-btn" onclick="return confirm('Bắt đầu cào chuyên mục: ${tab.name}?')">
              ▶ ${tab.name}
            </button>
          `).join('')}
        </form>

        <div class="status ${isCrawling ? 'crawling' : 'idle'}">
          ${isCrawling ? '⏳ HỆ THỐNG ĐANG CÀO DỮ LIỆU...' : '💤 Sẵn sàng'}
        </div>
        
        <div style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
          UptimeRobot Ping Endpoint: <a href="/ping" style="color: #666;">/ping</a>
        </div>
      </div>
      <script>
        // Tự động tải lại trang mỗi 15s nếu đang crawling
        if (${isCrawling}) {
          setTimeout(() => window.location.reload(), 15000);
        }
      </script>
    </body>
    </html>
  `;
  res.send(html);
});

// Endpoint cho UptimeRobot
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Endpoint kích hoạt Crawler
app.post('/start', async (req, res) => {
  const { tabUrl } = req.body;
  
  if (!tabUrl) return res.status(400).send('Missing tab URL');
  if (isCrawling) return res.send('<h2>Hệ thống đang bận cào dữ liệu! Vui lòng chờ...</h2><br><a href="/">Quay lại</a>');

  isCrawling = true;
  
  // Trả về HTML thông báo đã nhận lệnh ngay lập tức để browser không bị quay vòng tròn
  res.send(`
    <html lang="vi">
    <body style="background: #111; color: #fff; font-family: sans-serif; text-align: center; padding: 50px;">
      <h2 style="color: #28a745;">🚀 Lệnh đã được kích hoạt thành công!</h2>
      <p>Hệ thống đang chạy ngầm phía sau.</p>
      <a href="/" style="color: #fe2c55; text-decoration: none;">Quay lại Bảng Điều Khiển</a>
    </body>
    </html>
  `);

  // Xử lý cào dữ liệu ngầm (Asynchronous)
  try {
    console.log(`[Crawler Server] Bắt đầu xử lý URL: ${tabUrl}`);
    
    // Cập nhật Google Sheets
    const config = loadConfig();
    const db = new GoogleSheetsAdapter(config.sheets.spreadsheetId);
    
    await db.connect();
    await db.createPage({
      url: tabUrl,
      priority: 'high'
    });
    console.log('[Crawler Server] Đã cập nhật Sheet thành công.');
    await db.disconnect();

    // Reset module cache of index.ts to ensure it runs cleanly if called multiple times
    delete require.cache[require.resolve('./index')];
    
    // Chạy logic chính của crawler
    // Lưu ý: index.ts chạy xong sẽ gọi process.exit(1) nếu lỗi hoặc process.exit() ngầm.
    // Để an toàn, chúng ta import nó. Vì đây là server riêng, nếu process.exit thì Render sẽ tự khởi động lại.
    // Điều này hoàn toàn tốt lành vì Web Server sẽ sống lại ngay!
    require('./index');
    
  } catch (error) {
    console.error('[Crawler Server] Lỗi nghiêm trọng:', error);
    isCrawling = false;
  }
});

app.listen(port, () => {
  console.log(`===================================`);
  console.log(`  XTok Crawler Web Server Active`);
  console.log(`===================================`);
  console.log(`[Server] Dashboard: http://localhost:${port}`);
  console.log(`[Server] Lệnh UptimeRobot Ping: http://localhost:${port}/ping`);
});
