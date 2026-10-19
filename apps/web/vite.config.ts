import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import type { Config as RouterPluginConfig } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig, type Rollup } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const ignoredRollupWarningCodes = new Set([
  "EMPTY_BUNDLE",
  "MODULE_LEVEL_DIRECTIVE",
])

const handleRollupWarning: Rollup.WarningHandlerWithDefault = (
  warning,
  warn
) => {
  if (ignoredRollupWarningCodes.has(warning.code ?? "")) {
    return
  }

  warn(warning)
}

const stubRoutes = new Set([
  "/_game/play",
  "/_game/collection",
  "/_game/market",
])

const routerConfig = {
  routeFileIgnorePattern: "\\.js$",
  codeSplittingOptions: {
    // These tabs' routes render nothing (GameLayout keeps their pages mounted): split out, each
    // was one more round trip before the game's first screen could show.
    splitBehavior: ({ routeId }) => (stubRoutes.has(routeId) ? [] : undefined),
  },
} satisfies Partial<RouterPluginConfig>

const config = defineConfig({
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
  },
  build: {
    rollupOptions: {
      onwarn: handleRollupWarning,
    },
  },
  environments: {
    client: {
      build: {
        rollupOptions: {
          output: {
            // three.js (~140 KB brotli) in its own file: its name only changes with its version,
            // so a deploy of the app's code doesn't make returning players download it again.
            manualChunks: (id) =>
              id.includes("/node_modules/three/") ? "three" : undefined,
            // Shortened names shared between files depend on how the app's code uses them, which
            // would rename three.js's file on every deploy.
            minifyInternalExports: false,
          },
        },
      },
    },
  },
  plugins: [
    nitro({
      rollupConfig: {
        onwarn: handleRollupWarning,
      },
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      router: routerConfig,
    }),
    viteReact(),
  ],
})

export default config
