<script lang="ts" setup>
import { nextTick, ref, VNodeRef } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { message, StepsProps } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam, Upload } from 'ant-design-vue';
import * as shell from '@tauri-apps/plugin-shell';
interface IWSM {
    status: "unzip"|"pending"|"changed",
    result: string
}
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
    if (!FileList.value[0].originFileObj){
        return;
    }
    runDeEarthX(FileList.value[0].originFileObj) //获取文件内容
    BtnisDisabled.value = true; //禁用按钮
    disp_steps.value = true; //开始显示进度条
}

function reactFL() {
    FileList.value = [];
    isDisabled.value = false;
}
/* 获取文件区 */
shell.Command.create('core',['start']).spawn()
function runDeEarthX(data: Blob) {
    console.log(data)
    const fd = new FormData();
    fd.append('file', data);
    console.log(fd.getAll('file'))
        fetch('http://localhost:37019/start',{
        method:'POST',
        body:fd
    }).then(async res=>res.json()).then(res=>{
       prews(res)
    })
    // shell.Command.create('core',['start',new BigUint64Array(data).toString()]).stdout.on('data',(data)=>{
    //     console.log(data)
    // })
    reactFL()
}

function prews(res: object){
    const ws = new WebSocket('ws://localhost:37019/')
        ws.addEventListener('message',(wsm)=>{
           const _data = JSON.parse(wsm.data) as IWSM
           if (_data.status === "changed") {
               setyps_current.value ++;
           }
           logs.value.push({message:_data.result})
        })
}

/* 日志区 */
const logs = ref<{message:string}[]>([]);
//logs.value.push({message:"114514"})
const logContainer = ref<HTMLDivElement>();
nextTick(()=>{
if(logContainer.value){
logContainer.value.scrollTop = logContainer.value.scrollHeight;
}
})
</script>
<template>
    <div class="tw:h-full tw:w-full tw:relative">
        <div class="tw:h-full tw:w-full tw:flex tw:flex-col tw:justify-center tw:items-center">
            <div>
                <h1 class="tw:text-4xl tw:text-center tw:animate-pulse">DeEarthX</h1>
                <h1 class="tw:text-sm tw:text-gray-500 tw:text-center">让开服变成随时随地的事情！</h1>
            </div>
            <a-upload-dragger :disabled="isDisabled" class="tw:w-144 tw:h-48" name="file" action="/" :multiple="false"
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
        <div v-if="disp_steps" ref="logContainer" class="tw:absolute tw:right-2 tw:bottom-20 tw:h-96 tw:w-56 tw:bg-gray-200 tw:rounded-xl tw:container tw:overflow-y-auto">
               <div v-for="log in logs" class="tw:mt-2 tw:last:mb-0">
                <span class="tw:text-blue-500">{{ log.message }}</span>
               </div>
        </div>
    </div>

</template>