# 🔒 Security Hardening Guide - BaaS Dashboard

## Threat Model

When running a dashboard on a VPS, the real threats are:

| Threat | Description |
|--------|-------------|
| **Internet-wide scanning** | Bots scan the entire internet 24/7 |
| **Shodan exposure** | Open ports are indexed and searchable |
| **SSH brute force** | Constant attempts with common usernames |
| **Token leakage** | URLs in history, logs, screenshots, clipboard |
| **Origin bypass** | Attackers hit VPS IP directly, bypassing CDN |
| **Dependency vulns** | Today's safe code becomes tomorrow's RCE |
| **Session replay** | Attacker tries again from another device |

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE ACCESS                             │
│                   (Identity Gate)                               │
│  • Email/GitHub/Google authentication                          │
│  • MFA enforcement                                              │
│  • Geo-blocking                                                 │
│  • No traffic reaches VPS without identity                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE TUNNEL                             │
│                   (Secure Connectivity)                         │
│  • Outbound-only connection from VPS                           │
│  • No inbound ports needed                                      │
│  • TLS/HTTPS handled by Cloudflare                             │
│  • WebSocket support                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        VPS                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UFW Firewall (SSH only)                                 │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  Fail2ban (auto-ban brute force)                   │  │  │
│  │  │  ┌──────────────────────────────────────────────┐  │  │  │
│  │  │  │  Dashboard (127.0.0.1:18789)                 │  │  │  │
│  │  │  │  • Token authentication                       │  │  │  │
│  │  │  │  • Device pairing                             │  │  │  │
│  │  │  └──────────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Defense in Depth Layers

| Layer | Component | Purpose |
|-------|-----------|---------|
| 1 | Cloudflare Access | Identity verification before any traffic |
| 2 | Cloudflare Tunnel | No exposed ports, outbound-only |
| 3 | UFW Firewall | Only SSH allowed inbound |
| 4 | Fail2ban | Auto-ban brute force attempts |
| 5 | Dashboard Token | Secret authentication |
| 6 | Device Pairing | Per-device trust |

---

## Setup Guide

### 1. Cloudflare Tunnel Setup

#### Install cloudflared
```bash
# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
```

#### Authenticate
```bash
cloudflared tunnel login
# Opens browser, creates ~/.cloudflared/cert.pem
```

#### Create tunnel
```bash
cloudflared tunnel create clawdbot
# Creates ~/.cloudflared/<UUID>.json
```

#### Configure tunnel
```bash
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: clawdbot
credentials-file: /root/.cloudflared/<UUID>.json

ingress:
  - hostname: dashboard.yourdomain.com
    service: http://127.0.0.1:18789
  - service: http_status:404
EOF
```

#### Create DNS route
```bash
cloudflared tunnel route dns clawdbot dashboard.yourdomain.com
```

#### Install as service
```bash
sudo cloudflared --config ~/.cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

---

### 2. Cloudflare Access (Zero Trust)

> ⚠️ **Critical**: Tunnel is connectivity, Access is authentication.

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add Application → Self-hosted
3. Configure:
   - **Domain**: `dashboard.yourdomain.com`
   - **Policy**: Allow specific emails (e.g., `you@gmail.com`)
   - **Require MFA**: Recommended
   - **Fallback**: Deny all

#### Recommended policies:
```
ALLOW: your@email.com (with MFA)
ALLOW: GitHub org members (optional)
DENY: Everyone else
```

#### Geo-blocking (optional):
```
ALLOW: Your country (BR, US, etc.)
DENY: All other countries
```

---

### 3. SSH Hardening

#### Create deploy user (recommended)
```bash
# Create user
sudo adduser deploy
sudo usermod -aG sudo deploy

# Copy SSH keys
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

#### Harden SSH config
```bash
sudo nano /etc/ssh/sshd_config
```

Set:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
```

Restart:
```bash
sudo systemctl restart ssh
# KEEP CURRENT SESSION OPEN until you verify new login works!
```

---

### 4. Firewall (UFW)

```bash
# Enable with SSH
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status

# Optional: Restrict SSH to your IP
sudo ufw allow from YOUR.IP.ADDRESS to any port 22 proto tcp
sudo ufw delete allow OpenSSH
```

---

### 5. Fail2ban

```bash
# Install
sudo apt update && sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban

# Check status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

---

### 6. Dashboard Configuration

Ensure dashboard binds to localhost only:
```json
{
  "dashboard": {
    "host": "127.0.0.1",
    "port": 18789
  }
}
```

Enable pairing:
```json
{
  "pairing": {
    "enabled": true,
    "requireApproval": true
  }
}
```

---

## Security Checklist

### Infrastructure
- [ ] Dashboard port NOT reachable on VPS IP (test with `curl http://YOUR_VPS_IP:18789`)
- [ ] Dashboard listens on 127.0.0.1 only
- [ ] Cloudflare Tunnel active and routing correctly
- [ ] cloudflared running as systemd service

### Authentication
- [ ] Cloudflare Access enabled with strict policy
- [ ] MFA required for Access
- [ ] Dashboard token is strong (32+ chars)
- [ ] Pairing enabled and approved devices only

### SSH
- [ ] PermitRootLogin no
- [ ] PasswordAuthentication no
- [ ] PubkeyAuthentication yes
- [ ] Using non-root user with sudo

### Firewall
- [ ] UFW enabled
- [ ] Only SSH allowed inbound
- [ ] No dashboard ports exposed
- [ ] fail2ban running

### Maintenance
- [ ] System packages updated (`apt upgrade`)
- [ ] cloudflared updated
- [ ] Clawdbot updated
- [ ] Logs monitored

---

## Troubleshooting

### "502 Bad Gateway" from Cloudflare
- Dashboard not running
- Dashboard not on localhost:18789
- Check: `ss -tlnp | grep 18789`

### "1008 pairing required"
- Expected behavior for new origins
- Approve device from CLI or trusted channel
- Each hostname is a unique device identity

### Can't SSH after hardening
- Keep original session open during changes
- Use VPS console (DigitalOcean/AWS) as backup
- Check `/var/log/auth.log`

---

## Current Status (this VPS)

| Component | Status | Notes |
|-----------|--------|-------|
| SSH Keys Only | ✅ | PasswordAuthentication no |
| Root Login | ⚠️ | prohibit-password (should be no) |
| UFW | ✅ | Active, SSH only |
| Fail2ban | ✅ | 1,166 IPs banned |
| Cloudflared | ✅ | Service running |
| Dashboard Localhost | ✅ | 127.0.0.1:18789 |
| Cloudflare Access | ❓ | Verify in Zero Trust dashboard |

### Pending Actions
1. Create `deploy` user
2. Set `PermitRootLogin no`
3. Verify Cloudflare Access policies
