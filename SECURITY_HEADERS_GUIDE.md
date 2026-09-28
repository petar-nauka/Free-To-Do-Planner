# 🛡️ Security Headers за вашия web server

> Тези HTTP headers трябва да бъдат добавени към вашия nginx/caddy/apache config за пълна защита. Те допълват `<meta>` CSP-то в `index.html`.

## Защо HTTP headers, а не само `<meta>`?

Някои директиви на CSP (като `frame-ancestors`) се игнорират когато са в `<meta>` таг — браузърите ги приемат само като HTTP headers. Освен това headers се прилагат и за статични файлове (CSS, JS), не само за HTML страницата.

---

## ⚙️ Nginx конфигурация

Добавете в server блока (където хоствате frontend-а):

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # ... вашите ssl_* настройки ...

    # ════════════════════════════════════════════════
    # SECURITY HEADERS
    # ════════════════════════════════════════════════

    # Принуждава винаги HTTPS (1 година + subdomains + preload list)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Защита срещу clickjacking (други сайтове не могат да embedd-ват вашия)
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "frame-ancestors 'none'" always;

    # MIME sniffing защита
    add_header X-Content-Type-Options "nosniff" always;

    # Referrer policy - не изтича пълни URLs към external сайтове
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Permissions Policy - блокира опасни browser APIs
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;

    # Cross-Origin защита (защитава от XS-Leaks)
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-site" always;

    # Премахва Server header (не разкривайте версията на nginx)
    server_tokens off;

    location / {
        # ... вашия root / proxy_pass ...
    }
}
```

---

## ⚙️ Caddy конфигурация

```caddy
your-domain.com {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        Content-Security-Policy "frame-ancestors 'none'"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Resource-Policy "same-site"
        -Server
    }

    # ... вашите routes ...
}
```

---

## ⚙️ Apache конфигурация (.htaccess или vhost)

```apache
<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
    Header always set X-Frame-Options "DENY"
    Header always set Content-Security-Policy "frame-ancestors 'none'"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Resource-Policy "same-site"
    Header always unset Server
</IfModule>
```

---

## 🧪 Как да тествате?

След като добавите конфигурацията:

```bash
# Презаредете nginx
sudo nginx -t && sudo systemctl reload nginx

# Проверете headers с curl
curl -I https://your-domain.com
```

Или използвайте онлайн скенери:
- https://securityheaders.com  (цел: A+ оценка)
- https://observatory.mozilla.org

---

## 📋 Очаквана оценка

След прилагане трябва да получите:
- **SecurityHeaders.com**: A или A+ (преди беше D-F)
- **Mozilla Observatory**: B+ или A
- **SSL Labs**: A или A+

---

## ⚠️ Бележки

1. **HSTS preload** — ако планирате да включите домейна в HSTS preload list, първо тествайте `max-age=300` няколко дни, после увеличете до 1 година.

2. **CSP unsafe-inline / unsafe-eval** — Vite в production вече не се нуждае от тях. След build може да премахнете двата директива от `index.html` мета тага за по-строга защита.

3. **WebSocket connections** — ако Supabase Realtime не работи, добавете в CSP: `connect-src 'self' https: wss://your-supabase.example.com`.

4. **Self-hosted Supabase URL** — заместете `https:` в connect-src с конкретния домейн за максимална защита:
   ```
   connect-src 'self' https://your-supabase.example.com wss://your-supabase.example.com;
   ```

---

**Версия:** 1.0
**Дата:** Февруари 2026
