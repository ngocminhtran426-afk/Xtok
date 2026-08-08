#!/bin/bash

echo "==================================================="
echo "  🚀 XTOK VPS AUTO SETUP SCRIPT (BOT ONLY)"
echo "==================================================="

echo "[1/4] Đang cập nhật hệ thống..."
sudo apt update && sudo apt upgrade -y

echo "[2/4] Đang cài đặt Node.js 20, Git, PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2

echo "[3/4] Đang tải mã nguồn từ Github..."
sudo mkdir -p /var/www
cd /var/www
if [ -d "xtok" ]; then
    echo "Thư mục xtok đã tồn tại. Đang cập nhật code mới..."
    cd xtok
    sudo git pull
else
    sudo git clone https://github.com/ngocminhtran426-afk/Xtok.git xtok
    cd xtok
fi

echo "[4/4] Đang cấu hình và cài đặt Crawler Bot..."
cd /var/www/xtok/crawler
sudo npm install
sudo npx playwright install --with-deps chromium

# Tạo file .env nếu chưa có
if [ ! -f .env ]; then
    echo "GOOGLE_SHEETS_SPREADSHEET_ID=13CXE7Z_Trz05WdT9Fy_usqyhen18sx46Lv4RorfLYlU" | sudo tee .env > /dev/null
    echo "CRAWLER_ENABLED=true" | sudo tee -a .env > /dev/null
fi

# Chạy dịch vụ cào dữ liệu bằng PM2
sudo pm2 delete xtok-crawler 2>/dev/null
sudo pm2 start npm --name "xtok-crawler" -- run start
sudo pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root 2>/dev/null

echo "==================================================="
echo "  ✅ CÀI ĐẶT HOÀN TẤT!"
echo "==================================================="
echo "Hệ thống cào dữ liệu (Bot Crawler) đã được cài đặt và đang chạy ngầm 24/7."
echo "Để xem tiến trình của Bot, bạn có thể dùng lệnh: sudo pm2 logs xtok-crawler"
