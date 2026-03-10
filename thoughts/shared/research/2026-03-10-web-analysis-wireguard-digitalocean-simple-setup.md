---
date: 2026-03-10T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Simplest WireGuard VPN on DigitalOcean"
tags: [research, web-analysis, wireguard, digitalocean, wg-easy, vpn, self-hosted]
status: complete
created_at: 2026-03-10
confidence: high
sources_count: 22
---

# Web Research: Simplest WireGuard VPN on DigitalOcean

**Date**: 2026-03-10
**Topic**: What is the simplest setup + maintenance path for self-hosted WireGuard on DigitalOcean?
**Confidence**: High

## Executive Summary

**Use [wg-easy](https://github.com/wg-easy/wg-easy) (24.9K stars) on a $6/month DigitalOcean droplet.** Setup takes ~10 minutes, 8 commands total. You get a web UI to add/remove clients with QR codes — no CLI needed after initial setup. Ongoing maintenance is essentially zero: Watchtower auto-updates the Docker container, `unattended-upgrades` handles OS patches.

## The Setup (8 commands, ~10 minutes)

### 1. Create DigitalOcean Droplet
- **Size**: $6/month (1 vCPU, 1 GB RAM, 25 GB SSD)
- **OS**: Ubuntu 24.04 LTS
- **Region**: Closest to you (e.g., `sfo3`, `lon1`, `sgp1`)
- **Firewall** (in DO console): Allow UDP 51820 from anywhere, TCP 51821 from your home IP only, TCP 22 from anywhere

### 2. SSH In and Run

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Enable unattended security updates
sudo apt install unattended-upgrades -y
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Create wg-easy directory
sudo mkdir -p /etc/docker/containers/wg-easy

# Download official docker-compose.yml
sudo curl -o /etc/docker/containers/wg-easy/docker-compose.yml \
  https://raw.githubusercontent.com/wg-easy/wg-easy/master/docker-compose.yml

# Edit: set WG_HOST=YOUR_DROPLET_IP and INSECURE=true
sudo nano /etc/docker/containers/wg-easy/docker-compose.yml

# Open firewall ports
sudo ufw allow 22/tcp && sudo ufw allow 51820/udp && sudo ufw allow 51821/tcp && sudo ufw enable

# Start wg-easy
cd /etc/docker/containers/wg-easy && sudo docker compose up -d
```

### 3. Use It
- Visit `http://YOUR_DROPLET_IP:51821`
- Create admin account
- Click "New Client" → scan QR code on phone → connected

## Zero-Maintenance Setup

### Auto-update Docker container (Watchtower)

Add to a `watchtower-compose.yml` alongside wg-easy:

```yaml
services:
  watchtower:
    image: nickfedor/watchtower:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_SCHEDULE=0 0 4 * * *
    restart: unless-stopped
```

Checks daily at 4 AM, auto-pulls and restarts wg-easy if a new version is available.

### Auto-update OS
`unattended-upgrades` (installed above) handles security patches automatically. WireGuard is built into the Linux kernel since 5.6 — kernel updates come through `apt`.

### Backups
wg-easy v15 stores all state in SQLite. One simple cron backup:
```bash
0 3 * * * tar czf /root/wg-easy-backup-$(date +\%Y\%m\%d).tar.gz /etc/docker/containers/wg-easy/
```

## What Requires Manual Intervention

| Scenario | Frequency | What to do |
|----------|-----------|------------|
| Major version upgrade (e.g., v15→v16) | Once every few years | Export configs, fresh deploy, import |
| Droplet IP changes | Never (static on DO) | N/A |
| Certificate renewal | Never (no TLS by default) | N/A |

## Comparison with Alternatives

| Tool | Setup | Web UI | Maintenance | Stars | Verdict |
|------|-------|--------|-------------|-------|---------|
| **wg-easy** | ~8 commands | Full (QR codes, stats) | Near-zero | 24.9K | **Best overall** |
| WGDashboard (DO 1-click) | 1 click + config | Good | Low | Less | Simplest initial deploy |
| PiVPN | 1 script | None (CLI only) | Low | 10K | No web UI |
| Firezone v2 | Many steps + domain + DB | Enterprise | Medium | 7K | Too complex |
| Netbird | Medium (needs domain) | Yes | Medium | 11K | Overkill |
| Tailscale | 1 cmd per device | Cloud | Zero | - | Not self-hosted |

## Key Gotchas

1. **`WG_HOST` must be your droplet's public IP** — not Docker bridge IP. Most common setup mistake.
2. **v15 requires `INSECURE=true`** for HTTP web UI access (security default change).
3. **v15 requires `/lib/modules` volume mount** — included in the official docker-compose.yml, but some old guides miss it.
4. **DO Cloud Firewall is separate from UFW** — configure both, or only use one.

## Cost Summary

| Item | Monthly Cost |
|------|-------------|
| DigitalOcean droplet (1GB) | $6.00 |
| Automated backups (optional) | $1.20 |
| **Total** | **$6.00–$7.20** |

## Sources

- [wg-easy GitHub](https://github.com/wg-easy/wg-easy) — 24.9K stars, v15.2.2, last push March 9, 2026
- [wg-easy official docs](https://wg-easy.github.io/wg-easy/latest/)
- [wg-easy auto-updates guide](https://wg-easy.github.io/wg-easy/latest/examples/tutorials/auto-updates/)
- [wg-easy basic install guide](https://wg-easy.github.io/wg-easy/v15.2/examples/tutorials/basic-installation/)
- [DO WGDashboard 1-click](https://marketplace.digitalocean.com/apps/wgdashboard)
- [wg-easy v15 announcement](https://github.com/wg-easy/wg-easy/discussions/1887)
- [Unattended upgrades guide (Mar 2026)](https://oneuptime.com/blog/post/2026-03-02-configure-unattended-upgrades-security-patches-ubuntu/)

---

**Last Updated**: 2026-03-10
**Confidence Level**: High
**Next Steps**: Create DO droplet, run the 8 commands, connect devices via QR code
