/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

declare const __BUILD_STAMP__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
