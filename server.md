Serverga Joylash Ketma-Ketligi
1. Server Tayyorgarligi
1.1. Server Tanlash
VPS (DigitalOcean, Hetzner, Linode) yoki
Bulut xizmati (AWS, Google Cloud, Azure)
1.2. Dasturiy Ta'minot O'rnatish
bash
CopyInsert
# Yangi serverda:
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget

# Node.js va npm o'rnatish (LTS versiyasi)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL o'rnatish
sudo apt install -y postgresql postgresql-contrib

# Redis o'rnatish
sudo apt install -y redis-server
2. Loyihani Serverga Yuklash
2.1. Kodni Yuklab Olish
bash
CopyInsert
cd /opt
sudo git clone https://github.com/sizning/finco_telegram_bot.git
sudo chown -R $USER:$USER finco_telegram_bot/
cd finco_telegram_bot
2.2. Loyiha Sozlamalari
bash
CopyInsert
# .env faylini yaratish
cp .env.example .env
nano .env  # Sozlamalarni tahrirlash
3. Ma'lumotlar Bazasini Sozlash
3.1. PostgreSQL Sozlamalari
bash
CopyInsert
sudo -u postgres psql
CREATE DATABASE finco_kpi_bot_db;
CREATE USER finco_user WITH PASSWORD 'kuchli_parol';
GRANT ALL PRIVILEGES ON DATABASE finco_kpi_bot_db TO finco_user;
\q
3.2. Redis Sozlamalari
bash
CopyInsert
sudo nano /etc/redis/redis.conf
# `supervised` sozlamasini `systemd` ga o'zgartiring
sudo systemctl restart redis
4. Loyihani O'rnatish
4.1. Kutubxonalarni O'rnatish
bash
CopyInsert
npm install
npm run build
4.2. Migratsiyalarni Ishlatish
bash
CopyInsert
# Agar TypeORM migrations bo'lsa
npx typeorm migration:run
5. PM2 bilan Ishga Tushirish
5.1. PM2 O'rnatish
bash
CopyInsert in Terminal
sudo npm install -g pm2
5.2. Dasturni Ishlatish
bash
CopyInsert
# Production rejimida ishga tushirish
NODE_ENV=production pm2 start dist/main.js --name "finco-bot"

# PM2 ni avtostartga qo'shish
pm2 startup
pm2 save
6. Nginx Sozlamalari (Ixtiyoriy)
6.1. Nginx O'rnatish
bash
CopyInsert
sudo apt install -y nginx
sudo systemctl enable nginx
6.2. Konfiguratsiya
bash
CopyInsert in Terminal
sudo nano /etc/nginx/sites-available/finco-bot
nginx
CopyInsert
server {
    listen 80;
    server_name sizning-domeningiz.uz;

    location / {
        proxy_pass http://localhost:3000;  # Botingiz porti
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
bash
CopyInsert
sudo ln -s /etc/nginx/sites-available/finco-bot /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
7. Xavfsizlik Sozlamalari
7.1. Firewall
bash
CopyInsert
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
7.2. SSL (Let's Encrypt)
bash
CopyInsert
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sizning-domeningiz.uz
8. Monitoring
8.1. PM2 Monitoring
bash
CopyInsert
pm2 monit
pm2 logs
8.2. Tizim Monitoring
bash
CopyInsert
# Tizim resurslarini kuzatish
htop
9. Yangilashlar
9.1. Kodni Yangilash
bash
CopyInsert
cd /opt/finco_telegram_bot
git pull
npm install
npm run build
pm2 restart finco-bot
Bu tartibda serverga joylashtirishni amalga oshirishingiz mumkin. Har bir qadamni diqqat bilan bajaring va xatolik bo'lsa, shu joyda to'xtab, muammoni hal qiling.