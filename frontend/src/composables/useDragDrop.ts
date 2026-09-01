import { ref } from 'vue';
import { Events } from '@wailsio/runtime';
import { eventData } from '@/utils/wailsEvent';

const droppedFilePaths = ref<string[]>([]);
const isDragOver = ref(false);
let setupDone = false;

export function useDragDrop() {
    function setupDragDropListener() {
        if (setupDone) return;
        setupDone = true;

        Events.On("file_drop", (ev: any) => {
            const payload = eventData<string[] | { data?: string[] }>(ev);
            const paths: string[] = Array.isArray(payload)
                ? payload
                : (Array.isArray((payload as any)?.data) ? (payload as any).data : []);
            if (paths && paths.length > 0) {
                droppedFilePaths.value = [...paths];
            }
            isDragOver.value = false;
        });
    }

    function clearDroppedFile() {
        droppedFilePaths.value = [];
    }

    function cleanup() {}

    return {
        droppedFilePaths,
        isDragOver,
        setupDragDropListener,
        clearDroppedFile,
        cleanup
    };
}
