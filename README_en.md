<div align="center">

<br/>

<img src="front/public/dex.png" height="80" width="80" alt="DeEarthX Logo"/>

# DeEarthX V3

**Transform any Minecraft modpack into a ready-to-run server — in seconds.**

<br/>

[![Github release](https://img.shields.io/github/v/tag/Tianpao/DeEarthX?style=for-the-badge&logo=github&label=Release)](https://github.com/Tianpao/DeEarthX/releases)
[![GitHub](https://img.shields.io/github/license/Tianpao/DeEarthX?style=for-the-badge&color=blue)](https://github.com/Tianpao/DeEarthX/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/Tianpao/DeEarthX?style=for-the-badge&color=orange&label=Last%20Commit)](https://github.com/Tianpao/DeEarthX/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Tianpao/DeEarthX?style=for-the-badge&color=red)](https://github.com/Tianpao/DeEarthX/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Tianpao/DeEarthX?style=for-the-badge&color=green)](https://github.com/Tianpao/DeEarthX/pulls)

<br/>

<a href="https://qm.qq.com/q/7WI7AIL0Vq">
  <img src="front/public/QQ.png" height="16" width="16" alt="QQ"/>
  Join QQ Group
</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://www.bilibili.com/video/BV1CZffB9ErD/?share_source=copy_web&vd_source=93ac910240591935807ae1d3f37c9b79">
  <img src="front/public/bilibili.svg" height="16" width="16" alt="Bilibili"/>
  Watch Demo
</a>

<br/><br/>

</div>

---

> [!WARNING]
> Mod filtering may not be 100% accurate. Servers created with this tool **must not be sold**.

---

## What is DeEarthX?

DeEarthX V3 is a **Windows desktop application** that converts Minecraft client modpacks into fully functional server installations. Just drop your modpack file, pick a mode, and get a ready-to-run server — no manual configuration needed.

---

## Features

<table>
<tr>
<td width="50%">

### Modpack Support

| Format | Status |
|--------|--------|
| CurseForge | ✅ |
| Modrinth | ✅ |
| MCBBS | ✅ |
| MultiMC Pack | ❌ |

</td>
<td width="50%">

### Mod Loaders

| Loader | Status |
|--------|--------|
| Forge | ✅ |
| NeoForge | ✅ |
| Fabric | ✅ |
| Quilt | ❌ |

</td>
</tr>
</table>

### Smart Mod Filtering

Automatically distinguishes between **client-side** and **server-side** mods using a multi-strategy priority system:

| Priority | Strategy | Description |
|----------|----------|-------------|
| Highest | **Dexpub** (Galaxy Square) | Community-curated database — decides both client & server mods |
| High | **Hash + Modrinth** | Parallel hash matching & Modrinth API lookup |
| Medium | **Mcmod** | Queries mcmod.cn for mod classification |
| Low | **Mixin** | Fallback mixin config analysis for undecided mods |

> Higher-priority decisions **cannot be overridden** by lower-priority strategies.

### Working Modes

| Mode | Description |
|------|-------------|
| **Server Mode** | Full pipeline — downloads server jar, mod loader, and filters mods |
| **Upload Mode** | Mod filtering only — no server files downloaded |

### Mirror Acceleration

Built-in download mirrors for users in China:

- **BMCLAPI** — configurable (`on` / `off`)
- **MCIMirror** — configurable (`on` / `off` / `partial`)

### Multi-Language

| Language | Code |
|----------|------|
| 简体中文 | `zh-CN` |
| 繁體中文 (香港) | `zh-HK` |
| 繁體中文 (台灣) | `zh-TW` |
| English | `en-US` |

---

## How It Works

```
  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────────────┐
  │  Drop .zip  │────>│  Frontend    │────>│  Backend Pipeline (Dex.Main)        │
  │  or .mrpack │     │  (Vue 3)     │     │                                     │
  └─────────────┘     └──────┬───────┘     │  1. Extract modpack                 │
                             │ Socket.IO   │  2. Detect platform (CF/MR)         │
                             │             │  3. Unzip + Download mods (parallel) │
                             │             │  4. Run mod filter strategies        │
                             │             │  5. Install mod loader               │
                             │<────────────│  6. Done! (zip / open folder)        │
                             │  Progress    └─────────────────────────────────────┘
                             │  Updates
```

---

## Tech Stack

<table>
<tr>
<th>Backend</th>
<th>Frontend</th>
<th>Packaging</th>
</tr>
<tr>
<td>

- TypeScript
- Node.js (SEA → `core.exe`)
- Express
- Socket.IO
- yauzl (zip processing)
- p-map (concurrency)

</td>
<td>

- Vue 3 (Composition API)
- TypeScript
- Tauri 2
- Ant Design Vue
- Tailwind CSS
- Vue I18n

</td>
<td>

- Rollup (CJS bundle)
- Node.js SEA (Single Executable)

</td>
</tr>
</table>

---

## Installation

1. Download the latest installer from [Releases](https://github.com/Tianpao/DeEarthX/releases)
2. Run the installer
3. Launch DeEarthX — that's it!

> **Tip:** Avoid installing to `C:\` to prevent permission issues.

---

## System Requirements

| Requirement | Server Mode | Upload Mode |
|-------------|:-----------:|:-----------:|
| Windows OS | ✅ | ✅ |
| Java Runtime | ✅ | ❌ |

**Supported Minecraft versions:** 1.16.5 → Latest

---

## Development

```bash
# Install all dependencies
pnpm install

# Type-check everything
cd backend && pnpm exec tsc --noEmit && cd ../front && pnpm exec vue-tsc --noEmit

# Run backend in dev mode
cd backend && pnpm run test

# Run frontend dev server (port 9888)
cd front && pnpm run dev

# Tauri dev (Vite + Tauri window)
cd front && pnpm run tauri-dev

# Full production build
pnpm run build
```

---

## Team

<table>
<tr>
<td align="center" width="50%">
  <img src="front/public/tianpao.jpg" width="80" height="80" style="border-radius:50%" alt="Tianpao"/><br/>
  <b>Tianpao</b><br/>
  <sub>Core Development</sub>
</td>
<td align="center" width="50%">
  <img src="front/public/xcc.jpg" width="80" height="80" style="border-radius:50%" alt="XCC"/><br/>
  <b>XCC</b><br/>
  <sub>Feature Optimization</sub>
</td>
</tr>
</table>

---

## ⭐ Star History

<a href="https://www.star-history.com/?repos=Tianpao%2FDeEarthX&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&legend=top-left" width="100%" />
 </picture>
</a>

---

<div align="center">

**DeEarthX V3** — Made with love by the DeEarthX Team

</div>
