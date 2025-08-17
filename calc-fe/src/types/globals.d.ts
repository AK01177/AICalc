interface MathJaxStartup {
    defaultReady: () => void;
}

interface MathJaxHub {
    Queue: (args: [string, unknown]) => void;
}

interface MathJaxConfig {
    loader?: {
        load?: string[];
    };
    tex?: {
        inlineMath?: Array<[string, string]>;
        displayMath?: Array<[string, string]>;
        packages?: string[];
    };
    chtml?: {
        scale?: number;
        minScale?: number;
    };
    startup?: {
        ready?: () => void;
    };
}

declare global {
    interface Window {
        MathJax: {
            typesetPromise?: () => Promise<void>;
            startup?: {
                defaultReady?: () => void;
            };
            Hub?: {
                Queue: (args: [string, unknown]) => void;
            };
            [key: string]: unknown;
        };
    }
}
