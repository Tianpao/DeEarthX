const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 打包错误处理函数：提供中文解释和原错误输出
function handleBuildError(error, stage) {
    let chineseExplanation = '';
    const originalError = error?.toString() || JSON.stringify(error);
    const stderr = error?.stderr?.toString() || '';
    const stdout = error?.stdout?.toString() || '';
    
    if (stderr || stdout) {
        const errorOutput = (stderr + stdout).toLowerCase();
        
        if (errorOutput.includes('type') && errorOutput.includes('is not assignable')) {
            chineseExplanation = '类型错误：类型不匹配，请检查 TypeScript 类型定义';
        } else if (errorOutput.includes('property') && errorOutput.includes('does not exist')) {
            chineseExplanation = '类型错误：属性不存在，请检查对象属性名称';
        } else if (errorOutput.includes('cannot find module') || errorOutput.includes('module not found')) {
            chineseExplanation = '模块错误：找不到模块，请检查依赖是否正确安装';
        } else if (errorOutput.includes('enoent') || errorOutput.includes('no such file')) {
            chineseExplanation = '文件错误：找不到文件或目录，请检查文件路径';
        } else if (errorOutput.includes('eacces') || errorOutput.includes('permission denied')) {
            chineseExplanation = '权限错误：权限不足，请以管理员身份运行';
        } else if (errorOutput.includes('enoent') && errorOutput.includes('cargo')) {
            chineseExplanation = 'Rust环境错误：未找到Cargo，请确保已安装Rust工具链';
        } else if (errorOutput.includes('linker') && errorOutput.includes('not found')) {
            chineseExplanation = '链接器错误：找不到链接器，请安装C++编译工具链';
        } else if (errorOutput.includes('failed to resolve') || errorOutput.includes('could not resolve')) {
            chineseExplanation = '依赖解析错误：无法解析依赖，请检查网络连接和依赖配置';
        } else if (errorOutput.includes('out of memory') || errorOutput.includes('heap')) {
            chineseExplanation = '内存错误：内存不足，请关闭其他程序或增加系统内存';
        } else if (errorOutput.includes('disk space') || errorOutput.includes('no space')) {
            chineseExplanation = '磁盘空间错误：磁盘空间不足，请清理磁盘空间';
        } else if (errorOutput.includes('certificate') || errorOutput.includes('ssl')) {
            chineseExplanation = '证书错误：SSL证书问题，请检查系统时间或网络代理设置';
        } else if (errorOutput.includes('network') || errorOutput.includes('connection')) {
            chineseExplanation = '网络错误：网络连接失败，请检查网络连接和代理设置';
        } else if (errorOutput.includes('timeout')) {
            chineseExplanation = '超时错误：操作超时，请检查网络或增加超时时间';
        } else if (errorOutput.includes('cargo') && errorOutput.includes('failed')) {
            chineseExplanation = 'Rust编译错误：Rust代码编译失败，请检查Rust代码';
        } else if (errorOutput.includes('vite') && errorOutput.includes('error')) {
            chineseExplanation = 'Vite构建错误：前端构建失败，请检查Vite配置和源代码';
        } else if (errorOutput.includes('tauri') && errorOutput.includes('error')) {
            chineseExplanation = 'Tauri打包错误：Tauri打包失败，请检查Tauri配置';
        } else if (errorOutput.includes('nsis') || errorOutput.includes('wix')) {
            chineseExplanation = '安装程序错误：安装程序生成失败，请检查Windows安装工具';
        } else if (errorOutput.includes('icon') || errorOutput.includes('logo')) {
            chineseExplanation = '图标错误：图标文件问题，请检查图标文件格式和路径';
        } else if (errorOutput.includes('bundle') || errorOutput.includes('package')) {
            chineseExplanation = '打包错误：应用程序打包失败，请检查打包配置';
        } else if (errorOutput.includes('target') && errorOutput.includes('not found')) {
            chineseExplanation = '目标平台错误：不支持的目标平台，请检查平台配置';
        } else if (errorOutput.includes('version') || errorOutput.includes('semver')) {
            chineseExplanation = '版本错误：版本号格式错误，请检查版本号格式';
        } else {
            chineseExplanation = '未知错误：打包过程中发生未知错误';
        }
    } else {
        chineseExplanation = '未知错误：无法获取错误详情';
    }
    
    const errorDetails = {
        阶段: stage,
        中文解释: chineseExplanation,
        原错误: originalError,
        完整错误输出: stderr || stdout
    };
    
    console.error('\n========================================');
    console.error('❌ 打包失败');
    console.error('========================================\n');
    console.error('📋 错误阶段:', errorDetails.阶段);
    console.error('🇨🇳 中文解释:', errorDetails.中文解释);
    console.error('🔍 原错误:', errorDetails.原错误);
    if (errorDetails.完整错误输出) {
        console.error('\n📄 完整错误输出:');
        console.error(errorDetails.完整错误输出);
    }
    console.error('\n========================================\n');
    
    return errorDetails;
}

// 记录构建日志
function logBuild(stage, message) {
    const timestamp = new Date().toLocaleString('zh-CN');
    const logMessage = `[${timestamp}] [${stage}] ${message}\n`;
    
    const logFile = path.join(__dirname, 'build-error.log');
    fs.appendFileSync(logFile, logMessage, 'utf-8');
    
    console.log(logMessage.trim());
}

// 执行命令并处理错误
function executeCommand(command, stage) {
    try {
        logBuild(stage, `开始执行: ${command}`);
        execSync(command, { 
            stdio: 'inherit',
            shell: true
        });
        logBuild(stage, '✅ 执行成功');
        return true;
    } catch (error) {
        handleBuildError(error, stage);
        return false;
    }
}

// 主构建流程
async function build() {
    console.log('\n========================================');
    console.log('🚀 开始打包 DeEarthX V3');
    console.log('========================================\n');
    
    // 清理旧的日志
    const logFile = path.join(__dirname, 'build-error.log');
    if (fs.existsSync(logFile)) {
        fs.unlinkSync(logFile);
    }
    
    // 阶段1: TypeScript 类型检查
    console.log('📦 阶段 1/4: TypeScript 类型检查');
    if (!executeCommand('npm run vue-tsc --noEmit', 'TypeScript类型检查')) {
        process.exit(1);
    }
    
    // 阶段2: Vite 前端构建
    console.log('\n📦 阶段 2/4: Vite 前端构建');
    if (!executeCommand('npm run vite build', 'Vite前端构建')) {
        process.exit(1);
    }
    
    // 阶段3: Tauri 应用打包
    console.log('\n📦 阶段 3/4: Tauri 应用打包');
    if (!executeCommand('npm run tauri build', 'Tauri应用打包')) {
        process.exit(1);
    }
    
    console.log('\n========================================');
    console.log('✅ 打包完成！');
    console.error('========================================\n');
}

// 运行构建
build().catch(error => {
    handleBuildError(error, '构建流程');
    process.exit(1);
});