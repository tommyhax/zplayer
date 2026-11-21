import type { CapacitorConfig } from "@capacitor/cli";

// The native shell: the same static build the home-screen web app serves, in a WKWebView.
// `npm run build` writes `dist/`; `npx cap copy ios` copies it into the Xcode project.
const config: CapacitorConfig = {
  appId: "nz.tommyhax.zplayer",
  appName: "zPlayer",
  webDir: "dist",
  ios: {
    // The Xcode project, target and product are zPlayer (ios/App/zPlayer.xcodeproj). The
    // folder under it stays "App": `cap copy` writes the bundle into ios/App/App/public by
    // that name. `cap update`, which rewrites the plugin list, expects App.xcodeproj as
    // well; there are no plugins, so the script runs copy alone. Adding a plugin one day
    // means running update once against a project renamed back for that run.
    scheme: "zPlayer",
    // The web view runs edge to edge; the page's safe-area insets keep the tabs clear of
    // the status bar and the home indicator, as they do for the home-screen web app.
    contentInset: "never",
    backgroundColor: "#0b0c0e",
  },
};

export default config;
