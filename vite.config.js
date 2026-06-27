import { defineConfig } from 'vite';
export default defineConfig({base:'/namioshi/',build:{sourcemap:false,target:'es2020',assetsInlineLimit:2048,chunkSizeWarningLimit:800,rollupOptions:{output:{manualChunks:undefined}}}});
