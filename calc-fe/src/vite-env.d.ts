/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MODEL_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
