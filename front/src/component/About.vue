<script lang="ts" setup>
import { invoke } from "@tauri-apps/api/core";

// 赞助商数据数组
const sponsors = [
  {
    id: "elfidc",
    name: "亿讯云",
    imageUrl: "./elfidc.svg",
    type: "金牌赞助",
    url: "https://www.elfidc.com"
  }
];

// 感谢列表数据数组
const thanksList = [
  {
    id: "user",
    name: "天跑",
    avatar: "./tianpao.jpg",
    contribution: "作者"
  },
    {
    id: "mirror",
    name: "bangbang93",
    avatar: "./bb93.jpg",
    contribution: "BMCLAPI镜像"
  },{
    id: "mirror",
    name: "z0z0r4",
    avatar: "./z0z0r4.jpg",
    contribution: "MCIM镜像"
  }
];

async function contant(sponsor: any){
    await invoke("open_url",{url: sponsor.url})
}
</script>

<template>
    <div class="tw:h-full tw:w-full tw:p-6 tw:bg-gradient-to-br tw:from-gray-50 tw:to-gray-100">
        <div class="tw:w-full tw:h-full tw:max-w-4xl tw:mx-auto"> <!-- 主要内容 -->
                <!-- 感谢列表 -->
                <div class="tw:space-y-6">
                    <h2 class="tw:text-xl tw:font-bold tw:text-gray-800 tw:text-center tw:mb-4">团队与感谢</h2>
                    <div class="tw:flex tw:flex-wrap tw:justify-center tw:gap-4">
                        <div 
                            v-for="item in thanksList" 
                            :key="item.id"
                            class="tw:flex tw:flex-col tw:items-center tw:w-28 tw:p-2 tw:bg-white tw:rounded-lg tw:shadow-sm tw:transition-all duration-300 hover:shadow-md hover:-translate-y-1"
                        >
                            <div class="tw:w-16 tw:h-16 tw:bg-gray-50 tw:rounded-full tw:overflow-hidden tw:flex tw:items-center tw:justify-center tw:mb-2">
                                <img class="tw:w-full tw:h-full tw:object-cover" :src="item.avatar" :alt="item.name">
                            </div>
                            <h3 class="tw:text-xs tw:font-semibold tw:text-gray-800">{{ item.name }}</h3>
                            <p class="tw:text-xs tw:text-gray-500 tw:mt-1">{{ item.contribution }}</p>
                        </div>
                    </div>
                </div>

            <!-- 分隔线 -->
            <div class="tw:my-10">
                <div class="tw:w-full tw:h-0.5 tw:bg-gradient-to-r tw:from-transparent tw:via-gray-300 tw:to-transparent"></div>
            </div>

            <!-- 赞助商广告位 - 放在下面 -->
            <h1 class="tw:text-xl tw:text-center tw:font-bold tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent tw:mb-5 tw:mt-2">
                赞助商广告位
            </h1>
            <div class="tw:flex tw:flex-wrap tw:justify-center tw:gap-5 tw:mt-2">
                <div 
                    v-for="sponsor in sponsors" 
                    :key="sponsor.id" 
                    class="tw:flex tw:flex-col tw:items-center tw:w-36 tw:p-2 tw:bg-white tw:rounded-lg tw:shadow-md tw:cursor-pointer tw:hover:shadow-lg tw:hover:-translate-y-1 transition-all duration-300"
                    @click="contant(sponsor)"
                >
                    <div class="tw:w-20 tw:h-20 tw:flex tw:items-center tw:justify-center tw:bg-gradient-to-br tw:from-gray-50 tw:to-gray-100 tw:rounded-full tw:p-2 tw:mb-2">
                        <img class="tw:max-w-full tw:max-h-full tw:object-contain" :src="sponsor.imageUrl" :alt="sponsor.name">
                    </div>
                    <h2 class="tw:text-sm tw:font-semibold tw:text-gray-800">{{ sponsor.name }}</h2>
                    <span class="tw:text-xs tw:text-yellow-500 tw:bg-yellow-50 tw:px-1.5 tw:py-0.5 tw:rounded-full mt-1">
                        {{ sponsor.type }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>