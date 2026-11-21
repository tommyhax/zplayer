import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const source = (name: string): string => fileURLToPath(new URL("./z/packages/" + name + "/src/index.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: "@z/core", replacement: source("core") },
      { find: "@z/zip", replacement: source("zip") },
      { find: /^@z\/desk$/, replacement: source("desk") },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
