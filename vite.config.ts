import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {execSync} from 'node:child_process';
import {defineConfig} from 'vite';

/** Resolve the build commit SHA, branch, and build time once, at config load. */
function resolveBuildInfo() {
  const git = (cmd: string, fallback: string) => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || fallback;
    } catch {
      // git not available (e.g. building from a tarball) - keep fallback
      return fallback;
    }
  };
  return {
    sha: git('git rev-parse --short HEAD', 'dev'),
    branch: git('git rev-parse --abbrev-ref HEAD', 'unknown'),
    time: new Date().toISOString(),
  };
}

export default defineConfig(() => {
  const build = resolveBuildInfo();
  return {
    plugins: [react(), tailwindcss()],
    // Injected globals so every build is identifiable in-app (see src/lib/appVersion.ts).
    define: {
      __APP_BUILD_SHA__: JSON.stringify(build.sha),
      __APP_BUILD_BRANCH__: JSON.stringify(build.branch),
      __APP_BUILD_TIME__: JSON.stringify(build.time),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
