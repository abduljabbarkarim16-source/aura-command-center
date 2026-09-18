import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      // When watching IS enabled, src-tauri must be excluded: chokidar otherwise
      // recurses into src-tauri/target/ and crashes with EBUSY on Rust build
      // artifacts that cargo holds open (e.g. target/debug/deps/app_lib.dll),
      // which takes down the dev server and fails tauri's beforeDevCommand.
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {ignored: ['**/src-tauri/**']},
    },
  };
});
