import { ref } from 'vue';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface DragDropPayload {
    paths: string[];
}

export function useDragDrop() {
    const droppedFilePaths = ref<string[]>([]);
    const isDragOver = ref(false);
    let unlisten: UnlistenFn | null = null;

    async function setupDragDropListener() {
        unlisten = await listen<DragDropPayload>('tauri://drag-drop', (event) => {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
                droppedFilePaths.value = paths;
            }
            isDragOver.value = false;
        });

        await listen('tauri://drag-enter', () => {
            isDragOver.value = true;
        });

        await listen('tauri://drag-leave', () => {
            isDragOver.value = false;
        });
    }

    function clearDroppedFile() {
        droppedFilePaths.value = [];
    }

    function cleanup() {
        if (unlisten) {
            unlisten();
            unlisten = null;
        }
    }

    return {
        droppedFilePaths,
        isDragOver,
        setupDragDropListener,
        clearDroppedFile,
        cleanup
    };
}