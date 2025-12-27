<script lang="ts" setup>
import { invoke } from "@tauri-apps/api/core";

// 赞助商数据数组
const sponsors = [
  {
    id: "elfidc",
    name: "亿讯云",
    imageUrl: "../src/assets/elfidc.svg",
    type: "金牌赞助",
    url: "https://www.elfidc.com"
  }
];

async function contant(sponsor: any){
    await invoke("open_url",{url: sponsor.url})
}
</script>

<template>
    <div class="tw:h-full tw:w-full tw:p-6 tw:bg-gradient-to-br tw:from-gray-50 tw:to-gray-100">
        <div class="tw:w-full tw:h-full tw:max-w-4xl tw:mx-auto"> <!-- 广告位 -->
            <h1 class="tw:text-2xl tw:text-center tw:font-bold tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent tw:mb-6 tw:mt-2">
                赞助商广告位
            </h1>
            <div class="tw:flex tw:flex-wrap tw:justify-center tw:gap-6 tw:mt-2">
                <div 
                    v-for="sponsor in sponsors" 
                    :key="sponsor.id" 
                    class="tw:flex tw:flex-col tw:items-center tw:w-40 tw:p-3 tw:bg-white tw:rounded-xl tw:shadow-lg tw:cursor-pointer tw:hover:shadow-xl tw:hover:-translate-y-1 transition-all duration-300"
                    @click="contant(sponsor)"
                >
                    <div class="tw:w-24 tw:h-24 tw:flex tw:items-center tw:justify-center tw:bg-gradient-to-br tw:from-gray-50 tw:to-gray-100 tw:rounded-full tw:p-3 tw:mb-2">
                        <img class="tw:max-w-full tw:max-h-full tw:object-contain" :src="sponsor.imageUrl" :alt="sponsor.name">
                    </div>
                    <h2 class="tw:text-base tw:font-semibold tw:text-gray-800">{{ sponsor.name }}</h2>
                    <span class="tw:text-xs tw:text-yellow-500 tw:bg-yellow-50 tw:px-2 tw:py-1 tw:rounded-full mt-1">
                        {{ sponsor.type }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>