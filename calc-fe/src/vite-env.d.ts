
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
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
        Config: (config: Record<string, unknown>) => void;
      };
      [key: string]: unknown;
    };
  }
}
