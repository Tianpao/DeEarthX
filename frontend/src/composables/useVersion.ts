import { ref, onMounted } from 'vue';

export function useVersion() {
    const version = ref<string>('V3');

    async function loadVersion() {
        try {
            console.log('开始加载版本号...');
            const response = await fetch('/version.json');
            console.log('version.json 响应状态:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('版本号数据:', data);
            version.value = `V${data.version}`;
            console.log('设置版本号为:', version.value);
        } catch (error) {
            console.error('加载版本号失败:', error);
            version.value = 'V3';
        }
    }

    onMounted(() => {
        loadVersion();
    });

    return {
        version
    };
}
