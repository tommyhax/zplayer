# zplayer

An independent iPad-friendly story player. The shelf, monitor, keyboard and app
layout live here; the interpreter and terminal use `@z/core`, `@z/zip` and
`@z/desk` directly from the pinned z submodule.

Requires Git, Node.js 22.12 or newer and npm.

```sh
git clone --recurse-submodules https://github.com/tommyhax/zplayer.git
cd zplayer
```

For an existing checkout, run `git submodule update --init --recursive`.

## Develop, build and test

From this repository:

```sh
npm ci
npm start                 # serve on the LAN at port 5179
npm run typecheck         # shared packages and player
npm test                  # player and story-library tests
npm run build             # static app in dist/
npm run preview           # preview dist/ on the LAN
```

The workspace uses `z/packages/{core,zip,desk}` directly. The submodule pointer
and npm lockfile pin the inputs; `dist/` and staged `public/` assets are generated.
The z repository owns its package and corpus tests. Player tests exercise the
shelf, keyboard, paging, save/restore and selected stories under happy-dom.
Browser and native iOS checks are separate.

## Shared code and stories

The default shelf contains the 24 titles in `titles.json`. `npm run stage` copies
the selected story bytes from `z/historical/games/binaries/` into `public/stories/`,
writes the shelf manifest, and draws the icons and native launch artwork. Builds
and development startup run this step automatically. Edit `titles.json` to change
the selection; story inputs remain in z.

To update shared code or stories, commit and push the changes in z, check out the
chosen commit inside `z/`, then run `npm ci`, `npm run typecheck`, `npm test` and
`npm run build`. Commit the `z` submodule pointer with any player changes. After
pulling updates, run `git submodule update --init --recursive` to use the pinned
revision. Run `npm install` only when dependency declarations change, and commit
its lockfile changes too.

## Playing and saved games

Saved games use IndexedDB, one slot per title, and outlive the page. The keyboard
opens for touch input and can be toggled using the tab at the bottom of the screen.
The caps tab dims the key labels for playing in the dark. The title tab returns
to the shelf.

Each time a title opens, the player chooses a fresh random seed from the clock
automatically, with no seed controls. In-game RESTART continues the random stream;
returning to the shelf and reopening a title starts a new one.

## On an iPad

Serve `dist/` over HTTP and add it to the home screen for a standalone window.
For the native Capacitor shell, `npm run ios` builds the web app, copies it into
the Xcode project and opens `ios/App/zPlayer.xcodeproj`. Signing, device installation
and native distribution are managed in Xcode.

## GitHub Pages

The [deployment workflow](.github/workflows/deploy.yml) builds and publishes
`dist/` on pushes to `main`, or manual dispatch on `main`. In repository Settings,
select GitHub Actions as the Pages build source. The workflow uses this
repository and its pinned z submodule, with the Pages base path.

The [test workflow](.github/workflows/test.yml) runs typechecking, tests and a
production build on pushes and pull requests. Deployment runs independently
and does not wait for those checks.

## License and story content

Player code uses the [Z Source-Available License](LICENSE). The retained story
binaries and manuals have separate terms described in [NOTICE.md](NOTICE.md).
The build carries these notices alongside the story files; hosting a build
publishes the selected shelf as well as the app.
