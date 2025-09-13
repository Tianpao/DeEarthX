<script lang="ts" setup>
import { ref } from 'vue';
import * as fs from "@tauri-apps/plugin-store"
const config = ref({})

const checked = ref(false);
</script>

<template>
    <div class="tw:h-full tw:w-full">
        <h1 class="tw:text-3xl tw:font-black tw:tracking-tight tw:text-center">
            <span class="tw:bg-gradient-to-r tw:from-emerald-500 tw:to-cyan-500 tw:bg-clip-text tw:text-transparent">
                DeEarth X
            </span>
            <span>设置</span>
        </h1>
        <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
        <!-- DeEarth设置 -->
        <h1 class="tw:text-xl tw:font-black tw:tracking-tight tw:text-center">模组筛选设置</h1>
        <div class="tw:flex">
            <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">哈希过滤</p>
                <a-switch class="tw:left-2" v-model:checked="checked" />
            </div>
            <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">DeP过滤</p>
                <a-switch class="tw:left-2" v-model:checked="checked" />
            </div>
            <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">Mixin过滤</p>
                <a-switch class="tw:left-2" v-model:checked="checked" />
            </div>
        </div>
        <!-- DeEarth设置 -->
        <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
        <!-- 下载源设置 -->
          <h1 class="tw:text-xl tw:font-black tw:tracking-tight tw:text-center">下载源设置</h1>
          <div class="tw:flex">
                         <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">MCIM镜像源</p>
                <a-switch class="tw:left-2" v-model:checked="checked" />
            </div>
          </div>
    </div>
</template>