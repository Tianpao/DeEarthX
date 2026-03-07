<script lang="ts" setup>
import { open } from "@tauri-apps/plugin-shell";
import { ref, onMounted, computed } from "vue";
import { useI18n } from '../i18n';

// i18n
const { t, language, translationVersion } = useI18n();
// 赞助商数据接口定义
interface Sponsor {
    id: string;
    name: string;
    imageUrl: string;
    type: string;
    url: string;
}

// 版本信息接口
interface VersionInfo {
    version: string;
    buildTime: string;
    author: string;
}

// 赞助商数据
const sponsors = ref<Sponsor[]>([]);

// 版本信息
const currentVersion = ref<string>(t('common.loading'));
const buildTime = ref<string>('');
const author = ref<string>('');

// 从 public/version.json 读取版本信息
async function getVersionFromJson(): Promise<VersionInfo> {
    try {
        const response = await fetch('/version.json');
        if (!response.ok) {
            throw new Error(t('about.version_file_read_failed'));
        }
        return await response.json();
    } catch (error) {
        console.error('读取 version.json 失败:', error);
        // 返回默认版本信息
        return {
            version: '1.0.0',
            buildTime: 'Unknown',
            author: 'Tianpao'
        };
    }
}

// 获取当前版本
async function getCurrentVersion() {
    const versionInfo = await getVersionFromJson();
    currentVersion.value = versionInfo.version;
    buildTime.value = versionInfo.buildTime;
    author.value = versionInfo.author;
}

// 检查更新（暂时注释掉）
// async function checkUpdate() {
//     checkingUpdate.value = true;
//     try {
//         // TODO: 实现版本检查逻辑
//         // const response = await fetch('YOUR_VERSION_API_URL');
//         // const data = await response.json();
//         // latestVersion.value = data.version;
//         // updateAvailable.value = data.version !== currentVersion.value;
//         updateAvailable.value = false;
//     } catch (error) {
//         console.error("检查更新失败:", error);
//     } finally {
//         checkingUpdate.value = false;
//     }
// }

// JSON 数据源 URL
const SPONSORS_JSON_URL = "https://bk.xcclyc.cn/upzzs.json"; // 赞助商数据源

// 从远程 JSON 获取赞助商数据
async function fetchSponsors() {
    try {
        const response = await fetch(SPONSORS_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        sponsors.value = data;
    } catch (error) {
        console.error("Failed to fetch sponsors:", error);
        // 如果获取失败，使用默认数据
        sponsors.value = [
            {
                id: "elfidc",
                name: "亿讯云",
                imageUrl: "./elfidc.svg",
                type: t('about.sponsor_type_gold'),
                url: "https://www.elfidc.com"
            }
        ];
    }
}

// 感谢列表数据数组
const thanksList = computed(() => {
  // 访问 language 和 translationVersion 以建立响应式依赖
  language.value;
  translationVersion.value;
  return [
    {
      id: "user",
      name: "天跑",
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
      id: "mirror",
      name: "bangbang93",
      avatar: "./bb93.jpg",
      contribution: t('about.contribution_bangbang93')
    },{
      id: "mirror",
      name: "z0z0r4",
      avatar: "./z0z0r4.jpg",
      contribution: t('about.contribution_z0z0r4')
    }
  ];
});

async function contant(sponsor: Sponsor){
    try {
        await open(sponsor.url)
    } catch (error) {
        console.error("Failed to open sponsor URL:", error)
        // 备用方案：使用浏览器打开
        window.open(sponsor.url, '_blank')
    }
}

// 打开B站链接
async function openBilibili(url: string) {
    try {
        await open(url);
    } catch (error) {
        console.error("Failed to open Bilibili URL:", error)
        window.open(url, '_blank')
    }
}

// 组件挂载时获取赞助商数据和版本信息
onMounted(() => {
    fetchSponsors();
    getCurrentVersion();
});
</script>

<template>
    <div class="tw:h-full tw:w-full tw:p-8 tw:bg-gradient-to-br tw:from-slate-50 tw:via-blue-50 tw:to-indigo-50 tw:overflow-auto">
        <div class="tw:w-full tw:max-w-5xl tw:mx-auto tw:flex tw:flex-col tw:gap-8">
            <!-- 页面标题 -->
            <div class="tw:text-center tw:animate-fade-in">
                <h1 class="tw:text-3xl tw:font-bold tw:bg-gradient-to-r tw:from-emerald-500 tw:via-cyan-500 tw:to-blue-500 tw:bg-clip-text tw:text-transparent tw:mb-3">
                    {{ t('about.title') }}
                </h1>
                <p class="tw:text-gray-500 tw:text-lg">{{ t('about.subtitle') }}</p>
            </div>

            <!-- 软件版本信息卡片 -->
            <div class="tw:bg-white tw:rounded-2xl tw:shadow-lg tw:p-8 tw:animate-fade-in-up">
                <h2 class="tw:text-xl tw:font-bold tw:text-gray-800 tw:text-center tw:mb-6 tw:flex tw:items-center tw:justify-center tw:gap-3">
                    <span class="tw:text-2xl"></span>
                    <span>{{ t('about.about_software') }}</span>
                </h2>
                <div class="tw:flex tw:flex-col tw:items-center tw:gap-6">
                    <!-- 当前版本号 -->
                    <div class="tw:flex tw:flex-col tw:items-center tw:gap-3">
                        <div class="tw:flex tw:items-center tw:gap-3">
                            <span class="tw:text-gray-600 tw:text-base">{{ t('about.current_version') }}</span>
                            <span class="tw:text-2xl tw:font-bold tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
                                {{ currentVersion }}
                            </span>
                        </div>
                    </div>

                    <!-- 构建时间和作者信息 -->
                    <div class="tw:flex tw:flex-col tw:items-center tw:gap-2 tw:text-gray-500 tw:text-sm">
                        <div class="tw:flex tw:items-center tw:gap-2">
                            <span>{{ t('about.build_time') }}</span>
                            <span class="tw:font-medium">{{ buildTime }}</span>
                        </div>
                        <div class="tw:flex tw:items-center tw:gap-2">
                            <span>{{ t('about.author') }}</span>
                            <span class="tw:font-medium">{{ author }}</span>
                        </div>
                    </div>

                    <!-- 更新按钮（已注释） -->
                    <!-- 
                    <div class="tw:mt-4">
                        <a-button
                            type="primary"
                            size="large"
                            :loading="checkingUpdate"
                            class="tw:h-12 tw:px-8 tw:rounded-full tw:font-medium tw:shadow-lg hover:shadow-xl tw:transition-all"
                            @click="checkUpdate"
                        >
                            <template #icon v-if="!checkingUpdate">
                                <SyncOutlined :spin="false" />
                            </template>
                            {{ checkingUpdate ? '检查中...' : '检查更新' }}
                        </a-button>
                    </div>

                    <div v-if="updateAvailable" class="tw:mt-2">
                        <a-alert
                            message="发现新版本"
                            :description="`最新版本：${latestVersion}`"
                            type="info"
                            show-icon
                            closable
                        />
                    </div>
                    -->
                </div>
            </div>

            <!-- 团队与感谢 -->
            <div class="tw:bg-white tw:rounded-2xl tw:shadow-lg tw:p-8 tw:animate-fade-in-up">
                <h2 class="tw:text-xl tw:font-bold tw:text-gray-800 tw:text-center tw:mb-8 tw:flex tw:items-center tw:justify-center tw:gap-3">
                    <span class="tw:text-2xl"></span>
                    <span>{{ t('about.development_team') }}</span>
                </h2>
                <div class="tw:grid tw:grid-cols-2 md:tw:grid-cols-3 lg:tw:grid-cols-5 tw:gap-6 tw:justify-items-center">
                    <div
                        v-for="item in thanksList"
                        :key="item.id"
                        class="tw:flex tw:flex-col tw:items-center tw:w-36 tw:p-5 tw:bg-gradient-to-br tw:from-white tw:to-gray-50 tw:rounded-2xl tw:shadow-sm tw:transition-all duration-300 hover:shadow-xl hover:-translate-y-2 tw:border tw:border-gray-100 tw:group"
                    >
                        <div class="tw:w-20 tw:h-20 tw:bg-gradient-to-br tw:from-emerald-100 tw:to-cyan-100 tw:rounded-full tw:overflow-hidden tw:flex tw:items-center tw:justify-center tw:mb-4 tw:ring-2 tw:ring-emerald-200 tw:ring-offset-2 tw:group-hover:tw:ring-emerald-400 tw:transition-all duration-300">
                            <img class="tw:w-full tw:h-full tw:object-cover" :src="item.avatar" :alt="item.name">
                        </div>
                        <h3 class="tw:text-sm tw:font-bold tw:text-gray-800 tw:group-hover:tw:text-emerald-600 tw:transition-colors">{{ item.name }}</h3>
                        <p class="tw:text-xs tw:text-gray-500 tw:mt-2">{{ item.contribution }}</p>
                        <!-- B站链接按钮 -->
                        <a-button
                            v-if="item.bilibiliUrl"
                            type="link"
                            size="small"
                            class="tw:text-xs tw:mt-3 tw:px-3 tw:py-1 tw:rounded-full tw:bg-gradient-to-r tw:from-pink-100 tw:to-pink-200 tw:text-pink-600 tw:hover:tw:from-pink-200 tw:hover:tw:to-pink-300 tw:transition-all"
                            @click="openBilibili(item.bilibiliUrl)"
                        >
                            B站
                        </a-button>
                    </div>
                </div>
            </div>

            <!-- 分隔线 -->
            <div class="tw:tw:py-6">
                <div class="tw:w-full tw:h-px tw:bg-gradient-to-r tw:from-transparent tw:via-gray-300 tw:to-transparent"></div>
            </div>

            <!-- 赞助商广告位 -->
            <div class="tw:bg-white tw:rounded-2xl tw:shadow-lg tw:p-8 tw:animate-fade-in-up tw:delay-100">
                <h1 class="tw:text-xl tw:text-center tw:font-bold tw:bg-gradient-to-r tw:from-amber-500 tw:to-orange-500 tw:bg-clip-text tw:text-transparent tw:mb-8 tw:flex tw:items-center tw:justify-center tw:gap-3">
                    <span class="tw:text-2xl">💎</span>
                    <span>{{ t('about.sponsor') }}</span>
                </h1>
                <div class="tw:flex tw:flex-wrap tw:justify-center tw:gap-6">
                    <div
                        v-for="sponsor in sponsors"
                        :key="sponsor.id"
                        class="tw:flex tw:flex-col tw:items-center tw:w-44 tw:p-5 tw:bg-gradient-to-br tw:from-amber-50 tw:to-orange-50 tw:rounded-2xl tw:shadow-md tw:cursor-pointer tw:hover:shadow-2xl tw:hover:-translate-y-2 tw:transition-all duration-300 tw:group tw:border tw:border-amber-100"
                        @click="contant(sponsor)"
                    >
                        <div class="tw:w-24 tw:h-24 tw:flex tw:items-center tw:justify-center tw:bg-gradient-to-br tw:from-white tw:to-amber-100 tw:rounded-2xl tw:p-3 tw:mb-4 tw:group-hover:tw:scale-110 tw:transition-transform duration-300">
                            <img class="tw:max-w-full tw:max-h-full tw:object-contain" :src="sponsor.imageUrl" :alt="sponsor.name">
                        </div>
                        <h2 class="tw:text-base tw:font-bold tw:text-gray-800 tw:group-hover:tw:text-amber-600 tw:transition-colors">{{ sponsor.name }}</h2>
                        <span class="tw:text-xs tw:text-amber-600 tw:bg-amber-100 tw:px-3 tw:py-1 tw:rounded-full tw:mt-3 tw:font-medium">
                            {{ sponsor.type }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* 淡入动画 */
@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* 向上淡入动画 */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.tw-animate-fade-in {
    animation: fadeIn 0.6s ease-out;
}

.tw-animate-fade-in-up {
    animation: fadeInUp 0.6s ease-out;
}

.delay-100 {
    animation-delay: 0.1s;
}
</style>