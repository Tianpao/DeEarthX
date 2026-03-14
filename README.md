# DeEarthX V3

[![Github release](https://img.shields.io/github/v/tag/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/releases)
[![GitHub](https://img.shields.io/github/license/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/pulls)

## Star History

<a href="https://www.star-history.com/?repos=Tianpao%2FDeEarthX&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=Tianpao/DeEarthX&type=date&legend=top-left" />
 </picture>
</a>


## 项目概述

DeEarthX V3 是一个 Minecraft 整合包服务端制作工具，帮你快速把客户端整合包转换成可运行的服务端。

QQ群：559349662

## 核心功能

### 整合包支持
- CurseForge
- Modrinth
- MCBBS

### 模组处理
自动区分客户端和服务端模组，保留服务端需要的，剔除客户端专用的（光影、材质包等）。

### 工作模式
- **开服模式**：下载服务端和模组加载器，完整生成服务端
- **上传模式**：只做模组筛选，不下载服务端文件

### 模组加载器
- Forge
- NeoForge
- Fabric

### 版本支持
支持 1.16.5 到最新版本。

## 技术架构

### 后端
TypeScript + Node.js，Express 提供 Web 服务，WebSocket 实时通信，使用 Node.js SEA 打包为独立 exe。

### 前端
Vue 3 + TypeScript，Tauri 2 桌面框架，Ant Design Vue UI 组件，Tailwind CSS 样式。

## 使用流程

1. 准备整合包文件
2. 选择模式（开服/上传）
3. 上传文件
4. 等待处理完成
5. 下载服务端

## 项目特色

- 上传即用，无需配置
- 实时进度显示
- 内置 BMCLAPI 和 MCIM 镜像源加速下载
- 支持多语言

> [!WARNING]
> 模组可能过滤不干净，且制作的服务端禁止用于售卖！

## 安装说明

直接下载安装包安装即可使用。

**注意**：建议不要安装在 C 盘，避免权限问题。

## 系统要求

- 操作系统：Windows
- 开服模式需要 Java 环境
- 上传模式不需要 Java

## 开发团队

- **Tianpao**：核心开发
- **XCC**：功能优化
