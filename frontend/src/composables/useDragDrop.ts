import { ref } from 'vue';
import { Events } from '@wailsio/runtime';

interface FileDropDetails {
    ElementID: string;
    ClassList: string[];
    X: number;
    Y: number;
}

interface FileDropPayload {
    files: string[];
    details: FileDropDetails | null;
}

export function useDragDrop() {
    const droppedFilePaths = ref<string[]>([]);
    let offFn: (() => void) | null = null;

    async function setupDragDropListener() {
        offFn = Events.On('files-dropped', (event: { data: FileDropPayload }) => {
            const { files } = event.data;
            if (files && files.length > 0) {
                droppedFilePaths.value = files;
            }
        });
    }

    function clearDroppedFile() {
        droppedFilePaths.value = [];
    }

    function cleanup() {
        if (offFn) {
            offFn();
            offFn = null;
        }
    }

    return {
        droppedFilePaths,
        setupDragDropListener,
        clearDroppedFile,
        cleanup
    };
}
