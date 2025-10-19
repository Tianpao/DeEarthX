<script lang="ts" setup>
import { ref } from 'vue';
import { InboxOutlined } from '@ant-design/icons-vue';
import { message, StepsProps } from 'ant-design-vue';
import type { UploadFile, UploadChangeParam } from 'ant-design-vue';
import {sendNotification,} from '@tauri-apps/plugin-notification';
import { SelectProps } from 'ant-design-vue/es/vc-select';
interface IWSM {
    status: "unzip"|"finish"|"changed"|"downloading"|"error",
    result: any
}
/* 进度显示区 */
const disp_steps = ref(false);
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
    isDisabled.value = true; //禁用上传
    disp_steps.value = true; //开始显示进度条
}

function reactFL() {
    FileList.value = [];
    isDisabled.value = false;
    BtnisDisabled.value = false;
    disp_steps.value = false; //关闭进度条
}
/* 获取文件区 */
function runDeEarthX(data: Blob) {
    //console.log(data)
    message.success("开始制作,请勿切换菜单！");
    const fd = new FormData();
    fd.append('file', data);
    console.log(fd.getAll('file'))
        fetch(`http://localhost:37019/start?mode=${Cselect.value}`,{
        method:'POST',
        body:fd
    }).then(async res=>res.json()).then(()=>{
       prews()
    })
}
const prog = ref({status:"active",percent:0,display:true})
const dprog = ref({status:"active",percent:0,display:true})
const CanO = ref(true);
function prews(){
    const ws = new WebSocket('ws://localhost:37019/')
        // ws.addEventListener('message',(wsm)=>{
        //    const _data = JSON.parse(wsm.data) as IWSM
        //    if (_data.status === "changed") {
        //        setyps_current.value ++;
        //    }
        //    logs.value.push({message:_data.result})
        // })
        ws.addEventListener('message',(wsm)=>{
            const _data = JSON.parse(wsm.data) as IWSM
            //console.log(_data)
            if (_data.status === "error" && _data.result === "jini") {
                CanO.value = false;
                message.error("未在系统变量中找到Java！请安装Java！否则开服模式将无法使用！")
            }
           if (_data.status === "changed") { //状态更改
               setyps_current.value ++;
           }
            if (_data.status === "unzip"){ //解压ZIP
              prog.value.percent = Math.round(((_data.result.current / _data.result.total) * 100))
              if (_data.result.current === _data.result.total){
              prog.value.status = "succees"
                setTimeout(()=>{
                 prog.value.display = false;
                },2000)
              }
            }
            if (_data.status === "downloading"){ //下载文件
                dprog.value.percent = Math.round((_data.result.index / _data.result.total) * 100)
                if(dprog.value.percent === 100){
                    dprog.value.status = "succees"
                    setTimeout(()=>{
                        dprog.value.display = false;
                    },2000)
                }
            }
            if (_data.status === "finish"){
                console.log(_data.result)
                const time = Math.round(_data.result / 1000)
                setyps_current.value ++;
                message.success(`服务端制作完成！共用时${time}秒！`)
                sendNotification({ title: 'DeEarthX V3', body: `服务端制作完成！共用时${time}秒！` });
                setTimeout(()=>{ //恢复状态
                    reactFL()
                },8*1000)
            }
        })
}

/* 选择区 */
const Moptions = ref<SelectProps['options']>([
    {
        label: '开服模式',
        value: 'server',
        disabled: CanO.value ? false : true
    },
    {
        label: '上传模式',
        value: 'upload',
        disabled: false
    }
])

const Cselect = ref(CanO ? 'server' : 'upload')

function handleSelect(value: string) {
    Cselect.value = value;
}
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
               <a-select
      ref="select"
      :options="Moptions"
      :value="Cselect"
      style="width: 120px;margin-top: 32px"
      @select="handleSelect"
    ></a-select>
            <a-button :disabled="BtnisDisabled" type="primary" @click="handleUpload" style="margin-top: 6px">
                开始
            </a-button>
        </div>
        <div v-if="disp_steps"
            class="tw:fixed tw:bottom-2 tw:ml-4 tw:w-272 tw:h-16 tw:flex tw:justify-center tw:items-center tw:text-sm">
            <a-steps :current="setyps_current" :items="setps_items" />
        </div>
        <!-- <div class="tw:absolute tw:bottom-20 tw:right-2 tw:h-16 tw:w-16">
       
        </div> -->
        <div v-if="disp_steps" ref="logContainer" class="tw:absolute tw:right-2 tw:bottom-20 tw:h-80 tw:w-56 tw:rounded-xl tw:container tw:overflow-y-auto">
                <a-card title="制作进度" :bordered="true">
                    <div v-if="prog.display">
                  <h1>解压进度</h1>
                  <a-progress :percent="prog.percent" :status="prog.status" size="small" />
                  </div>
                  <div v-if="dprog.display">
                  <h1>下载进度</h1>
                  <a-progress :percent="dprog.percent" :status="dprog.status" size="small" />
                  </div>
            </a-card>
        </div>
    </div>

</template>