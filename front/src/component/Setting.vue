<script lang="ts" setup>
import { ref, watch } from 'vue';
import { message } from 'ant-design-vue';
/* Config */
interface IConfig {
  mirror: {
    bmclapi: boolean;
    mcimirror: boolean;
  };
  filter: {
    hashes: boolean;
    dexpub: boolean;
    mixins: boolean;
  };
}
const config = ref<IConfig>({mirror: {bmclapi: false, mcimirror: false}, filter: {hashes: false, dexpub: false, mixins: false}})
fetch('http://localhost:37019/config/get',{
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}).then(res=>res.json()).then(res=>config.value = res)

let first = true;
watch(config,(newv)=>{ //写入Config
    if(!first){
       fetch('http://localhost:37019/config/post',{
         method: 'POST',
         headers: {
          'Content-Type': 'application/json'
         },
         body: JSON.stringify(newv)
       }).then(res=>{
         if(res.status === 200){
           message.success('配置已保存')
         }
       })
    // shell.Command.create('core',['writeconfig',JSON.stringify(newv)]).execute().then(()=>{
    // message.success('配置已保存')
    // })
    console.log(newv)
    return
}
  first = false;
},{deep:true})
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
                <a-switch class="tw:left-2" v-model:checked="config.filter.hashes" />
            </div>
            <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">DeP过滤</p>
                <a-switch class="tw:left-2" v-model:checked="config.filter.dexpub" />
            </div>
            <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">Mixin过滤</p>
                <a-switch class="tw:left-2" v-model:checked="config.filter.mixins" />
            </div>
        </div>
        <!-- DeEarth设置 -->
        <div class="tw:border-t-2 tw:border-gray-400 tw:mt-6 tw:mb-2"></div>
        <!-- 下载源设置 -->
          <h1 class="tw:text-xl tw:font-black tw:tracking-tight tw:text-center">下载源设置</h1>
          <div class="tw:flex">
                         <div class="tw:flex tw:ml-5 tw:mt-2">
                <p class="tw:text-gray-600">MCIM镜像源</p>
                <a-switch class="tw:left-2" v-model:checked="config.mirror.mcimirror" />
            </div>
          </div>
    </div>
</template>