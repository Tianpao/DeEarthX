# DeEarthX V3

[![Github release](https://img.shields.io/github/v/tag/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/releases)
[![GitHub](https://img.shields.io/github/license/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/blob/main/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/Tianpao/DeEarthX)](https://github.com/Tianpao/DeEarthX/pulls)

## 项目概述

DeEarthX V3 是一款专业的 Minecraft 整合包服务端制作工具，致力于让 Minecraft 服务器搭建变得简单、高效、随时随地。通过智能化的模组处理和自动化的配置流程，用户可以快速将客户端整合包转换为可运行的服务端。

QQ群：559349662

## 核心功能

### 1. 多平台支持
- **CurseForge 整合包**：支持 .zip 格式的 CurseForge 整合包
- **Modrinth 整合包**：支持 .mrpack 格式的 Modrinth 整合包
- **MCBBS 整合包**：兼容 MCBBS 平台的整合包格式

### 2. 智能模组处理（DeEarthX 核心技术）
- 自动识别并分离客户端专用模组与服务端模组
- 精确筛选，保留服务端所需的所有模组
- 智能排除客户端无关文件（如光影、材质包等）

### 3. 全自动工作流
- **开服模式**：自动下载并安装 Minecraft 服务端及模组加载器
- **上传模式**：仅处理模组筛选，适用于已有服务端的场景
- 实时进度显示，包括解压进度、下载进度和整体制作状态

### 4. 模组加载器支持
- Forge
- NeoForge
- Fabric
- 原版 Minecraft

### 5. 多种 Minecraft 版本兼容
支持从 1.16.5 到最新版本的多个 Minecraft 版本及对应的模组加载器版本。

## 技术架构

### 后端核心（DeEarthX.Core）
- **开发语言**：TypeScript
- **运行时**：Node.js
- **打包工具**：Nexe（打包为独立可执行文件）、Rollup
- **压缩优化**：UPX 压缩
- **主要技术**：
  - Express（Web 服务器）
  - WebSocket（实时通信）
  - yauzl（ZIP 文件处理）
  - adm-zip（压缩包操作）

### 前端界面（DeEarthX.UI）
- **开发语言**：Vue 3 + TypeScript
- **桌面框架**：Tauri 2
- **UI 组件库**：Ant Design Vue
- **样式方案**：Tailwind CSS 4
- **路由管理**：Vue Router 4
- **构建工具**：Vite 6

## 使用流程

1. **准备整合包**：获取 .zip 或 .mrpack 格式的 Minecraft 整合包
2. **选择模式**：
   - 开服模式：需要安装 Java 环境，将完整生成服务端
   - 上传模式：仅进行模组筛选，不下载服务端文件
3. **上传文件**：拖拽或点击上传整合包文件
4. **自动处理**：
   - 解压整合包
   - 下载所需文件
   - DeEarthX 筛选模组
   - 安装服务端（开服模式）
5. **完成**：服务端制作完成，可直接使用

## 项目特色

- **零配置启动**：无需复杂的设置，上传即可使用
- **实时反馈**：通过 WebSocket 提供实时的进度更新和状态通知
- **镜像加速**：内置 BMCLAPI 和 MCIM 镜像源，加速资源下载
- **安全可靠**：精确的模组识别算法，确保服务端稳定性
- **跨平台**：基于 Tauri 构建，提供优秀的跨平台桌面应用体验

## 安装说明

项目提供独立安装包，安装完成后即可直接使用，无需额外配置环境（开服模式除外，需要 Java 环境）。

**注意**：建议不要安装在系统盘（C盘），以避免权限问题。

## 系统要求

- **操作系统**：Windows
- **开服模式**：需要安装 Java 运行环境
- **上传模式**：无需 Java 环境

## 开发团队

### 主要开发者
- **Tianpao**：项目核心架构设计与实现
- **XCC**：功能改良与优化

## 更新日志

### V3 版本
- 重构核心架构，提升处理速度
- 优化模组识别算法，提高准确性
- 全新的 UI 设计，用户体验升级
- 增加对 Modrinth 平台的完整支持
- 添加 WebSocket 实时通信机制
- 引入 Tauri 框架，提供原生桌面应用体验

---

*让开服变成随时随地的事情！*