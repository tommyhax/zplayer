import { defineConfig } from "vite";

// Local workspace packages provide the interpreter and terminal. A relative base
// lets the same bundle run at a hosted subpath or inside the native shell.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "./",
  // On the LAN, not loopback only: the tablet the player is for reaches the dev server at
  // the Mac's address (`ipconfig getifaddr en0`), and Vite prints it at startup.
  server: { port: 5179, host: true },
  preview: { host: true },
  build: { target: "es2022" },
});
