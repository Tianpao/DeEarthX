<template>
    <div class="tw:h-full tw:w-full tw:p-4 tw:overflow-auto tw:bg-gray-50">
        <div class="tw:max-w-2xl tw:mx-auto">
            <!-- 标题区域 -->
            <div class="tw:text-center tw:mb-8">
                <h1 class="tw:text-2xl tw:font-bold tw:tracking-tight">
                    <span
                        class="tw:bg-gradient-to-r tw:from-cyan-300 tw:to-purple-950 tw:bg-clip-text tw:text-transparent">
                        Galaxy Square
                    </span>
                </h1>
                <p class="tw:text-gray-500 tw:mt-2">让所有的模组都在这里发光</p>
            </div>

            <!-- 模组提交 -->
            <div class="tw:bg-white tw:rounded-lg tw:shadow-sm tw:p-6 tw:mb-6">
                <h2 class="tw:text-lg tw:font-semibold tw:text-gray-800 tw:mb-4 tw:flex tw:items-center tw:gap-2">
                    <span class="tw:w-2 tw:h-2 tw:bg-purple-500 tw:rounded-full"></span>
                    模组提交
                </h2>
                <div class="tw:flex tw:flex-col tw:gap-4">
                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                            模组类型
                        </label>
                        <a-radio-group v-model:value="modType" size="default" button-style="solid">
                            <a-radio-button value="client">客户端模组</a-radio-button>
                            <a-radio-button value="server">服务端模组</a-radio-button>
                        </a-radio-group>
                    </div>

                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                            Modid
                        </label>
                        <a-input
                            v-model:value="modidInput"
                            placeholder="请输入 Modid（多个用逗号分隔）或上传文件自动获取"
                            size="large"
                            allow-clear
                        />
                        <p class="tw:text-xs tw:text-gray-400 tw:mt-1">
                            当前已添加 {{ modidList.length }} 个 Modid
                        </p>
                    </div>

                    <div>
                        <label class="tw:block tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                            上传文件
                        </label>
                        <a-upload-dragger
                            :fileList="fileList"
                            :before-upload="beforeUpload"
                            @remove="handleRemove"
                            accept=".jar"
                            multiple
                        >
                            <p class="tw-ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p class="tw-ant-upload-text">点击或拖拽文件到此区域上传</p>
                            <p class="tw-ant-upload-hint">
                                支持 .jar 格式文件，可多选
                            </p>
                        </a-upload-dragger>
                        
                        <div v-if="fileList.length > 0" class="tw:mt-4">
                            <p class="tw:text-sm tw:font-medium tw:text-gray-700 tw:mb-2">
                                已选择 {{ fileList.length }} 个文件
                            </p>
                            <a-button
                                type="primary"
                                size="large"
                                :loading="uploading"
                                block
                                @click="handleUpload"
                            >
                                <template #icon>
                                    <UploadOutlined />
                                </template>
                                {{ uploading ? '上传中...' : '开始上传' }}
                            </a-button>
                        </div>
                    </div>

                    <div v-if="modidList.length > 0" class="tw:mt-2">
                        <a-button
                            type="primary"
                            size="large"
                            :loading="submitting"
                            block
                            @click="handleSubmit"
                        >
                            <template #icon>
                                <SendOutlined />
                            </template>
                            {{ submitting ? '提交中...' : `提交${modType === 'client' ? '客户端' : '服务端'}模组` }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { UploadOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message, Modal } from 'ant-design-vue';
import type { UploadFile, UploadProps } from 'ant-design-vue';

const modType = ref<'client' | 'server'>('client');
const modidList = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const fileList = ref<UploadFile[]>([]);

const modidInput = computed({
    get: () => modidList.value.join(','),
    set: (value: string) => {
        modidList.value = value
            .split(',')
            .map(id => id.trim())
            .filter(id => id.length > 0);
    }
});

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    console.log(file.name);
    const uploadFile: UploadFile = {
        uid: `${Date.now()}-${Math.random()}`,
        name: file.name,
        status: 'done',
        url: '',
        originFileObj: file,
    };
    fileList.value = [...fileList.value, uploadFile];
    return false;
};

const handleRemove: UploadProps['onRemove'] = (file) => {
    const index = fileList.value.indexOf(file);
    const newFileList = fileList.value.slice();
    newFileList.splice(index, 1);
    fileList.value = newFileList;
};

const handleUpload = async () => {
    if (fileList.value.length === 0) {
        message.warning('请先选择文件');
        return;
    }

    uploading.value = true;

    const formData = new FormData();
    fileList.value.forEach((file) => {
        if (file.originFileObj) {
            const blob = file.originFileObj;
            const encodedFileName = encodeURIComponent(file.name);
            const fileWithCorrectName = new File([blob], encodedFileName, { type: blob.type });
            formData.append('files', fileWithCorrectName);
        }
    });

    try {
        const response = await fetch('http://localhost:37019/galaxy/upload', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const data = await response.json();
            console.log(data);
            if (data.modids && Array.isArray(data.modids)) {
                let addedCount = 0;
                data.modids.forEach((modid: string) => {
                    if (modid && !modidList.value.includes(modid)) {
                        modidList.value.push(modid);
                        addedCount++;
                    }
                });
                message.success(`成功上传 ${addedCount} 个文件`);
            } else {
                message.error('返回数据格式错误');
            }
        } else {
            message.error('上传失败');
        }
    } catch (error) {
        message.error('上传出错，请重试');
    } finally {
        uploading.value = false;
        fileList.value = [];
    }
};

const handleSubmit = () => {
    Modal.confirm({
        title: '确认提交',
        content: `确定要提交 ${modidList.value.length} 个${modType.value === 'client' ? '客户端' : '服务端'}模组吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
            submitting.value = true;
            try {
                const apiUrl = modType.value === 'client' 
                    ? 'http://localhost:37019/galaxy/submit/client' 
                    : 'http://localhost:37019/galaxy/submit/server';
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        modids: modidList.value,
                    }),
                });

                if (response.ok) {
                    message.success(`${modType.value === 'client' ? '客户端' : '服务端'}模组提交成功`);
                    modidList.value = [];
                } else {
                    message.error('提交失败');
                }
            } catch (error) {
                message.error('提交出错，请重试');
            } finally {
                submitting.value = false;
            }
        },
    });
};
</script>
