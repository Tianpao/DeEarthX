<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Window } from '@wailsio/runtime';
import { MinusOutlined, CloseOutlined, LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue';
import { useVersion } from '@/composables/useVersion';
import { useI18n } from 'vue-i18n';
import { useSettingStore } from '@/stores/setting';
import SponsorAd from '@/components/SponsorAd.vue';

const { t } = useI18n();
const { version } = useVersion();
const settingStore = useSettingStore();
const appWindow = Window
const sponsorAdRef = ref<InstanceType<typeof SponsorAd> | null>(null);

// 最小化
async function minimize() {
    if (await appWindow.IsMinimised()) {
        await appWindow.UnMinimise();
    } else {
        await appWindow.Minimise()
    }
}

// 关闭
async function close() {
    await appWindow.Close()
}

watch(() => settingStore.config.showSponsorAd, (visible) => {
    if (sponsorAdRef.value) {
        sponsorAdRef.value.setVisible(visible);
    }
}, { immediate: true });

onMounted(() => {
    settingStore.initialize();
});
</script>

<template>
    <div class="titlebar">
        <div class="titlebar-left">
            <img src="/icons/32x32.png" class="app-logo" alt="logo" />
            <span class="app-title">{{t('common.app_name') }}</span>
            <span class="app-version">{{ version }}</span>
            <SponsorAd v-if="settingStore.config.showSponsorAd" ref="sponsorAdRef" />
        </div>
        <div class="titlebar-buttons">
            <button class="titlebar-btn minimize" @mousedown.stop @click="minimize" :title="t('common.minimize')">
                <MinusOutlined />
            </button>
            <button class="titlebar-btn close" @click="close">
                <CloseOutlined />
            </button>
        </div>
    </div>
</template>

<style scoped>
.titlebar {
    --wails-draggable: drag;
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
    --wails-draggable: none;
    position: absolute;
    top: 0;
    right: 0;
    width: 0;
    height: 100%;
    background: #ef4444;
    z-index: 0;
    transition: width 0.5s ease;
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

.app-version {
    font-size: 11px;
    color: #9ca3af;
    font-family: "JetBrains Mono", "Cascadia Code", monospace;
    transition: color 0.4s ease;
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
    --wails-draggable: none;
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

.titlebar-btn:has(.close:hover) {
    background: #ef4444;
}
</style>