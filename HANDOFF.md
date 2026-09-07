# Mask up

Single-file web app. Live front or back camera, real-time face-mesh tracking, masks that fit the face contour and follow it as the person moves. Everything outside the mask is left untouched.

Owner: Mahmoud. Working style: concise, structured, British/Australian spelling in all UI copy. No em dashes or semicolons in user-facing text. Ask before creating repos, pushing, publishing or deleting anything.

## Files

| File | What it is |
|---|---|
| `index.html` | The app, complete. No build step, no runtime dependencies. |
| `tools/preview.mjs` | Renders every mask over a reference face as PNGs, so mask geometry can be checked without a camera. |
| `package.json` | Only covers the preview tool. The app itself has no dependencies. |
| `HANDOFF.md` | This document. |

## Deploying

The app needs a real HTTPS origin. It cannot run inside the claude.ai preview or a published artifact, because that sandbox blocks the face-tracking model download and camera access.

GitHub Pages, from the repo root:

1. Repo settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`, save.
2. Wait about a minute, then open `https://<owner>.github.io/mask-up/` on the phone and tap Start camera.

Netlify drop works too. Any static host over HTTPS is fine.

## How the app works

- **Tracking:** MediaPipe Tasks Vision `FaceLandmarker`, loaded as an ES module from `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10`. WASM from the same package. Model file from `storage.googleapis.com/mediapipe-models/face_landmarker/...float16/1/face_landmarker.task`. GPU delegate with CPU fallback. 478 landmarks per face including irises. `numFaces: 2`.
- **Modes:** `VIDEO` running mode for the live camera (`detectForVideo` in a `requestAnimationFrame` loop, only when `video.currentTime` changes). Switches to `IMAGE` mode for uploaded photos and back again when the camera restarts.
- **Smoothing:** `smooth()` eases every landmark towards its detected position at alpha 0.5, so the masks sit still on a still face. Reset with `prev = null` whenever the source changes (camera start, photo load).
- **Rendering:** one `<canvas id="out">`. Each frame draws the video, then each face's mask. Front camera is mirrored with a canvas transform (`translate(W,0); scale(-1,1)`) so the saved image matches the preview. Back camera is not mirrored.
- **Masks:** each entry in `MASKS` has `draw(ctx, g)` where `g = geom(landmarks, W, H)`. `geom` gives `P(i)` for pixel coordinates of landmark `i`, face height `fh`, face width `fw`, unit vectors `up` and `rt`, `off(point, u, v)` to offset along the face axes as fractions of `fh`/`fw`, `lerp`, `dist`, `ring(ids, k)` to scale a landmark loop about its centroid, and `roll` (head tilt in radians). Shapes are polygons through real landmarks, so they deform with expression and head turn.
- **Reference face:** `REF` holds the 111 landmarks the masks read, taken from the MediaPipe canonical face model and packed as `index,x,y` per mille. `refFace(ctx, g)` draws a plain face from them. Used for the mask tray thumbnails and by `tools/preview.mjs`. Add a mask that reads a landmark outside `REF` and it falls back to the face centre in those two places only, never in the live app. Re-pack `REF` if that happens.
- **Capture and save:** shutter freezes the loop (canvas keeps the last frame). Save uses `navigator.share` with a PNG file where supported (iOS share sheet), else a download link. Back to camera resumes the loop.
- **Still photos:** file picker, `createImageBitmap` with `imageOrientation: 'from-image'`, downscaled to 1600 px max, detected once, drawn once.

### Landmark reference used

| Feature | Indices |
|---|---|
| Forehead top / chin | 10 / 152 |
| Cheek edges (face width) | 234 (image left), 454 (image right) |
| Jaw contour, 454 round the chin to 234 | `JAW` array in code |
| Nose bridge mid / nose tip / alar sides | 197 / 4 / 49, 279 |
| Between brows | 9 |
| Brows | `BROW_R` 70,63,105,66,107 and `BROW_L` 336,296,334,293,300 |
| Eye loops | `EYE_R` and `EYE_L` arrays |
| Eye corners (width) | 33, 133 / 362, 263 |
| Iris centres | 468 / 473 |
| Temples | 127 / 356 |
| Under-eye cheek line | 116,117,118 / 345,346,347 |
| Head top corners for cat ears | 54, 103 / 284, 332 |
| Face outline | `FACE_OVAL` array, reference face only |

Masks: None, Surgical, Hero (eye mask), Masquerade, Cat, Shades, Bandana. All original designs, no branded or copyrighted characters. Keep it that way.

## Checking mask geometry

```
npm install
npm run preview     # writes tools/preview/<mask id>.png
```

The tool lifts the drawing code straight out of `index.html`, so the previews can never drift from the app. Run it after touching any `draw()` and look at the PNGs. It draws a frontal face only, so it will not catch problems that appear at extreme head angles.

## Design tokens

- Background `#26222E`, stage `#0E0C12`, ink `#F6F2EA`, muted `#A9A2B4`, accent `#FF6B8B` on `#2A0A12`, chips `#3A3545`.
- System font stack. Headline 34px, weight 800, tight tracking. Sentence case everywhere, no all-caps labels.
- Layout: single column, max 480px, 3:4 stage with rounded corners, iOS-style shutter ring, circular mask tray under the stage, controls below.
- Copy: plain verbs, tells the person what to do next ("Line up your face and tap the shutter", "No face found in that photo").

## Still to check on a real face

The masks have been tuned against the reference face and against simulated head roll and yaw, but never against a live camera. Worth a look on the phone:

- Whether the surgical and bandana top edges clear the eyes on faces with different eye spacing.
- Whether the hero and masquerade eye holes (`ring(EYE_*, 1.6)`) clear the eyes when they are wide open.
- Cat ear placement on someone with a lot of hair, since 54/103 and 284/332 sit at the hairline.
- Whether alpha 0.5 in `smooth()` is the right trade between steadiness and lag.
- Frame rate on older phones. If it drags, drop the ideal camera resolution from 1280x1706 to 960x1280, or run detection on every second frame.
- `roundRect` needs iOS 16+ Safari. Fine for current devices.
- The Flip button is hidden with `.stage:not(.live) .flip{display:none}`, which must stay after `.btn` in the CSS or the cascade re-shows it.

## Backlog

- More masks and colour variants, tap a selected mask again to cycle colours.
- Video clips: `MediaRecorder` on `out.captureStream()`, share as MP4/WebM.
- Two-person masks already work, could add per-face mask selection.
- PWA manifest so it installs to the home screen and opens full-screen.
- Native iOS version with ARKit face tracking if Mahmoud wants true depth-sensor fitting. Note for that conversation: LiDAR is rear-facing and not available to web pages, and TikTok-style filters use camera face mesh, not LiDAR, so the web version is already the same class of effect.

## Prior version

The first build was a static-photo version (`mask-selfie.html` in the chat): upload or capture a photo, tracking.js Haar box detection with the native FaceDetector as first choice, fixed-shape masks drawn in a face-centred frame, manual drag/pinch/rotate. Superseded by `index.html`. Only worth revisiting for a no-model offline fallback.
