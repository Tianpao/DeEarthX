export interface Template {
    id: string;
    metadata: {
        name: string;
        version: string;
        description: string;
        author: string;
        created: string;
        type: string;
    };
}

export interface ProgressStatus {
    status: 'active' | 'success' | 'exception' | 'normal';
    percent: number;
    display: boolean;
    uploadedSize?: number;
    totalSize?: number;
    speed?: number;
    remainingTime?: number;
}

export interface ServerInstallInfo {
    modpackName: string;
    minecraftVersion: string;
    loaderType: string;
    loaderVersion: string;
    currentStep: string;
    stepIndex: number;
    totalSteps: number;
    message: string;
    status: 'idle' | 'installing' | 'completed' | 'error';
    error: string;
    installPath: string;
    duration: number;
}

export interface FilterModsInfo {
    totalMods: number;
    currentMod: number;
    modName: string;
    filteredCount: number;
    movedCount: number;
    status: 'idle' | 'filtering' | 'completed' | 'error';
    error: string;
    duration: number;
}

export interface MinecraftVersion {
    id: string;
    type: 'release' | 'snapshot';
}

export interface LoaderVersion {
    version: string;
    mcversion?: string;
    hash?: string;
    installerPath?: string;
    stable?: boolean;
}
