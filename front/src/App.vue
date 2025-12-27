<script lang="ts" setup>
import { h, ref } from 'vue';
import { MenuProps, message } from 'ant-design-vue';
import { SettingOutlined, UserOutlined, WindowsOutlined } from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import * as shell from '@tauri-apps/plugin-shell';
import { invoke } from "@tauri-apps/api/core";

// 打开作者B站空间
async function openAuthorBilibili() {
    await invoke("open_url", { url: "https://space.bilibili.com/1728953419" });
}

// 屏蔽右键菜单（输入框和文本域除外）
document.oncontextmenu = (event: any) => {
    try {
        const target = event.srcElement;
        const isInput = target.tagName === 'INPUT' && target.type.toLowerCase() === 'text';
        const isTextarea = target.tagName === 'TEXTAREA';
        return isInput || isTextarea;
    } catch {
        return false;
    }
};

const router = useRouter();

// 启动后端核心服务
message.loading("DeEarthX.Core启动中，请勿操作...").then(() => {
    shell.Command.create("core").spawn()
        .then(() => {
            // 检查后端服务是否成功启动
            fetch("http://localhost:37019/", { method: "GET" })
                .catch(() => router.push('/error'))
                .then(() => message.success("DeEarthX.Core 启动成功"));
            console.log("DeEarthX V3 Core");
        })
        .catch((error) => {
            console.error(error);
            message.error("DeEarthX.Core 启动失败，请检查37019端口是否被占用！");
        });
});

// 导航菜单配置
const selectedKeys = ref<(string | number)[]>(['main']);
const menuItems: MenuProps['items'] = [
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
];

// 菜单点击事件处理
const handleMenuClick: MenuProps['onClick'] = (e) => {
    selectedKeys.value[0] = e.key;
    const routeMap: Record<string, string> = {
        main: '/',
        setting: '/setting',
        about: '/about'
    };
    const route = routeMap[e.key] || '/';
    router.push(route);
};

// 主题配置
const theme = ref({
    token: {
        colorPrimary: '#67eac3',
    }
});
</script>

<template>
    <a-config-provider :theme="theme">
        <div class="tw:h-screen tw:w-screen">
            <a-page-header class="tw:fixed tw:h-16" style="border: 1px solid rgb(235, 237, 240)" title="DeEarthX"
                sub-title="V3" :avatar="{ src: './public/dex.png' }">
                <template #extra>
                    <a-button @click="openAuthorBilibili">作者B站</a-button>
                </template>
            </a-page-header>
            <div class="tw:flex tw:full tw:h-89/100">
                <a-menu id="menu" style="width: 144px;" :selectedKeys="selectedKeys" mode="inline" :items="menuItems"
                    @click="handleMenuClick" />
                <RouterView />
            </div>
        </div>
    </a-config-provider>
</template>


<style>
/* 禁止选择文本的样式 */
h1,
li,
p,
span {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}

/* 禁止拖拽图片 */
img {
    -webkit-user-drag: none;
    -moz-user-drag: none;
    -ms-user-drag: none;
}
</style>