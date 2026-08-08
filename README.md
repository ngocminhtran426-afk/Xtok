# 🚀 XTok - Nền tảng Video Ngắn Đỉnh Cao

XTok là một ứng dụng Web mô phỏng TikTok, với khả năng tự động cào (crawl) video liên tục từ các nguồn khác, lưu trữ và phát lại trên giao diện lướt cực kỳ mượt mà.

## 🌟 Tính năng nổi bật
* **Giao diện chuẩn TikTok**: Lướt dọc mượt mà, hỗ trợ thả tim, chia sẻ, sao chép liên kết.
* **Crawler tự động (Playwright)**: Tự động chạy ngầm, tự động lật trang (Pagination), cào hàng ngàn video và vượt qua rào cản Cloudflare.
* **Cơ sở dữ liệu đám mây kép**: 
  - Lưu video mới nhất vào Google Sheets.
  - Phân tích và quản lý metadata, lưu file/base64 backup vào MongoDB.
* **Hoàn toàn tự động (Github Actions)**: Tự động lên lịch cào video mới nhất mỗi 5 phút một lần.

---

## 🛠️ Phân chia nhiệm vụ (Kiến trúc phân tán)
Hệ thống được thiết kế để phân tải tối đa, chia làm 2 phần rõ rệt:

1. **Giao diện Web & API (Nên chạy trên Render)**
   - Nằm trong thư mục `/web` và lệnh `npm run api` của thư mục `/crawler`.
   - Phục vụ người xem lướt video với hiệu năng cao. Tự động lấy nguồn từ Github mỗi khi có code mới.
2. **Cỗ máy cào dữ liệu - Bot Crawler (Nên chạy trên VPS)**
   - Nằm trong thư mục `/crawler`.
   - Chuyên đóng vai trò tự động hóa bằng công nghệ giả lập trình duyệt Playwright, cào video xuyên ngày đêm, lật trang liên tục để đẩy vào CSDL.

---

## 💻 Hướng dẫn chạy trên máy tính cá nhân (Local)

### 1. Chuẩn bị
* Cài đặt **Node.js** (Phiên bản >= 18).
* Tải mã nguồn về máy tính.

### 2. Chạy Giao diện Web
Nhấp đúp chuột vào file `start_web.bat` trên Windows, hoặc chạy thủ công:
```bash
cd web
npm install
npm run dev
```

### 3. Chạy Bot Crawler & API
Nhấp đúp chuột vào file `start_browser.bat` (hoặc `crawl.bat`), hoặc chạy thủ công:
```bash
cd crawler
npm install
npx playwright install --with-deps chromium
npm run start  # Để chạy Bot Crawler
npm run api    # Để chạy Server API
```

---

## ☁️ Hướng dẫn biến VPS thành "Lò luyện Bot" cào dữ liệu 24/7

Để giải phóng cho máy tính cá nhân và đảm bảo Bot cào không ngừng nghỉ, bạn hãy dùng một VPS (chạy Ubuntu 20.04 hoặc 22.04) và dán 1 dòng lệnh duy nhất này vào bằng quyền `root`:

```bash
curl -sL https://raw.githubusercontent.com/ngocminhtran426-afk/Xtok/main/setup_vps.sh | sudo bash -
```

Kịch bản này sẽ gạt bỏ mọi thứ dư thừa và **chỉ thiết lập duy nhất con Bot Crawler** chạy ngầm bằng công cụ PM2. Máy chủ VPS của bạn sẽ siêu nhẹ và tập trung 100% tài nguyên cho việc "săn" video!

*Để xem Bot đang cào được bao nhiêu video trên VPS, gõ lệnh:* `sudo pm2 logs xtok-crawler`

## 📜 Giấy phép (License)
Dự án được xây dựng cho mục đích học tập và nghiên cứu mã nguồn mở.
