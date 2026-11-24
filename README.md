# The Pool Table and the Orchard

An interactive lesson on frequentist inference: Bayes' pool table, then the orchard experiment chapter by chapter, with live simulations, step-by-step derivations and a narrated film.

**Live site:** https://melisderveni-dev.github.io/pool-table-and-orchard/

## What's here

- `site/`: the website (plain HTML, CSS and JavaScript, no build step). Published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`.
  - `index.html`: the lesson text
  - `styles.css`: the design
  - `app.js`: the simulations and charts
  - `media/`: the narrated film and its poster
- `video/`: the source of the film, made with [HyperFrames](https://github.com/heygen-com/hyperframes)
  - `script.json`: the narration, beat by beat
  - `build/voice.mjs`: generates the narration with HyperFrames' on-device voice and measures every beat
  - `build/scenes.mjs`: builds every scene (`compositions/`) and `index.html` from those timings

## Run the site locally

Open `site/index.html` in a browser.

## Rebuild the film

Requires Node.js 22+ and FFmpeg.

```bash
cd video
node build/voice.mjs      # narration -> assets/vo/ and build/timing.json
node build/scenes.mjs     # scenes timed to the narration
npx hyperframes check     # lint, layout and motion checks
npx hyperframes render -o ../site/media/frequentist-explained.mp4
```
