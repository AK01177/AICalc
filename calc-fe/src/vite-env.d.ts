/// <reference types="vite/client" />

/* Optional env vars surfaced to the browser (must be prefixed with VITE_ in .env). */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_MODEL_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
