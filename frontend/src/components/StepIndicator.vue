<script lang="ts" setup>
import type { StepsProps } from 'ant-design-vue';

interface Props {
    current: number;
    items: Required<StepsProps>['items'];
}

defineProps<Props>();
</script>

<template>
    <div class="tw:fixed tw:bottom-2 tw:left-1/2 tw:-translate-x-1/2 tw:w-[65%] tw:h-20 tw:flex tw:justify-center tw:items-center tw:text-sm tw:bg-white tw:rounded-xl tw:shadow-lg tw:px-4 tw:ml-10">
        <a-steps :current="current" :items="items" size="small" />
    </div>
</template>
