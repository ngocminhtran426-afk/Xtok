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

## 🛠️ Cấu trúc hệ thống (Architecture)
Hệ thống được chia làm 2 phần chính:

1. **Thư mục `/web` (Frontend - React + Vite)**
   - Đảm nhiệm giao diện hiển thị video.
   - Các tính năng: Component thẻ video, thanh cuộn Feed, tính toán tỉ lệ hiển thị.
2. **Thư mục `/crawler` (Backend + Bot)**
   - API phục vụ cho Web (`api.ts`).
   - Bot tự động thu thập video (`index.ts`, `worker.ts`).

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

## ☁️ Hướng dẫn cài đặt tự động lên máy chủ VPS (Ubuntu)

Nếu bạn có một VPS chạy **Ubuntu 20.04 / 22.04**, bạn có thể cài đặt tự động TOÀN BỘ dự án này chỉ bằng 1 dòng lệnh duy nhất. Đăng nhập vào VPS bằng quyền `root` và chạy:

```bash
curl -sL https://raw.githubusercontent.com/ngocminhtran426-afk/Xtok/main/setup_vps.sh | sudo bash -
```

Kịch bản tự động sẽ cài đặt mọi thứ: Node.js, Nginx, PM2, Tải mã nguồn, Biên dịch, và Khởi động hệ thống. Sau vài phút, bạn chỉ cần gõ IP của VPS lên trình duyệt là sử dụng được luôn!

## 📜 Giấy phép (License)
Dự án được xây dựng cho mục đích học tập và nghiên cứu mã nguồn mở.
