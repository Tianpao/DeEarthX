<script lang="ts" setup>
import { h, ref } from 'vue';
import { MenuProps, message } from 'ant-design-vue';
import { SettingOutlined, UserOutlined, WindowsOutlined } from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import * as shell from '@tauri-apps/plugin-shell';

import { invoke } from "@tauri-apps/api/core";
async function contant(){
    await invoke("open_url",{url:"https://space.bilibili.com/1728953419"})
}

//屏蔽右键菜单
document.oncontextmenu = function (event: any) {
    try {
        var the = event.srcElement
        if (
            !(
                (the.tagName == 'INPUT' && the.type.toLowerCase() == 'text') ||
                the.tagName == 'TEXTAREA'
            )
        ) {
            return false
        }
        return true
    } catch (e) {
        return false
    }
}

/* 启动后端 */
message.loading("DeEarthX.Core启动中，此过程中请勿执行任何操作......").then(()=>{
    shell.Command.create("core").spawn().then(()=>{
        message.success("DeEarthX.Core 启动成功")
        console.log(`DeEarthX V3 Core`)
    }).catch((e)=>{
        console.log(e)
        message.error("DeEarthX.Core 启动失败，请检查37019是否被占用！")
    })
})
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

const theme = ref({
    "token": {
        "colorPrimary": "#67eac3",
    }
})
</script>

<template>
    <a-config-provider :theme="theme">
        <div class="tw:h-screen tw:w-screen">
            <a-page-header class="tw:fixed tw:h-16" style="border: 1px solid rgb(235, 237, 240)" title="DeEarthX"
                sub-title="V3" :avatar="{ src: './public/dex.png' }">
                <template #extra>
                    <a-button @click="contant">作者B站</a-button>
                </template>
            </a-page-header>
            <div class="tw:flex tw:full tw:h-89/100">
                <a-menu id="menu" style="width: 144px;" :selectedKeys="selectedKeys" mode="inline" :items="items"
                    @click="handleClick" />
                <RouterView />
            </div>
        </div>
    </a-config-provider>
</template>


<style>
 /* 禁止选择文本的样式 */
        h1,li,p,span {
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select:none;
        }
        
        /* 禁止拖拽图片 */
        img {
            -webkit-user-drag: none;
            -moz-user-drag: none;
            -ms-user-drag: none;
        }
</style>