#!/usr/bin/env bash
# تثبيت «عَقد» على خادم Ubuntu (22.04 / 24.04، معالج ARM أو x86) بأمر واحد:
#   curl -fsSL https://raw.githubusercontent.com/falofoc/Aqd/ccr-b6af62a2-hn8lby/deploy/install.sh | sudo bash
# أو مع نطاقك الخاص:
#   curl -fsSL .../install.sh | sudo DOMAIN=sign.example.com bash
#
# ينصّب: Node.js 22 + خدمة systemd + Caddy (شهادة HTTPS مجانية تلقائياً) + نسخ احتياطي يومي.
# بدون نطاق يُستخدم عنوان مجاني من sslip.io مبني على IP الخادم.
set -euo pipefail

REPO="${REPO:-https://github.com/falofoc/Aqd.git}"
BRANCH="${BRANCH:-ccr-b6af62a2-hn8lby}"
APP_DIR=/opt/aqd
DATA_DIR=/var/lib/aqd
BACKUP_DIR=/var/backups/aqd

[ "$(id -u)" -eq 0 ] || { echo "شغّل السكربت بصلاحية root (sudo)"; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> تحديث النظام وتثبيت الأدوات"
apt-get update -y
apt-get install -y curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https iptables-persistent

if [ -z "${DOMAIN:-}" ]; then
  IP="$(curl -fsS4 https://api.ipify.org)"
  DOMAIN="${IP}.sslip.io"
fi
echo "==> العنوان: https://${DOMAIN}"

echo "==> تثبيت Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> تثبيت Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> تنزيل التطبيق"
id aqd >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin aqd
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
fi
mkdir -p "$DATA_DIR" "$BACKUP_DIR"
chown -R aqd:aqd "$DATA_DIR"
chmod 700 "$DATA_DIR" "$BACKUP_DIR"

echo "==> إنشاء خدمة systemd"
cat > /etc/systemd/system/aqd.service <<EOF
[Unit]
Description=Aqd contract signing
After=network.target

[Service]
User=aqd
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=DATA_DIR=$DATA_DIR
Environment=BASE_URL=https://$DOMAIN
Environment=TRUST_PROXY=1
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now aqd
systemctl restart aqd

echo "==> إعداد HTTPS عبر Caddy"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
EOF
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

echo "==> فتح المنافذ 80 و 443 في جدار الحماية"
# صور Ubuntu في Oracle Cloud تغلق كل المنافذ عدا 22 عبر iptables.
for port in 80 443; do
  iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport "$port" -j ACCEPT
done
netfilter-persistent save >/dev/null 2>&1 || true
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80,443/tcp; fi

echo "==> نسخ احتياطي يومي (يُحتفظ بآخر 30 نسخة)"
cat > /etc/cron.daily/aqd-backup <<EOF
#!/bin/sh
tar -czf $BACKUP_DIR/aqd-\$(date +%F).tar.gz -C $DATA_DIR .
ls -1t $BACKUP_DIR/aqd-*.tar.gz | tail -n +31 | xargs -r rm -f
EOF
chmod +x /etc/cron.daily/aqd-backup

echo "==> أمر التحديث: aqd-update"
cat > /usr/local/bin/aqd-update <<EOF
#!/bin/sh
set -e
git -C $APP_DIR fetch origin $BRANCH
git -C $APP_DIR reset --hard origin/$BRANCH
systemctl restart aqd
echo "تم التحديث"
EOF
chmod +x /usr/local/bin/aqd-update

sleep 2
if curl -fsS http://127.0.0.1:3000/healthz >/dev/null; then
  echo
  echo "✅ تم التثبيت بنجاح"
  echo "   الرابط:  https://$DOMAIN"
  echo "   السجلات: journalctl -u aqd -f"
  echo "   التحديث: sudo aqd-update"
  echo "   البيانات: $DATA_DIR   النسخ الاحتياطية: $BACKUP_DIR"
  echo
  echo "⚠️  تذكّر فتح المنفذين 80 و 443 في Security List الخاصة بالشبكة من لوحة Oracle."
else
  echo "❌ التطبيق لم يعمل. راجع: journalctl -u aqd -n 50"
  exit 1
fi
