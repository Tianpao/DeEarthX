<script lang="ts" setup>
import { h, ref } from 'vue';
import { MenuProps } from 'ant-design-vue';
import { SettingOutlined, UserOutlined, WindowsOutlined } from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import * as shell from '@tauri-apps/plugin-shell';
const router = useRouter();
const selectedKeys = ref(['main']);
const items: MenuProps['items'] = [
    {
        key: 'main',
        icon: h(WindowsOutlined),
        label: '主页',
        title: '主页',
    },
    {
        key: 'setting',
        icon: h(SettingOutlined),
        label: '设置',
        title: '设置',
    },
    {
        key: 'about',
        icon: h(UserOutlined),
        label: '关于',
        title: '关于',
    }
]
const handleClick: MenuProps['onClick'] = (e) => {
    switch (e.key) {
        case 'main':
            selectedKeys.value[0] = 'main';
            router.push('/');
            break;
        case 'setting':
            selectedKeys.value[0] = 'setting';
            router.push('/setting');
            break;
        case 'about':
            selectedKeys.value[0] = 'about';
            router.push('/about');
            break;
        default:
            break;
    }
}
</script>

<template>
    <div class="tw:h-screen tw:w-screen">
        <a-page-header class="tw:fixed tw:h-16" style="border: 1px solid rgb(235, 237, 240)" title="DeEarthX"
            sub-title="V3" />
        <div class="tw:flex tw:full tw:h-89/100">
            <a-menu id="menu" style="width: 144px;" :selectedKeys="selectedKeys" mode="inline" :items="items" @click="handleClick"/>
            <RouterView />
        </div>
    </div>
</template>


<style scoped></style>