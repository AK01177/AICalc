interface MathJaxInstance {
    typesetPromise?: () => Promise<void>;
    startup?: {
        defaultReady?: () => void;
    };
    Hub?: {
        Queue: (args: [string, unknown]) => void;
    };
    [key: string]: unknown;
}

declare global {
    interface Window {
        MathJax: MathJaxInstance;
    }
}

export {};
