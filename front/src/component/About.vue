<script lang="ts" setup>
import { invoke } from "@tauri-apps/api/core";
async function contant(idc:string){
    let url:string = "";
    switch (idc){
        case "elfidc":
            url = "https://www.elfidc.com";
            break;
        default:
            break;
    }
    await invoke("open_url",{url})
}
</script>

<template>
    <div class="tw:h-full tw:w-full">
        <div class="w-full h-64"> <!-- 广告位 -->
            <h1 class="tw:text-2xl tw:text-center tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">赞助商广告位</h1>
            <div class="tw:flex tw:flex-col tw:w-30 tw:h-30 tw:ml-5 tw:mt-2" @click="contant('elfidc')"> <!-- 亿讯云 -->
                <img class="tw:w-24 tw:h-24" src="../assets/elfidc.svg"></img>
                <h1 class="tw:text-sm tw:text-center tw:text-yellow-400">亿讯云（金牌赞助）</h1>
            </div>
        </div>
    </div>
</template>