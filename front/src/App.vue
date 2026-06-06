<script lang="ts" setup>
import { ref, provide, onMounted, onUnmounted } from 'vue';
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import { useVersion } from '@/composables/useVersion';
import { useBackend } from '@/composables/useBackend';
import { useMenu } from '@/composables/useMenu';
import { useDragDrop } from '@/composables/useDragDrop';

const { t } = useI18n();
const { version } = useVersion();
const { backendStatus, backendErrorInfo, createKillCoreProcessHandler } = useBackend();
const { selectedKeys, menuItems, handleMenuClick, route } = useMenu();
const { droppedFilePaths, clearDroppedFile, setupDragDropListener, cleanup: cleanupDragDrop } = useDragDrop();

provide("killCoreProcess", createKillCoreProcessHandler());
provide("droppedFilePaths", droppedFilePaths);
provide("clearDroppedFile", clearDroppedFile);

onMounted(async () => {
    await setupDragDropListener();
});

onUnmounted(() => {
    cleanupDragDrop();
});

const theme = ref({
    token: {
        colorPrimary: '#67eac3',
        borderRadius: 8,
        fontFamily: '"Plus Jakarta Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif',
        fontFamilyCode: '"JetBrains Mono", "Cascadia Code", monospace',
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
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Noto+Sans+SC:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

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
        opacity: 0;
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