import { ref } from 'vue';
import { Events } from '@wailsio/runtime';

const droppedFilePaths = ref<string[]>([]);
const isDragOver = ref(false);
let setupDone = false;

export function useDragDrop() {
    function setupDragDropListener() {
        if (setupDone) return;
        setupDone = true;

        Events.On("file_drop", (paths: string[]) => {
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
