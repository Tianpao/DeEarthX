<script lang="ts" setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { gsap } from 'gsap';
import { SponsorAd } from '&/dex/backend/information/sponsorservice';
import { useI18n } from 'vue-i18n';
import { Browser } from '@wailsio/runtime';

// 拉取赞助商数据的最长等待时间
const FETCH_TIMEOUT = 5000;

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
const contentEl = ref<HTMLElement | null>(null);

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
        // 优先使用 Wails 绑定（应用进程内、带缓存，不依赖外部后端启动时序）
        // 加超时保护：若 galaxy 服务响应过慢，避免一直挂起不显示
        const data = await Promise.race([
            SponsorAd(),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('sponsor request timeout')), FETCH_TIMEOUT)
            )
        ]);
        if (data && Array.isArray(data) && data.length > 0) {
            sponsors.value = (data as Sponsor[]).map(s => ({
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
    if (isTransitioning.value) return;

    isTransitioning.value = true;
    const el = contentEl.value;

    // 没有可动画的元素时直接切换
    if (!el) {
        currentIndex.value = (currentIndex.value + 1) % sponsors.value.length;
        isTransitioning.value = false;
        return;
    }

    // 旧内容向上滑出
    gsap.to(el, {
        y: '-100%',
        opacity: 0,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => {
            // 切换数据
            currentIndex.value = (currentIndex.value + 1) % sponsors.value.length;
            // 新内容从下方滑入
            gsap.fromTo(
                el,
                { y: '100%', opacity: 0 },
                {
                    y: '0%',
                    opacity: 1,
                    duration: 0.3,
                    ease: 'power2.out',
                    onComplete: () => {
                        isTransitioning.value = false;
                    },
                }
            );
        },
    });
}

async function openSponsorUrl(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!currentSponsor.value) return;
    try {
        Browser.OpenURL(currentSponsor.value.url)
    } catch (error) {
        console.error("Failed to open sponsor URL:", error);
        Browser.OpenURL(currentSponsor.value.url);
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
        <div ref="contentEl" class="sponsor-content">
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
    overflow: hidden;
}

.sponsor-ad:hover {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.25) 100%);
    border-color: rgba(251, 191, 36, 0.5);
}

.sponsor-content {
    display: flex;
    align-items: center;
    gap: 6px;
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
</style>
