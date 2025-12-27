<template>
    <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:justify-center tw:items-center">
        <div class="tw:w-32 tw:h-32 tw:mb-25">
            <svg class="w-32 h-32 mb-4" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="#ef4444" />
                <path d="M40,40 L80,80 M80,40 L40,80" stroke="white" stroke-width="10" stroke-linecap="round" />
            </svg>
            <p class="tw:text-2xl tw:font-bold tw:text-center tw:mb-20 tw:text-red-500">Error</p>
            <p class="tw:text-sm tw:text-center tw:text-gray-500">
                {{ errorMessage }}
            </p>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { useRoute } from 'vue-router';

const route = useRoute();
const errorReason = route.query.e as string;
const errorMessage = errorReason ? `错误原因：${errorReason}` : 'DeEarthX.Core 启动失败！';
</script>

<style lang="css" scoped></style>