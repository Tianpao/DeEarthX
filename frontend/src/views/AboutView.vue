<script lang="ts" setup>
import { GithubOutlined } from '@ant-design/icons-vue';
import { open } from "@tauri-apps/plugin-shell";
import { ref, onMounted, computed } from "vue";
import { useI18n } from 'vue-i18n';
import axiosInstance from '@/utils/axios';

const { t } = useI18n();
const githubUrl = 'https://github.com/Tianpao/DeEarthX';

interface Sponsor {
    id: number | string;
    name: string;
    imageUrl: string;
    type: string;
    url: string;
    tone: 'gold' | 'silver' | 'bronze' | 'blue' | 'emerald' | 'violet';
}

interface VersionInfo {
    version: string;
    buildTime: string;
    author: string;
}

const sponsors = ref<Sponsor[]>([]);
const currentVersion = ref<string>(t('common.loading'));
const buildTime = ref<string>('');

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

async function getVersionFromJson(): Promise<VersionInfo> {
    try {
        const response = await fetch('/version.json');
        if (!response.ok) {
            throw new Error(t('about.version_file_read_failed'));
        }
        return await response.json();
    } catch (error) {
        console.error('读取 version.json 失败:', error);
        return {
            version: '1.0.0',
            buildTime: 'Unknown',
            author: 'Tianpao'
        };
    }
}

async function getCurrentVersion() {
    const versionInfo = await getVersionFromJson();
    currentVersion.value = versionInfo.version;
    buildTime.value = versionInfo.buildTime;
}

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
        console.warn('获取云端赞助商列表失败，使用本地数据:', error);
        sponsors.value = localSponsors;
    }
}

const thanksList = computed(() => {
    return [
        {
            id: "user",
            name: t('about.author_tianpao'),
            avatar: "./tianpao.jpg",
            contribution: t('about.contribution_author'),
            bilibiliUrl: "https://space.bilibili.com/1728953419"
        },
        {
            id: "dev2",
            name: "XCC",
            avatar: "./xcc.jpg",
            contribution: t('about.contribution_dev2'),
            bilibiliUrl: "https://space.bilibili.com/3546586967706135"
        },
        {
            id: "mirror-bmclapi",
            name: "bangbang93",
            avatar: "./bb93.jpg",
            contribution: t('about.contribution_bangbang93')
        },
        {
            id: "mirror-mcim",
            name: "z0z0r4",
            avatar: "./z0z0r4.jpg",
            contribution: t('about.contribution_z0z0r4')
        }
    ];
});

const sponsorToneClasses: Record<Sponsor['tone'], string> = {
    gold: 'tw:bg-amber-50 tw:text-amber-700 tw:ring-1 tw:ring-amber-200',
    silver: 'tw:bg-slate-100 tw:text-slate-600 tw:ring-1 tw:ring-slate-200',
    bronze: 'tw:bg-orange-50 tw:text-orange-700 tw:ring-1 tw:ring-orange-200',
    blue: 'tw:bg-sky-50 tw:text-sky-700 tw:ring-1 tw:ring-sky-200',
    emerald: 'tw:bg-emerald-50 tw:text-emerald-700 tw:ring-1 tw:ring-emerald-200',
    violet: 'tw:bg-violet-50 tw:text-violet-700 tw:ring-1 tw:ring-violet-200'
};

async function contant(sponsor: Sponsor) {
    try {
        await open(sponsor.url);
    } catch (error) {
        console.error("Failed to open sponsor URL:", error);
        window.open(sponsor.url, '_blank');
    }
}

async function openBilibili(url: string) {
    try {
        await open(url);
    } catch (error) {
        console.error("Failed to open Bilibili URL:", error);
        window.open(url, '_blank');
    }
}

async function openGithub() {
    try {
        await open(githubUrl);
    } catch (error) {
        console.error('Failed to open GitHub URL:', error);
        window.open(githubUrl, '_blank');
    }
}

onMounted(() => {
    fetchSponsors();
    getCurrentVersion();
});
</script>

<template>
    <div class="tw:h-full tw:w-full tw:overflow-y-auto tw:p-6">
        <div class="tw:mx-auto tw:flex tw:w-full tw:max-w-5xl tw:flex-col tw:gap-6">
            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4 tw:shadow-sm">
                <div class="tw:flex tw:flex-col tw:gap-3 md:tw:flex-row md:tw:items-start md:tw:justify-end">
                    <div class="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-2.5 md:tw:max-w-[248px]">
                        <dl class="tw:space-y-1.5">
                            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                                <dt class="tw:text-[11px] tw:text-slate-500">{{ t('about.current_version') }}</dt>
                                <dd class="tw:text-xs tw:font-semibold tw:text-slate-900">{{ currentVersion }}</dd>
                            </div>
                            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-slate-200 tw:pt-1.5">
                                <dt class="tw:text-[11px] tw:text-slate-500">{{ t('about.build_time') }}</dt>
                                <dd class="tw:text-[11px] tw:font-medium tw:text-slate-700">{{ buildTime }}</dd>
                            </div>
                            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-slate-200 tw:pt-1.5">
                                <dt class="tw:text-[11px] tw:text-slate-500">GitHub</dt>
                                <dd>
                                    <button
                                        type="button"
                                        class="tw:inline-flex tw:items-center tw:gap-1 tw:text-[10px] tw:font-medium tw:text-slate-700 tw:transition-colors hover:tw:text-slate-900"
                                        @click="openGithub"
                                    >
                                        <GithubOutlined class="tw:text-[11px]" />
                                        <span>DeEarthX</span>
                                    </button>
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </section>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-4">
                    <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">{{ t('about.development_team') }}</h2>
                    <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('about.development_team_desc') }}</p>
                </div>

                <div class="tw:flex tw:flex-col tw:gap-3">
                    <article
                        v-for="item in thanksList"
                        :key="item.id"
                        class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4"
                    >
                        <div class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3">
                            <img class="tw:h-12 tw:w-12 tw:rounded-lg tw:object-cover tw:ring-1 tw:ring-slate-200" :src="item.avatar" :alt="item.name">
                            <div class="tw:min-w-0 tw:flex-1">
                                <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                                    <h3 class="tw:text-sm tw:font-semibold tw:text-slate-900">{{ item.name }}</h3>
                                    <span class="tw:inline-flex tw:items-center tw:rounded-md tw:bg-emerald-50 tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium tw:text-emerald-700">
                                        {{ item.contribution }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div class="tw:ml-auto tw:flex tw:justify-end">
                            <a-button
                                v-if="item.bilibiliUrl"
                                type="default"
                                size="middle"
                                class="tw:min-w-[96px]"
                                @click="openBilibili(item.bilibiliUrl)"
                            >
                                {{ t('about.bilibili_home') }}
                            </a-button>
                        </div>
                    </article>
                </div>
            </section>

            <section class="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:shadow-sm">
                <div class="tw:mb-4">
                    <h2 class="tw:text-lg tw:font-semibold tw:text-slate-900">{{ t('about.sponsor') }}</h2>
                    <p class="tw:mt-1 tw:text-sm tw:text-slate-500">{{ t('about.sponsor_desc') }}</p>
                </div>

                <div class="tw:flex tw:flex-col tw:gap-3">
                    <button
                        v-for="sponsor in sponsors"
                        :key="sponsor.id"
                        type="button"
                        class="tw:flex tw:w-full tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-4 tw:text-left tw:transition-colors hover:tw:border-slate-300 hover:tw:bg-slate-100 md:tw:flex-row md:tw:items-center md:tw:justify-between"
                        @click="contant(sponsor)"
                    >
                        <div class="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
                            <div class="tw:flex tw:h-12 tw:w-12 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white">
                                <img class="tw:max-h-8 tw:max-w-8 tw:object-contain" :src="sponsor.imageUrl" :alt="sponsor.name">
                            </div>
                            <div class="tw:min-w-0">
                                <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                                    <h3 class="tw:text-sm tw:font-semibold tw:text-slate-900">{{ sponsor.name }}</h3>
                                    <span
                                        class="tw:inline-flex tw:items-center tw:rounded-md tw:px-2.5 tw:py-1 tw:text-xs tw:font-medium"
                                        :class="sponsorToneClasses[sponsor.tone]"
                                    >
                                        {{ sponsor.type }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <span class="tw:text-sm tw:font-medium tw:text-slate-500">{{ t('about.visit_website') }}</span>
                    </button>
                </div>
            </section>
        </div>
    </div>
</template>
