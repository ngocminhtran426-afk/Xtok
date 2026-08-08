#!/bin/bash

echo "==================================================="
echo "  🚀 XTOK VPS AUTO SETUP SCRIPT"
echo "==================================================="

echo "[1/6] Đang cập nhật hệ thống..."
sudo apt update && sudo apt upgrade -y

echo "[2/6] Đang cài đặt Node.js 20, Git, Nginx, PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
sudo npm install -g pm2

echo "[3/6] Đang tải mã nguồn từ Github..."
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

echo "[4/6] Đang cấu hình và cài đặt Web Frontend..."
cd /var/www/xtok/web
sudo npm install
sudo npm run build

echo "[5/6] Đang cấu hình và cài đặt Crawler / API..."
cd /var/www/xtok/crawler
sudo npm install
sudo npx playwright install --with-deps chromium

# Tạo file .env nếu chưa có
if [ ! -f .env ]; then
    echo "GOOGLE_SHEETS_SPREADSHEET_ID=13CXE7Z_Trz05WdT9Fy_usqyhen18sx46Lv4RorfLYlU" | sudo tee .env > /dev/null
    echo "CRAWLER_ENABLED=true" | sudo tee -a .env > /dev/null
fi

# Chạy các dịch vụ ngầm bằng PM2
sudo pm2 delete all 2>/dev/null
sudo pm2 start npm --name "xtok-api" -- run api
sudo pm2 start npm --name "xtok-crawler" -- run start
sudo pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root 2>/dev/null

echo "[6/6] Đang cấu hình Nginx (Web Server)..."
cat << 'EOF' | sudo tee /etc/nginx/sites-available/xtok
server {
    listen 80;
    server_name _;

    location / {
        root /var/www/xtok/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/xtok /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "==================================================="
echo "  ✅ CÀI ĐẶT HOÀN TẤT!"
echo "==================================================="
echo "Trang Web và hệ thống cào dữ liệu đã được cài đặt và đang chạy ngầm."
echo "Hãy mở trình duyệt và truy cập vào IP của VPS này để xem thành quả nhé!"
