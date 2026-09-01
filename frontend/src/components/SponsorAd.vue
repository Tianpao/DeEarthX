<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { Browser } from '@wailsio/runtime';
import { SponsorService } from '@/bindings/deearthx/core/services';
import type { Sponsor } from '@/bindings/deearthx/core/sponsor/models';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface SponsorDisplay {
    id: number | string;
    name: string;
    imageUrl: string;
    type: string;
    url: string;
    tone: string;
}

const sponsors = ref<SponsorDisplay[]>([]);
const currentIndex = ref(0);
const isTransitioning = ref(false);
const isVisible = ref(true);

let intervalId: ReturnType<typeof setInterval> | null = null;

const localSponsors: SponsorDisplay[] = [
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
        const list = await SponsorService.List();
        if (list && list.length > 0) {
            sponsors.value = list.map(s => ({
                ...s,
                id: String(s.id),
                type: s.tone === 'gold' ? t('about.sponsor_type_gold') :
                      s.tone === 'silver' ? t('about.sponsor_type_silver') : t('about.sponsor_type_bronze')
            }));
        } else {
            sponsors.value = localSponsors;
        }
    } catch {
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
        await Browser.OpenURL(currentSponsor.value.url);
    } catch {
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
    if (visible) startRotation();
    else stopRotation();
});

onMounted(async () => {
    await fetchSponsors();
    if (isVisible.value) startRotation();
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
