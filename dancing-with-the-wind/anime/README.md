# Dancing With the Wind (바람을 붙잡고 춤을 췄구나) — 2D anime, code-drawn

`dancing_with_the_wind_anime.html` is a single self-contained file: about 91 seconds, 1920×1080, 24 fps, with sound.
Every image is drawn with Canvas 2D and every sound is synthesized in JavaScript.
It uses no image or audio files, no libraries, no fonts and no network requests.
All randomness is seeded, so every frame and every sample is identical on each run.

## Watching
Open the HTML in a desktop browser and click the play button. The music takes a few seconds to synthesize first, shown by the bar.
Keys: Space plays or pauses, ←/→ seek 5 s, Home restarts, F toggles fullscreen. Hover the bottom edge to see and click the progress bar.

## Structure
| file | content |
|---|---|
| `src/00_core.js` | seeded RNG, hashing, easing, colour, Catmull-Rom paths, cel fill, IK |
| `src/10_paint.js` | gouache texture, edge-lit cumulus clouds, stars, moon, film grain, vignette |
| `src/2x_*.js` | characters: 3/4, profile, front and back heads with aging, full-body rigs, waltz two-shot, hands, masked guests |
| `src/3x_bg_*.js` | painted backgrounds: Seoul alley (intact and ruined), kitchen, pojangmacha, music box, golden stairs, gates, palace, cracked wall |
| `src/40_shots.js` | 18-shot timeline, camera moves, particles, gold-freeze, dissolve, crossfades |
| `src/50_audio.js` | pure-JS synth (music box, piano, strings, flute, bells, timpani, wind, applause, cracks) + score + reverb |
| `src/90_main.js` | player, audio/visual sync, controls, export hooks |
| `build.py` | inlines `src/*.js` into `src/template.html` |
| `tools/` | Playwright snapshot, determinism/perf checks, offline MP4 exporter |

```bash
python3 build.py                                   # rebuild the HTML
node tools/check.js                                # two page loads: audio hash + frame hashes must match
node tools/export.js ../output/anime_91s.mp4 /tmp/frames   # offline render: H.264 1080p24 + AAC
```

Characters animate on twos (12 drawings per second) while the camera moves at 24 fps, as in theatrical anime.
The playback clock is the audio clock, so a slow frame is dropped rather than drifting out of sync.
