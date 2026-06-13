<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { open } from '@tauri-apps/plugin-shell';
import axiosInstance from '@/utils/axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Sponsor {
    id: number | string;
    name: string;
    imageUrl: string;
    type: string;
    url: string;
    tone: 'gold' | 'silver' | 'bronze' | 'blue' | 'emerald' | 'violet';
}

const sponsors = ref<Sponsor[]>([]);
const currentIndex = ref(0);
const isTransitioning = ref(false);
const isVisible = ref(true);

let intervalId: ReturnType<typeof setInterval> | null = null;

const localSponsors: Sponsor[] = [
    {
        id: "elfidc",
        name: t('about.sponsor_elfidc'),
        imageUrl: "./elfidc.svg",
        type: t('about.sponsor_type_gold'),
        url: "https://www.elfidc.com",
        tone: 'gold'
    }
];

const currentSponsor = computed(() => {
    if (sponsors.value.length === 0) return null;
    return sponsors.value[currentIndex.value];
});

async function fetchSponsors() {
    try {
        const response = await axiosInstance.get<Sponsor[]>('http://localhost:37019/sponsor/', {
            timeout: 5000
        });
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            sponsors.value = response.data.map(s => ({
                ...s,
                type: s.tone === 'gold' ? t('about.sponsor_type_gold') :
                      s.tone === 'silver' ? t('about.sponsor_type_silver') : t('about.sponsor_type_bronze')
            }));
        } else {
            sponsors.value = localSponsors;
        }
    } catch (error) {
        console.warn('获取赞助商列表失败，使用本地数据:', error);
        sponsors.value = localSponsors;
    }
}

function nextSponsor() {
    if (sponsors.value.length <= 1) return;

    isTransitioning.value = true;

    setTimeout(() => {
        currentIndex.value = (currentIndex.value + 1) % sponsors.value.length;
        isTransitioning.value = false;
    }, 300);
}

async function openSponsorUrl(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!currentSponsor.value) return;
    try {
        await open(currentSponsor.value.url);
    } catch (error) {
        console.error("Failed to open sponsor URL:", error);
        window.open(currentSponsor.value.url, '_blank');
    }
}

function startRotation() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(nextSponsor, 5000);
}

function stopRotation() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

watch(isVisible, (visible) => {
    if (visible) {
        startRotation();
    } else {
        stopRotation();
    }
});

onMounted(async () => {
    await fetchSponsors();
    if (isVisible.value) {
        startRotation();
    }
});

onUnmounted(() => {
    stopRotation();
});

defineExpose({
    setVisible: (visible: boolean) => { isVisible.value = visible; }
});
</script>

<template>
    <div v-if="isVisible && currentSponsor" class="sponsor-ad" @click.stop="openSponsorUrl" @mousedown.stop @mouseup.stop>
        <div class="sponsor-content" :class="{ 'transitioning': isTransitioning }">
            <img :src="currentSponsor.imageUrl" :alt="currentSponsor.name" class="sponsor-logo" />
            <span class="sponsor-name">{{ currentSponsor.name }}</span>
        </div>
    </div>
</template>

<style scoped>
.sponsor-ad {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: 16px;
    padding: 2px 8px;
    border-radius: 4px;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.15) 100%);
    border: 1px solid rgba(251, 191, 36, 0.3);
    cursor: pointer;
    transition: all 0.3s ease;
    user-select: none;
    -webkit-user-select: none;
}

.sponsor-ad:hover {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.25) 100%);
    border-color: rgba(251, 191, 36, 0.5);
}

.sponsor-content {
    display: flex;
    align-items: center;
    gap: 6px;
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.sponsor-content.transitioning {
    opacity: 0;
    transform: translateX(10px);
}

.sponsor-logo {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.sponsor-name {
    font-size: 12px;
    font-weight: 500;
    color: #92400e;
    white-space: nowrap;
}

.titlebar:has(.titlebar-btn.close:hover) .sponsor-ad {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.2) 100%);
    border-color: rgba(251, 191, 36, 0.4);
}

.titlebar:has(.titlebar-btn.close:hover) .sponsor-name {
    color: #fef3c7;
}
</style>
