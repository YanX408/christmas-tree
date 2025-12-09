下载 Cloudflare Tunnel

登录 Cloudflare（免费账号即可）

执行：

```bash
cloudflared tunnel --url http://localhost:8080
```


它会给你一个类似这样的域名：

```bash
https://xxxxx.trycloudflare.com
```

## 自签名证书 + Nginx

1) 生成自签名证书（含 IP SAN，适用于 116.198.203.129）。
2) 配置 Nginx 监听 443，启用证书，反代到前端/后端。
3) 客户端信任证书（PC/手机各自导入并设为受信任）。
4) 测试 https://116.198.203.129/ 调用摄像头。

详细步骤

1) 生成证书（在服务器执行）

```bash
mkdir -p /opt/nginx/certs
cd /opt/nginx/certs

cat > san.cnf <<'EOF'
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
req_extensions     = req_ext
distinguished_name = dn

[dn]
C  = CN
ST = SelfSigned
L  = Local
O  = ChristmasTree
CN = 116.198.203.129

[req_ext]
subjectAltName = @alt_names

[alt_names]
IP.1 = 116.198.203.129
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key -out server.crt -config san.cnf
chmod 600 server.key
```


2客户端信任证书

- 把 /opt/nginx/certs/server.crt 下载到你的电脑/手机，导入到“受信任的根证书”或“用户证书”并信任。

- Chrome/Edge 在未信任时会显示“不安全”，需手动信任后再访问，摄像头才会放行。
- 访问测试

- 用 https://116.198.203.129/ 打开页面，地址栏显示已信任（或手动继续前往并信任证书）。

- 给摄像头权限，确认不再卡在 “System initializing…”，Hands Detected 能显示。

注意

- 自签名方案只适合内网/自用；外网用户要访问且无需导入证书，建议用正规域名 + Let’s Encrypt。

- 如果有客户端不支持 IP SAN，自签名请换成带域名的 SAN 并在 hosts 里指向该 IP，再签自签名证书。
