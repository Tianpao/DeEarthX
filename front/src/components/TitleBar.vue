<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { MinusOutlined, CloseOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { useVersion } from '@/composables/useVersion';
import { useI18n } from 'vue-i18n';
import { useBackend } from '@/composables/useBackend';
import SponsorAd from '@/components/SponsorAd.vue';
import axios from '@/utils/axios';

const { t } = useI18n();
const { version } = useVersion();
const { backendStatus, backendErrorInfo } = useBackend();
const appWindow = getCurrentWindow();
const isCloseHover = ref(false);
const showSponsorAd = ref(true);
const sponsorAdRef = ref<InstanceType<typeof SponsorAd> | null>(null);

// 开始拖拽窗口
async function startDragging(e: MouseEvent) {
    if (e.button === 0) {
        await appWindow.startDragging();
    }
}

// 最小化
async function minimize() {
    await appWindow.minimize();
}

// 关闭
async function close() {
    await appWindow.close();
}

async function loadConfig() {
    try {
        const response = await axios.get('/config/get');
        showSponsorAd.value = response.data.showSponsorAd ?? true;
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

// 监听配置变化事件
function handleConfigChange() {
    loadConfig();
}

watch(showSponsorAd, (visible) => {
    if (sponsorAdRef.value) {
        sponsorAdRef.value.setVisible(visible);
    }
});

onMounted(() => {
    loadConfig();
    window.addEventListener('config-changed', handleConfigChange);
});

onUnmounted(() => {
    window.removeEventListener('config-changed', handleConfigChange);
});
</script>

<template>
    <div class="titlebar" @mousedown="startDragging">
        <div class="titlebar-left">
            <img src="/icons/32x32.png" class="app-logo" alt="logo" />
            <span class="app-title">{{ isCloseHover ? 'Systemmmm' : t('common.app_name') }}</span>
            <span class="app-version">{{ version }}</span>
            <span
                class="backend-status"
                :title="backendErrorInfo || t('message.backend_running')"
            >
                <LoadingOutlined v-if="backendStatus === 'loading'" style="color: #1890ff;" />
                <CheckCircleOutlined v-else-if="backendStatus === 'success'" style="color: #52c41a;" />
                <CloseCircleOutlined v-else style="color: #ff4d4f;" />
                <span class="status-text"
                      :style="{
                          color: backendStatus === 'loading' ? '#1890ff' :
                                 backendStatus === 'success' ? '#52c41a' : '#ff4d4f'
                      }">
                    {{ backendStatus === 'loading' ? t('common.status_loading') :
                       backendStatus === 'success' ? t('common.status_success') : t('common.status_error') }}
                </span>
            </span>
            <SponsorAd v-if="showSponsorAd" ref="sponsorAdRef" />
        </div>
        <div class="titlebar-buttons">
            <button class="titlebar-btn minimize" @mousedown.stop @click="minimize" :title="t('common.minimize')">
                <MinusOutlined />
            </button>
            <button class="titlebar-btn close" @mouseenter="isCloseHover = true" @mouseleave="isCloseHover = false" @mousedown.stop @click="close" :title="t('common.close')">
                <CloseOutlined />
            </button>
        </div>
        <div class="titlebar-close-overlay"></div>
    </div>
</template>

<style scoped>
.titlebar {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
    border-bottom: 1px solid #e5e7eb;
    padding-left: 16px;
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    overflow: hidden;
}

.titlebar-close-overlay {
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 100%;
    background: #ef4444;
    z-index: 0;
    transition: width 0.5s ease;
}

.titlebar:has(.titlebar-btn.close:hover) .titlebar-close-overlay {
    width: 100%;
}

.titlebar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
}

.app-logo {
    width: 20px;
    height: 20px;
}

.app-title {
    font-size: 14px;
    font-weight: 600;
    color: #1f2937;
    font-family: "Plus Jakarta Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif;
    transition: color 0.4s ease;
}

.titlebar:has(.titlebar-btn.close:hover) .app-title {
    color: #ffffff;
}

.app-version {
    font-size: 11px;
    color: #9ca3af;
    font-family: "JetBrains Mono", "Cascadia Code", monospace;
    transition: color 0.4s ease;
}

.titlebar:has(.titlebar-btn.close:hover) .app-version {
    color: rgba(255, 255, 255, 0.8);
}

.backend-status {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 8px;
}

.status-text {
    font-size: 12px;
}

.titlebar-buttons {
    display: flex;
    height: 100%;
    position: relative;
    z-index: 1;
}

.titlebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 100%;
    border: none;
    background: transparent;
    color: #6b7280;
    cursor: pointer;
    font-size: 12px;
    position: relative;
    z-index: 1;
    transition: color 0.4s ease;
}

.titlebar-btn:hover {
    color: #374151;
}

.titlebar-btn.close:hover {
    color: #ffffff;
}

.titlebar-btn.close:active ~ .titlebar-close-overlay {
    background: #dc2626;
}
</style>