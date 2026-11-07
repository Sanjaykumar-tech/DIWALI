# DIWALI COSMIC — A Celebration Beyond the Stars

An immersive, fully visual Diwali website. Visitors light a fuse with an interactive 3D matchstick, then your seven original Google Flow clips play in sequence (60 s), ending with an animated **HAPPY DIWALI TO ALL** greeting.

The seven clips are your pre-rendered footage. The site never presents them as live 3D. The only live 3D is the background layer and the matchstick scene.

**Sound:** the site plays each clip's own built-in audio track. There is no separate audio system, no audio files or folder, and no Web Audio code. Sound switches on when the visitor clicks **BEGIN EXPERIENCE** (browsers block sound before a click). If a browser still blocks it, the clip plays silently and the speaker button (or the `M` key) in the top-right turns sound on.

---

## 1. Add your videos (required)

Copy your seven clips into `assets/videos/` with **exactly** these names:

| Scene | File | Length |
|---|---|---|
| 1 | `scene-01-cosmic-intro.mp4` | 8 s |
| 2 | `scene-02-matchstick-ignition.mp4` | 8 s |
| 3 | `scene-03-countdown.mp4` | 8 s |
| 4 | `scene-04-rocket-launch.mp4` | 8 s |
| 5 | `scene-05-rocket-ascent.mp4` | 8 s |
| 6 | `scene-06-grand-fireworks.mp4` | 12 s |
| 7 | `scene-07-diwali-finale.mp4` | 8 s |

At start-up the site checks that every file exists. If any are missing it lists them and lets you retry or continue (the intro and matchstick still work). No placeholders are generated.

Optional: `assets/images/` (`storyboard.png`, `rocket-reference.png`, `diwali-logo.png`) is for your reference only; the site does not load these.

## 2. Run it in VS Code

The site uses ES modules and `fetch`, so it must be served over HTTP. Opening `index.html` by double-clicking (`file://`) will not work.

1. Install [VS Code](https://code.visualstudio.com/) and the **Live Server** extension (Ritwick Dey).
2. `File → Open Folder…` and choose the `DIWALI-COSMIC` folder.
3. Right-click `index.html` → **Open with Live Server**.
4. You need internet on first load: Three.js and GSAP come from CDNs, and the Cinzel and Inter fonts from Google Fonts.

Alternatives, from inside the project folder:

```bash
python3 -m http.server 8080      # then open http://localhost:8080
# or
npx serve .
```

To test on your phone, open `http://<your-computer-IP>:<port>` on the same Wi-Fi.

## 3. Project structure

```
DIWALI-COSMIC/
├── index.html                  markup, import map (Three.js), GSAP script tag
├── style.css                   palette, typography, layout, responsive, reduced-motion
├── script.js                   entry point: wires modules, WhatsApp link, config
├── video-controller.js         two-slot sequential player, preload next, errors, asset check
├── scene-manager.js            state machine + orchestration (replay, errors, finale)
├── matchstick-interaction.js   Three.js matchstick, flame, fuse, sparks, smoke, proximity
├── effects-manager.js          Three.js nebula, stars, dust, embers, fireworks overlay
├── animation-controller.js     GSAP reveals, flash transition, finale greeting
├── ui-controller.js            loading, HUD, progress, full screen, dialogs
├── scenes/                     one config per clip (+ index.js registry)
│   ├── intro.js  ignition.js  countdown.js  launch.js
│   └── ascent.js  fireworks.js  finale.js
└── assets/videos/              your seven clips
```

## 4. How it works

**State machine** (`scene-manager.js`):
`IDLE → INTRO → INTERACTION → IGNITION → PLAYING_SCENE_01 … 07 → FINALE → COMPLETED`

Only the transitions above are allowed. A repeated or out-of-order trigger is blocked, so double clicks and late events cannot start overlapping videos. Replay and Back-to-start are the only forced jumps. A `run` counter cancels stale async work after those.

**Video controller:** two `<video>` elements. One is active; the other preloads only the next clip, after the crossfade. Old clips are unloaded (`src` removed, `load()`) to free decoders. Progress is based on the real `currentTime / duration`. A 15-second stall watchdog, load timeout and `error` events all produce a dialog with **Retry / Skip scene / Back to start**. Playback pauses when the tab is hidden and resumes afterwards.

**Matchstick:**
- Drag with mouse, touch or pen. On touch the match lifts above your finger.
- Arrow keys move the match (Shift = bigger steps). Enter/Space or the **TAP TO IGNITE** button glides it to the fuse.
- Ignition is real proximity detection: the flame point must come within 0.5 world units of the fuse tip. Closer than 2.4 units, the fuse glows and the flame leans toward it.
- On ignition a spark races along the fuse, sparks and smoke burst, the screen floods with golden light, and Scene 1 begins.
- The platform and rocket body in this interactive scene are **neutral stand-ins**, so your rocket design is not recreated. Your real rocket appears only in your videos.
- If WebGL is unavailable, a fallback shows the ignite button only.
- Its renderer, geometries, materials, textures and environment map are all disposed after ignition.

**Finale:** when Scene 7 ends, the last frame holds while **HAPPY DIWALI / TO ALL** reveals over a soft scrim with light rays and floating golden particles. **REPLAY CELEBRATION** returns to the matchstick. **SHARE DIWALI WISHES** opens WhatsApp with a URL-encoded message.

## 5. Customising

- **Share link:** in `script.js`, set `CONFIG.shareUrl` to your deployed address (otherwise the current page address is used, which is useless when running on `localhost`). Edit `CONFIG.shareMessage` for the greeting text.
- **Per-scene effects:** edit the files in `scenes/` (`onEnter` / `onExit` hooks). Modes are `intro`, `overlay`, `fireworks`, `finale`.
- **Effect strength:** `MODES` in `effects-manager.js`.
- **Offline use:** download `three.module.js` (r160) and `gsap.min.js` into the project and change the import map in `index.html` and the GSAP `<script src>`. Download the two Google Fonts too, or the page falls back to Georgia / system fonts.

## 6. Keyboard & accessibility

| Key | Action |
|---|---|
| Tab / Enter | Navigate and activate buttons |
| Arrow keys | Move the match (in the matchstick scene) |
| Enter / Space | Ignite (when the match scene is focused) |
| F | Toggle full screen |
| R | Replay (during playback or on the greeting) |

- `prefers-reduced-motion` is honoured. No letter blur or movement, no camera drift or rumble, a calm nebula, fewer particles, and sparse fireworks.
- Dialogs trap focus. Progress is exposed as a `progressbar`. The page is usable with a keyboard alone.
- Full screen uses the Fullscreen API. It is hidden where unsupported (iPhone Safari).

## 7. Performance notes

- Only the next clip is preloaded. Finished clips are released.
- Mobile gets lower pixel ratio, fewer stars and particles, a cheaper nebula shader (3 vs 5 octaves), and fewer geometry segments.
- A single pooled `THREE.Points` draw call per particle system, with no per-frame allocation of particle objects.
- The effects canvas is rendered only while a layer is visible. Rendering stops when the tab is hidden.
- Videos use `object-fit: contain`, so the complete frame (and your rocket) is never cropped. Ultra-wide or portrait screens show black bars.
- Videos use `playsinline` so iPhone Safari keeps them inside the page. Sound starts only after the visitor's click (autoplay policy); a muted fallback keeps playback working if the browser refuses.

## 8. Testing checklist

Run through these in Chrome desktop, Android Chrome and iPhone Safari:

1. Page opens; loading bar reaches 100 %; intro text reveals.
2. **BEGIN EXPERIENCE** (click it twice quickly; only one transition should occur).
3. Drag the match (mouse, then touch). Try arrow keys and **TAP TO IGNITE**.
4. Fuse ignites, golden flash, Scene 1 starts.
5. Scenes 1–7 play in order with crossfades. The progress bar fills and the label updates. Only one video is ever active.
6. Greeting reveals after Scene 7.
7. **REPLAY CELEBRATION** returns to the matchstick. The `R` key and the HUD replay button do the same during playback.
8. **SHARE DIWALI WISHES** opens WhatsApp with the encoded message.
9. Full screen (button and `F`).
10. Rotate the phone and resize the window; layout holds.
11. Rename one video temporarily: the missing-file dialog appears at start-up. Choose **Continue anyway** and reach that scene to see the playback error dialog.
12. Enable OS "reduce motion" and reload.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| "Still starting…" message | Serve over HTTP (Live Server), not `file://`; check internet for the CDNs. |
| "video files missing" dialog | Names must match exactly (lowercase, hyphens, `.mp4`) in `assets/videos/`. |
| Video won't start on a phone | Retry from the dialog; ensure clips are H.264/AAC MP4. |
| Black bars around video | Intentional (`contain`) so no part of the frame is cropped. |
| No full-screen button on iPhone | iOS Safari doesn't support full screen for web pages; use Add to Home Screen. |
| Share link points at `localhost` | Set `CONFIG.shareUrl` in `script.js` after deploying. |
