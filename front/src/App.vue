<script lang="ts" setup>
import { h, provide, ref, onMounted, computed } from 'vue';
import { MenuProps, message } from 'ant-design-vue';
import { SettingOutlined, UploadOutlined, UserOutlined, WindowsOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, FileSearchOutlined, FolderOutlined } from '@ant-design/icons-vue';
import { useRouter, useRoute } from 'vue-router';
import { Command } from '@tauri-apps/plugin-shell';
import { useI18n } from 'vue-i18n';

const router = useRouter();
const route = useRoute();
let killCoreProcess: (() => void) | null = null;

const { t } = useI18n();

// 版本号相关
const version = ref<string>('V3');

// 加载版本号
async function loadVersion() {
    try {
        console.log('开始加载版本号...');
        const response = await fetch('/version.json');
        console.log('version.json 响应状态:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('版本号数据:', data);
        version.value = `V${data.version}`;
        console.log('设置版本号为:', version.value);
    } catch (error) {
        console.error('加载版本号失败:', error);
        version.value = 'V3';
    }
}

// 后端连接状态相关
const backendStatus = ref<'loading' | 'success' | 'error'>('loading');
const backendErrorInfo = ref<string>('');
const retryCount = ref<number>(0);
const maxRetries = 5;

// 检测端口是否被正确的后端占用
async function checkPortOccupied(): Promise<'correct_backend' | 'wrong_app' | 'free'> {
    try {
        const response = await fetch("http://localhost:37019/config/get", {
            method: "GET",
            signal: AbortSignal.timeout(1000)
        });
        
        if (response.ok) {
            const config = await response.json();
            // 检查是否包含 DeEarthX 后端的特征字段（mirror、filter 等）
            if (config.mirror !== undefined || config.filter !== undefined) {
                // 端口被正确的后端占用
                return 'correct_backend';
            } else {
                // 端口被其他应用占用
                return 'wrong_app';
            }
        } else {
            return 'free';
        }
    } catch (error) {
        // 连接失败，端口可能是空闲的
        return 'free';
    }
}

// 启动后端核心服务
async function runCoreProcess() {
    // 先检测端口状态
    const portStatus = await checkPortOccupied();
    
    if (portStatus === 'correct_backend') {
        // 端口已经被正确的后端占用，直接使用
        backendStatus.value = 'success';
        backendErrorInfo.value = '';
        message.success(t('message.backend_running'));
        return;
    }

    if (portStatus === 'wrong_app') {
        // 端口被其他应用占用
        backendStatus.value = 'error';
        backendErrorInfo.value = t('message.backend_port_occupied');
        message.error(t('message.backend_port_occupied'));
        return;
    }
    
    // 端口空闲，尝试启动后端
    backendStatus.value = 'loading';
    
    Command.create("core").spawn()
        .then((e) => {
            console.log("DeEarthX V3 Core");
            killCoreProcess = e.kill;
            
            // 等待后端启动并检查状态
            setTimeout(async () => {
                try {
                    const response = await fetch("http://localhost:37019/", { method: "GET" });
                    if (response.ok) {
                        backendStatus.value = 'success';
                        backendErrorInfo.value = '';
                        message.success(t('message.backend_started'));
                    } else {
                        backendStatus.value = 'error';
                        backendErrorInfo.value = t('common.status_error');
                        router.push('/error');
                    }
                } catch (error) {
                    console.error("后端连接失败:", error);
                    backendStatus.value = 'error';
                    backendErrorInfo.value = t('common.status_error');
                    router.push('/error');
                }
            }, 3000); // 等待3秒让后端启动
        })
        .catch((error) => {
            console.error(error);
            retryCount.value++;
            
            if (retryCount.value <= maxRetries) {
                message.info(t('message.retry_start', { current: retryCount.value, max: maxRetries }));
                setTimeout(() => {
                    runCoreProcess();
                }, 2000);
            } else {
                backendStatus.value = 'error';
                backendErrorInfo.value = t('message.backend_start_failed', { count: maxRetries });
                message.error(t('message.backend_start_failed', { count: maxRetries }));
            }
        });
}


// 组件挂载时启动后端
onMounted(async () => {
    loadVersion();
    runCoreProcess();
});

provide("killCoreProcess", () => {
        if (killCoreProcess && typeof killCoreProcess === 'function') {
            killCoreProcess();
            killCoreProcess = null;
            message.info(t('message.backend_restart'));
            runCoreProcess();
        }
});

// 导航菜单配置
const selectedKeys = ref<(string | number)[]>(['main']);

// 监听路由变化，更新选中菜单
router.beforeEach((to, _from, next) => {
    const routeToKey: Record<string, string> = {
        '/': 'main',
        '/setting': 'setting',
        '/about': 'about',
        '/error': 'main',
        '/galaxy': 'galaxy',
        '/deearth': 'deearth',
        '/template': 'template'
    };
    selectedKeys.value[0] = routeToKey[to.path] || 'main';
    next();
});

// 菜单项配置（使用计算属性使其响应语言变化）
const menuItems = computed<MenuProps['items']>(() => {
    return [
        {
            key: 'main',
            icon: h(WindowsOutlined),
            label: t('menu.home'),
            title: t('menu.home'),
        },
        {
            key: 'deearth',
            icon: h(FileSearchOutlined),
            label: t('menu.deearth'),
            title: t('menu.deearth'),
        },
        {
            key: 'galaxy',
            icon: h(UploadOutlined),
            label: t('menu.galaxy'),
            title: t('menu.galaxy'),
        },
        {
            key: 'template',
            icon: h(FolderOutlined),
            label: t('menu.template'),
            title: t('menu.template'),
        },
        {
            key: 'setting',
            icon: h(SettingOutlined),
            label: t('menu.setting'),
            title: t('menu.setting'),
        },
        {
            key: 'about',
            icon: h(UserOutlined),
            label: t('menu.about'),
            title: t('menu.about'),
        }
    ];
});

// 菜单点击事件处理
const handleMenuClick: MenuProps['onClick'] = (e) => {
    selectedKeys.value[0] = e.key;
    const routeMap: Record<string, string> = {
        main: '/',
        deearth: '/deearth',
        setting: '/setting',
        about: '/about',
        galaxy: '/galaxy',
        template: '/template'
    };
    const route = routeMap[e.key] || '/';
    router.push(route);
};

// 主题配置
const theme = ref({
    token: {
        colorPrimary: '#67eac3',
        borderRadius: 8,
    },
    components: {
        Menu: {
            itemActiveBg: '#e8fff5',
            itemSelectedBg: '#e8fff5',
            itemSelectedColor: '#10b981',
        }
    }
});
</script>

<template>
    <a-config-provider :theme="theme">
        <div class="tw:h-screen tw:w-screen tw:flex tw:flex-col tw:overflow-hidden">
            <!-- 顶部导航栏 -->
            <a-page-header
                class="tw:h-14 tw:px-6 tw:flex tw:items-center tw:bg-white tw:shadow-sm tw:z-10 tw:transition-all tw:duration-300"
                style="border: none;"

            >
                <!-- <template #extra>
                    <a-button @click="openAuthorBilibili">作者B站</a-button>
                </template> -->
                <!-- 后端状态图标 -->
                <template #title>
                    <div class="tw:flex tw:items-center tw:gap-3">
                        <span>
                            <span style="color: #000000; font-weight: 500;">{{ t('common.app_name') }}</span>
                            <span style="color: #888888; font-size: 12px; margin-left: 5px;">{{ version }}</span>
                        </span>
                        <span
                            class="tw:flex tw:items-center tw:gap-2"
                            :title="backendErrorInfo || t('message.backend_running')"
                        >
                            <LoadingOutlined v-if="backendStatus === 'loading'" style="color: #1890ff; font-size: 18px;" />
                            <CheckCircleOutlined v-else-if="backendStatus === 'success'" style="color: #52c41a; font-size: 18px;" />
                            <CloseCircleOutlined v-else style="color: #ff4d4f; font-size: 18px;" />
                            <span class="tw:text-xs tw:ml-1"
                                  :style="{
                                      color: backendStatus === 'loading' ? '#1890ff' :
                                             backendStatus === 'success' ? '#52c41a' : '#ff4d4f'
                                  }">
                                {{ backendStatus === 'loading' ? t('common.status_loading') :
                                   backendStatus === 'success' ? t('common.status_success') : t('common.status_error') }}
                            </span>
                        </span>
                    </div>
                </template>
            </a-page-header>

            <!-- 主体内容区域 -->
            <div class="tw:flex tw:flex-1 tw:overflow-hidden">
                <!-- 侧边菜单 -->
                <a-menu
                    id="menu"
                    class="tw:shadow-lg tw:z-20"
                    style="width: 180px; flex-shrink: 0;"
                    :selectedKeys="selectedKeys"
                    mode="inline"
                    :items="menuItems"
                    @click="handleMenuClick"
                />

                <!-- 内容区域 - 带过渡动画 -->
                <div class="tw:flex-1 tw:overflow-hidden tw:relative tw:bg-gradient-to-br tw:from-slate-50 tw:via-blue-50 tw:to-indigo-50">
                    <router-view v-slot="{ Component }">
                        <transition
                            name="fade-slide"
                            mode="out-in"
                            appear
                        >
                            <component :is="Component" :key="route.path" class="tw:w-full tw:h-full tw:absolute tw:top-0 tw:left-0" />
                        </transition>
                    </router-view>
                </div>
            </div>
        </div>
    </a-config-provider>
</template>

<style>
/* 禁止选择文本的样式 */
h1,
li,
p,
span {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

/* 禁止拖拽图片 */
img {
    -webkit-user-drag: none;
    -moz-user-drag: none;
    -ms-user-drag: none;
}

/* 页面切换过渡动画 - 淡入淡出 + 滑动 */
.fade-slide-enter-active {
    animation: fadeSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-leave-active {
    animation: fadeSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeSlideIn {
    0% {
        opacity: 0;
        transform: translateX(20px);
    }
    100% {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes fadeSlideOut {
    0% {
        opacity: 1;
        transform: translateX(0);
    }
    100% {
        opacity: 0;
        transform: translateX(-20px);
    }
}

/* 菜单项悬停效果优化 */
#menu .ant-menu-item {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 8px;
}

#menu .ant-menu-item:hover {
    transform: translateX(4px);
    background: #f0fdf9;
}

#menu .ant-menu-item-selected {
    background: linear-gradient(135deg, #d1fae5 0%, #e8fff5 100%);
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15);
}

#menu .ant-menu-item-selected .anticon {
    color: #10b981;
}

/* 滚动条美化 */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
    border-radius: 4px;
    transition: all 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #64748b 0%, #475569 100%);
}
</style>