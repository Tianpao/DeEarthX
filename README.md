<div align="center">

<br/>

<img src="front/public/dex.png" height="80" width="80" alt="DeEarthX Logo"/>

# DeEarthX V3

**一键将 Minecraft 整合包转换为可运行的服务端**

[English](README_en.md) | 简体中文

<br/>

[![Github release](https://img.shields.io/github/v/tag/Tianpao/DeEarthX?style=for-the-badge&logo=github&label=Release)](https://github.com/Tianpao/DeEarthX/releases)
[![GitHub](https://img.shields.io/github/license/Tianpao/DeEarthX?style=for-the-badge&color=blue)](https://github.com/Tianpao/DeEarthX/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/Tianpao/DeEarthX?style=for-the-badge&color=orange&label=Last%20Commit)](https://github.com/Tianpao/DeEarthX/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Tianpao/DeEarthX?style=for-the-badge&color=red)](https://github.com/Tianpao/DeEarthX/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Tianpao/DeEarthX?style=for-the-badge&color=green)](https://github.com/Tianpao/DeEarthX/pulls)

<br/>

<a href="https://qm.qq.com/q/7WI7AIL0Vq">
  <img src="front/public/QQ.png" height="16" width="16" alt="QQ"/>
  加入Q群
</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://www.bilibili.com/video/BV1CZffB9ErD/?share_source=copy_web&vd_source=93ac910240591935807ae1d3f37c9b79">
  <img src="front/public/bilibili.svg" height="16" width="16" alt="Bilibili"/>
  宣传片
</a>

<br/><br/>

</div>

---

> [!WARNING]
> 模组可能过滤不干净，且制作的服务端**禁止用于售卖**！

---

## 项目概述

DeEarthX V3 是一个 **Windows 桌面应用**，帮你快速把客户端整合包转换成可运行的服务端。拖入整合包文件，选择模式，即可获得开箱即用的服务端——无需手动配置。

---

## 核心功能

<table>
<tr>
<td width="50%">

### 整合包支持

| 格式 | 状态 |
|------|------|
| CurseForge | ✅ |
| Modrinth | ✅ |
| MCBBS | ✅ |
| MultiMC Pack | ❌ |

</td>
<td width="50%">

### 模组加载器

| 加载器 | 状态 |
|--------|------|
| Forge | ✅ |
| NeoForge | ✅ |
| Fabric | ✅ |
| Quilt | ❌ |

</td>
</tr>
</table>

### 智能模组过滤

自动区分**客户端**和**服务端**模组，采用多策略优先级系统：

| 优先级 | 策略 | 说明 |
|--------|------|------|
| 最高 | **Dexpub**（Galaxy Square） | 社区维护数据库，同时判定客户端与服务端模组 |
| 高 | **Hash + Modrinth** | 并行哈希匹配与 Modrinth API 查询 |
| 中 | **Mcmod** | 查询 mcmod.cn 获取模组分类 |
| 低 | **Mixin** | 对未判定模组进行 Mixin 配置分析 |

> 高优先级策略的判定结果**不可被低优先级策略覆盖**。

### 工作模式

| 模式 | 说明 |
|------|------|
| **开服模式** | 完整流程——下载服务端 jar、模组加载器，并过滤模组 |
| **上传模式** | 仅模组过滤——不下载服务端文件 |

### 镜像加速

内置国内下载镜像：

- **BMCLAPI** — 可配置（`on` / `off`）
- **MCIMirror** — 可配置（`on` / `off` / `partial`）

### 多语言

| 语言 | 代码 |
|------|------|
| 简体中文 | `zh-CN` |
| 繁體中文 (香港) | `zh-HK` |
| 繁體中文 (台灣) | `zh-TW` |
| English | `en-US` |

---

## 工作流程

```
  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────────────────────┐
  │  拖入 .zip  │────>│   前端       │────>│  后端处理管线 (Dex.Main)            │
  │  或 .mrpack │     │  (Vue 3)     │     │                                     │
  └─────────────┘     └──────┬───────┘     │  1. 解压整合包                      │
                             │ Socket.IO   │  2. 识别平台 (CF/MR)                │
                             │             │  3. 并行：解压 + 下载模组            │
                             │             │  4. 运行模组过滤策略                 │
                             │             │  5. 安装模组加载器                   │
                             │<────────────│  6. 完成！（打包 / 打开文件夹）      │
                             │  实时进度     └─────────────────────────────────────┘
                             │  更新
```

---

## 技术架构

<table>
<tr>
<th>后端</th>
<th>前端</th>
<th>打包</th>
</tr>
<tr>
<td>

- TypeScript
- Node.js (SEA → `core.exe`)
- Express
- Socket.IO
- yauzl（zip 处理）
- p-map（并发控制）

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

- Rollup（CJS 打包）
- Node.js SEA（单文件可执行）

</td>
</tr>
</table>

---

## 安装说明

1. 从 [Releases](https://github.com/Tianpao/DeEarthX/releases) 下载最新安装包
2. 运行安装程序
3. 启动 DeEarthX——即可使用

> **提示：** 建议不要安装在 C 盘，避免权限问题。

---

## 系统要求

| 要求 | 开服模式 | 上传模式 |
|------|:--------:|:--------:|
| Windows 操作系统 | ✅ | ✅ |
| Java 运行环境 | ✅ | ❌ |

**支持 Minecraft 版本：** 1.16.5 → 最新版

---

## 开发

```bash
# 安装所有依赖
pnpm install

# 类型检查
cd backend && pnpm exec tsc --noEmit && cd ../front && pnpm exec vue-tsc --noEmit

# 后端开发模式
cd backend && pnpm run test

# 前端开发服务器（端口 9888）
cd front && pnpm run dev

# Tauri 开发（Vite + Tauri 窗口）
cd front && pnpm run tauri-dev

# 完整生产构建
pnpm run build
```

---

## 开发团队

<table>
<tr>
<td align="center" width="50%">
  <img src="front/public/tianpao.jpg" width="80" height="80" style="border-radius:50%" alt="Tianpao"/><br/>
  <b>Tianpao</b><br/>
  <sub>核心开发</sub>
</td>
<td align="center" width="50%">
  <img src="front/public/xcc.jpg" width="80" height="80" style="border-radius:50%" alt="XCC"/><br/>
  <b>XCC</b><br/>
  <sub>功能优化</sub>
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

**DeEarthX V3** — DeEarthX Team 出品

</div>
