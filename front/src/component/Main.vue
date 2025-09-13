<script lang="ts" setup>
import { ref } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { message, StepsProps } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam } from 'ant-design-vue';
/* 进度显示区 */
const disp_steps = ref(true);
const setyps_current = ref(0);
const setps_items: StepsProps['items'] = [{
    title: '解压整合包',
    description: '解压内容 下载文件'
}, {
    title: '筛选模组',
    description: 'DeEarthX的心脏'
}, {
    title: '下载服务端',
    description: '安装模组加载器服务端'
}, {
    title: '完成',
    description: '一切就绪！'
}]

/* 进度显示区 */

/* 获取文件区 */
const FileList = ref<UploadFile[]>([]);
const isDisabled = ref(false);
const BtnisDisabled = ref(false);
function beforeUpload() {
    return false;
}

function handleChange(info: UploadChangeParam) {
    if (!info.file.name?.endsWith('.zip') && !info.file.name?.endsWith('.mrpack')) {
        message.error('只能上传.zip和.mrpack文件');
        return;
    }
    isDisabled.value = true; //禁用
}
function handleDrop(e: DragEvent) {
    console.log(e);
}
function handleUpload() {
    if (FileList.value.length === 0) {
        message.warning('请先拖拽或选择文件')
        return
    }
    let data: ArrayBuffer[] = [];
    FileList.value[0].originFileObj?.arrayBuffer().then(buffer => {data=[buffer];console.log(data);}) //获取文件内容
    console.log(data);
    BtnisDisabled.value = true; //禁用按钮
    disp_steps.value = true; //开始显示进度条
}

function runDeEarthX() {
    reactFL()
}

function reactFL() {
    FileList.value = [];
    isDisabled.value = false;
}
runDeEarthX();
/* 获取文件区 */
</script>
<template>
    <div class="tw:h-full tw:w-full">
        <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:justify-center tw:items-center">
            <div>
                <h1 class="tw:text-4xl tw:text-center tw:animate-pulse">DeEarthX</h1>
                <h1 class="tw:text-sm tw:text-gray-500 tw:text-center">让开服变成随时随地的事情！</h1>
            </div>
            <a-upload-dragger :disabled="isDisabled" class="tw:w-128 tw:h-48" name="file" action="/" :multiple="false"
                :before-upload="beforeUpload" @change="handleChange" @drop="handleDrop" v-model:fileList="FileList"
                accept=".zip,.mrpack">
                <p class="ant-upload-drag-icon">
                    <inbox-outlined></inbox-outlined>
                </p>
                <p class="ant-upload-text">拖拽或点击以上传文件</p>
                <p class="ant-upload-hint">
                    请使用.zip（CurseForge、MCBBS）和.mrpck（Modrinth）文件
                </p>
            </a-upload-dragger>
            <a-button :disabled="BtnisDisabled" type="primary" @click="handleUpload" style="margin-top: 32px">
                开始
            </a-button>
        </div>
        <div v-if="disp_steps"
            class="tw:fixed tw:bottom-2 tw:ml-4 tw:w-272 tw:h-16 tw:flex tw:justify-center tw:items-center tw:text-sm">
            <a-steps :current="setyps_current" :items="setps_items" />
        </div>
    </div>
</template>