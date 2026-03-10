---
date: 2026-03-10T00:00:00+00:00
researcher: claude-sonnet-4-6
topic: "Self-Hosting a VPN on Vercel: GitHub Projects and Feasibility"
tags: [research, web-analysis, vpn, vercel, self-hosted, proxy, wireguard, vless]
status: complete
created_at: 2026-03-10
confidence: high
sources_count: 22
---

# Web Research: Self-Hosting a VPN on Vercel

**Date**: 2026-03-10
**Topic**: Self-hosting a VPN through Vercel — what GitHub projects can help?
**Confidence**: High — findings are consistent across official docs, community reports, and code inspection

## Research Question

"If I want to self-host my own VPN through Vercel, what GitHub projects can help me do so?"

## Executive Summary

Running a true self-hosted VPN on Vercel is architecturally impossible. Vercel's serverless model — stateless functions, no raw TCP/UDP sockets, no persistent processes, and no kernel networking access — is fundamentally incompatible with every known VPN protocol (WireGuard, OpenVPN, IKEv2) and most proxy protocols that require persistent connections (SOCKS5, VLESS-WS-TLS). Additionally, using Vercel as a general-purpose traffic proxy violates Vercel's Acceptable Use Policy and accounts have been suspended for it.

The closest viable architecture: **run your actual VPN/proxy on a $3–6/month VPS** (WireGuard or Xray-core), and optionally deploy a subscription manager like `sublink-worker` on Vercel. If you want a free serverless proxy node, **Cloudflare Workers** (not Vercel) is the right platform — `zizifn/edgetunnel` is the gold standard there.

---

## Why True VPNs Cannot Run on Vercel

| Blocker | Detail |
|--------|--------|
| No raw TCP/UDP sockets | WireGuard needs UDP; OpenVPN needs OS-level socket binding — neither is available in Vercel's Node.js or Edge runtimes |
| No persistent connections | Functions time out (max 300s on Pro plan); a VPN session that lives hours cannot survive |
| No kernel networking | VPNs create virtual interfaces (`wg0`) and modify IP routing — requires root + kernel module access |
| ToS violation | Vercel AUP prohibits using the platform as a general proxy/VPN; accounts have been suspended |
| WebSocket limitations | Native WebSocket support in Next.js App Router is still experimental as of early 2026 |

---

## GitHub Projects — Full Inventory

### Projects That Actually Run on Vercel (but are NOT VPNs)

#### 1. `sublink-worker` — Subscription Manager
- **GitHub**: https://github.com/7Sageer/sublink-worker
- **Stars**: 4,200+ | **Status**: Actively maintained (v2.3.1, Feb 2026)
- **What it does**: Converts and manages proxy subscription links (VLESS, VMess, Shadowsocks, Trojan, Hysteria2, TUIC) — NOT a proxy itself
- **Vercel role**: Hosts the management UI and subscription API; proxy nodes must be hosted elsewhere
- **Deploy**: One-click Vercel button; requires Vercel KV
- **Best use**: Manage and distribute your VPS-hosted proxy configurations to clients (V2RayN, Clash, Sing-Box)

#### 2. `vercel-reverse-proxy` (multiple forks)
- **GitHub**: https://github.com/find-xposed-magisk/vercel-reverse-proxy (26 stars)
- **Also**: `souying/vercel-api-proxy`, `ytanck/vercel-reverse-proxy`, `Kyle-Mao/vercel-vpn3`
- **What it does**: Vercel functions relay individual HTTP/HTTPS requests to a target URL
- **Limitation**: HTTP only — no tunneling, no encryption, no OS-level traffic routing
- **Risk**: Accounts banned for proxy abuse; `vercel.app` subdomain often blocked in restricted regions

#### 3. `subconverter-vercel` (Nomamuk)
- **GitHub**: https://github.com/Nomamuk/subconverter-vercel (44 stars, 59 forks)
- **Based on**: https://github.com/tindy2013/subconverter (12,300 stars)
- **What it does**: Deploys the `subconverter` binary to Vercel as a subscription format converter
- **Status**: Stale since Sept 2022 — may be broken on current Vercel runtimes

#### 4. `vercel-holesail-proxy` (oren-z0)
- **GitHub**: https://github.com/oren-z0/vercel-holesail-proxy (3 stars)
- **Protocol**: Holesail (P2P DHT-based TCP/UDP tunnel via HyperDHT/Hypercore)
- **What it does**: Bridges HTTP to Holesail's P2P network; Vercel acts as a relay endpoint
- **Status**: Created Dec 2024, minimal activity — experimental/proof-of-concept
- **Limitation**: Not suitable for routing all OS traffic; Vercel timeout constraints still apply

#### 5. `proxyscotch-vercel` (SunsetMkt)
- **GitHub**: https://github.com/SunsetMkt/proxyscotch-vercel
- **What it does**: CORS-bypassing HTTP proxy for the Hoppscotch API testing tool
- **Use case**: API development only, not general VPN

### Projects That CLAIM Vercel But Don't Actually Work There

| Project | Protocol | Why It Fails on Vercel |
|---------|---------|----------------------|
| `rootmelo92118/vercel-v2ray` | V2Ray VMess | 2020 experiment, no real implementation |
| `uz0w/vercel-v2ray` | V2Ray VMess | Same — abandoned Oct 2020 |
| `unturbul/vercel_xray` | Xray VLESS/VMess | Requires persistent Nginx process — actually targets CodeSandbox |
| `MTDickens/v2ray_vercel` | V2Ray | 2020 experiment, no functional code |

### Cloudflare Workers Projects (NOT Vercel, but often confused)

These are the **actually working** serverless proxy solutions — they require Cloudflare Workers, which has native WebSocket/Durable Objects support that Vercel lacks:

| Project | Stars | Protocol | Platform |
|---------|-------|---------|---------|
| [zizifn/edgetunnel](https://github.com/zizifn/edgetunnel) | 8,000+ | VLESS over WebSocket+TLS | Cloudflare Workers only |
| [V2RaySSR/Free-VLESS](https://github.com/V2RaySSR/Free-VLESS) | 513 | VLESS | Cloudflare Workers only |
| [amiremohamadi/tunl](https://github.com/amiremohamadi/tunl) | 51 | V2Ray (Rust) | Cloudflare Workers only |

---

## What Actually Works: Recommended Architectures

### Option A: VPS + Xray + Vercel Management (Best Overall)

```
Client (V2RayN/Clash/Sing-Box)
  └─ Pulls config from Vercel (sublink-worker) ──> Your VPS running Xray-core
                                                    (VLESS/VMess/Trojan over WS+TLS)
```

- **VPS**: Oracle Cloud (free tier), Hetzner ($3.5/mo), DigitalOcean ($6/mo)
- **Proxy server**: [Xray-core](https://github.com/XTLS/Xray-core) (35,698 stars, Go, actively maintained)
- **Management UI**: [3x-ui panel](https://github.com/MHSanaei/3x-ui) on VPS — or `sublink-worker` on Vercel
- **Vercel role**: Optional subscription management only

### Option B: WireGuard on VPS (Simplest True VPN)

```
Client (WireGuard app) ──> Your VPS running WireGuard
```

- No Vercel involved — WireGuard is a kernel module, not deployable to serverless
- Guides: [WireGuard Quick Start](https://www.wireguard.com/quickstart/), [wg-easy](https://github.com/wg-easy/wg-easy) (17,000+ stars) for a web UI

### Option C: Cloudflare Workers (Free, No VPS Needed)

```
Client ──> Cloudflare Workers (zizifn/edgetunnel) ──> Target destination
```

- Free up to Cloudflare's generous limits
- **Not Vercel**, but functionally similar and actually works
- Deploy: https://github.com/zizifn/edgetunnel

---

## Trade-off Analysis

### Vercel-only Approach
| Factor | Impact | Notes |
|--------|--------|-------|
| Feasibility | ❌ Impossible for real VPN | Architecture prevents it |
| Cost | Free tier available | Irrelevant since it doesn't work |
| ToS risk | High | Accounts suspended for proxy abuse |
| Latency | High (double hop) | Even for HTTP relay use cases |

### VPS + Xray
| Factor | Impact | Notes |
|--------|--------|-------|
| Feasibility | ✅ Full VPN/proxy | Routes all traffic |
| Cost | $3–6/month | Hetzner/Oracle Cloud |
| Control | Full | Your server, your rules |
| Latency | Low | Single hop |
| Maintenance | Medium | Requires server management |

### Cloudflare Workers (edgetunnel)
| Factor | Impact | Notes |
|--------|--------|-------|
| Feasibility | ✅ Works well for proxy | VLESS over WS+TLS |
| Cost | Free (100k req/day) | Cloudflare free tier |
| Control | Medium | Cloudflare ToS applies |
| Latency | Very low | 200+ global PoPs |
| Maintenance | Minimal | Serverless |

---

## Recommendations

1. **If you want free + serverless**: Use Cloudflare Workers with [zizifn/edgetunnel](https://github.com/zizifn/edgetunnel). This is the closest to what you're asking for — but it's Cloudflare, not Vercel.

2. **If you want true self-hosted VPN**: Rent a VPS ($3–6/month), deploy WireGuard or Xray-core, and you'll have a real VPN you fully control. Optional: use [sublink-worker](https://github.com/7Sageer/sublink-worker) on Vercel to manage subscription configs.

3. **Do not attempt to use Vercel as the proxy/VPN node**: It violates ToS, accounts get suspended, and it technically can't support VPN protocols anyway.

---

## Risk Assessment

### High Priority
- **ToS violation**: Using Vercel as a proxy/VPN relay violates the AUP — accounts have been suspended. Only use Vercel for legitimate subscription management, not as a traffic relay.

### Medium Priority
- **Cloudflare ToS**: Same concern applies to edgetunnel on Cloudflare; they also prohibit proxying all traffic through Workers in some configurations. Self-assessment of use case is needed.

---

## Sources

### Official Documentation
- [Vercel Function Limitations](https://vercel.com/docs/functions/limitations) — Vercel, 2026
- [Vercel Edge Middleware Limitations](https://vercel.com/docs/edge-middleware/limitations) — Vercel, 2026
- [Vercel Acceptable Use Policy](https://vercel.com/legal/acceptable-use-policy) — Vercel, 2026
- [Vercel WebSocket Support KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) — Vercel, 2026

### Key GitHub Projects
- [sublink-worker](https://github.com/7Sageer/sublink-worker) — 7Sageer, v2.3.1 Feb 2026
- [subconverter](https://github.com/tindy2013/subconverter) — tindy2013, 12,300 stars
- [zizifn/edgetunnel](https://github.com/zizifn/edgetunnel) — zizifn, 8,000+ stars
- [Xray-core](https://github.com/XTLS/Xray-core) — XTLS, 35,698 stars
- [wg-easy](https://github.com/wg-easy/wg-easy) — WeeJeWel, 17,000+ stars
- [holesail](https://github.com/holesail/holesail) — holesail, 231 stars
- [vercel-holesail-proxy](https://github.com/oren-z0/vercel-holesail-proxy) — oren-z0, Dec 2024

### Community References
- [Vercel Community: TCP/UDP Support](https://community.vercel.com/t/does-vercel-support-non-tls-tcp-and-udp-servers/14786)
- [Rivet: WebSocket on Vercel deep-dive](https://rivet.gg/blog/2025-10-20-how-we-built-websocket-servers-for-vercel-functions/)

---

**Last Updated**: 2026-03-10
**Confidence Level**: High — based on official Vercel documentation + consistent community reports + direct code inspection of all listed repositories
**Next Steps**: If pursuing self-hosted VPN, choose between Cloudflare Workers (free, no VPS) or VPS + Xray/WireGuard (full control, $3–6/mo)
