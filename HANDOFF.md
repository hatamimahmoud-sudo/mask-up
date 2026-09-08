# Mask up

Single-file web app. Live front or back camera, real-time face-mesh tracking, masks that fit the face contour and follow it as the person moves. Everything outside the mask is left untouched.

Owner: Mahmoud. Working style: concise, structured, British/Australian spelling in all UI copy. No em dashes or semicolons in user-facing text. Ask before creating repos, pushing, publishing or deleting anything.

## Files

| File | What it is |
|---|---|
| `index.html` | The app, complete. No build step, no runtime dependencies. |
| `manifest.webmanifest`, `icon-180.png`, `icon-512.png` | Home screen install. On iPhone: share sheet, Add to Home Screen, and it opens without browser chrome. |
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
- **Layout:** the camera is the page. `.stage` is fixed full screen, the canvas is `object-fit: cover`. The brand and the hint sit top left, the recording timer top centre, and the Photo/Video switch, shutter, Flip, actions and mask tray float over the bottom in `.dock`. Uploaded photos switch to `object-fit: contain` so nothing is cropped. Save crops the PNG to what was on screen (`visibleRect`). Stage states are classes on `#stage`: none (landing), `live` (plus `video` when in video mode, plus `recording`), `frozen`, `still`, `clip`.
- **Camera:** asks for 1080x1920 in the screen's orientation. Some phones read width and height in sensor orientation and hand a portrait screen a landscape frame, so `startCamera` checks `videoWidth > videoHeight` and asks once more with the two swapped. Every start bumps `gen`, and each `await` inside checks it, so a double tap on Flip cannot leak a stream or start two loops. `stopCamera` also bumps it. The track's `onended` and `visibilitychange` restart or reset the camera when iOS takes it away (a call, a lock, another app). `video.onresize` follows a rotation. `mirror` is its own flag rather than being read off `facing`, so a still photo does not un-mirror the next camera start.
- **Running mode:** `mode` tracks the landmarker's running mode (the object does not expose it) and `setMode()` is the only thing that changes it. `resumeLive()` owns the return to the live state from frozen, clip or the custom sheet, and always goes through `setMode('VIDEO')`. `loop()` is wrapped in try/catch: a throw stops the camera and returns to the landing screen with a message, instead of leaving a dead loop under a live shutter.
- **Video:** the Photo/Video switch above the shutter. In video mode the shutter starts and stops a `MediaRecorder` on `recCanvas.captureStream(30)`, where `recCanvas` is the visible crop of the output canvas redrawn every frame (`recordFrame`), plus the microphone asked for on first use. The live loop keeps running, so the tray works mid-clip. Safari records MP4, Chrome WebM. Capped at 60 s. The clip plays back in `#clip` over the stage. Flip, the mode switch and the custom sheet are disabled while recording.
- **Glow:** a toggle top right, remembered in `localStorage`. A second WebGL program (`FS_SKIN`) runs before the mask pass: it samples the frame at up to 720 px wide and applies a surface blur (nearby pixels count only when close in colour, so pores go and edges stay), a slight lift, blush and a lip tint, each weighted by a channel of `beautyMap()`, a UV texture painted once: red for skin (feathered, minus eyes, brows and lips), green on the cheeks, blue on the lips. Works under any mask and with no mask.
- **Duo:** when two faces are detected the stage gets class `two` and a Match / Pair / Swap control appears. `masksFor()` orders faces left to right by mean x and hands the second face `partner(current)` from `PAIRS` when Pair is on, swapped if Swap is on. The renderer keeps two full-size mask textures in two texture units so both masks draw every frame without re-uploading.
- **Surprise me:** a chip that runs `shuffle()`, nine quick selections slowing to a stop.
- **Sharing:** `deliver()` uses `navigator.share` with a file where the browser supports it (`canShareFiles` is tested once at startup and picks the button label, Share or Save), else a download link. A cancelled share sheet (`AbortError`) does nothing rather than falling through to a download.
- **Rendering:** one `<canvas id="out">`. Each frame draws the video, then `composite()` draws each face's mask. Front camera is mirrored with a canvas transform (`translate(W,0); scale(-1,1)`) so the saved image matches the preview. Back camera is not mirrored.
- **Masks:** each entry in `MASKS` has up to three drawing functions, all taking `(ctx, g)` where `g = geom(landmarks, W, H)`.
  - `under(ctx, g)` paints anything behind the face mesh (the balaclava hood, the gaiter's neck), flat in screen space, before the texture. Draw it as a ring around the face, never over it, or it shows through the texture's holes.
  - `tex(ctx, g)` paints the part that sits on the face. It runs once per mask into a 1024 texture in the face's UV space (`g = geom(UVL, 1024, 1024)`), and every frame the mesh renderer warps that texture onto the 898 triangles of the live face mesh. So the fabric bulges over the nose, wraps the cheeks and moves with the mouth. This is how TikTok and Snapchat face masks work.
  - `over(ctx, g)` paints anything that leaves the face (ear loops, cat ears, the bandana tail) or is rigid and should not bend with skin (sunglasses). Drawn flat in screen space each frame.
  - `geom` gives `P(i)` for pixel coordinates of landmark `i`, face height `fh`, face width `fw`, unit vectors `up` and `rt`, `off(point, u, v)` to offset along the face axes as fractions of `fh`/`fw`, `lerp`, `dist`, `centroid`, `ring(ids, k)` to scale a landmark loop about its centroid, and `roll` (head tilt in radians). The same drawing code works in texture space and screen space because everything is relative to the face axes.
  - `inset(g, ids, k)` pulls an outline loop inwards so a mask edge sits on skin rather than on the silhouette. `shadow` and `shade` add a drop shadow and a curvature gradient. All three are what stop a mask reading as a sticker. `shade` takes a fill rule as its last argument. Pass `'evenodd'` for any path with holes or the multiply gradient paints into the holes.
  - `coverPath(ctx, g, {edge, eyes, nose, lips, nostrils})` builds a full-face cover with holes, for the skin-care masks, skull, clown and the like. `eyes` is a ring scale, or `'wide'` for a hand-cut window (`cutout`, a rounded polygon) from above the brow to under the eye and out past both corners, the outer end a touch higher. `nose: true` leaves the nose bare from mid bridge to below the nostrils, and `lips: 'wide'` is a window round the mouth. The skin masks (Clay, Sheet, Charcoal, Gold, Mud) use all three, modelled on the Snapchat clay mask look: the mask reads as an enhancement to the face, not a cover, so eyes, brows, nose and mouth all show. Tints (Witch, Devil, Zombie, Vampire) carry eye holes too: nothing built in hides the eyes except by design (the skulls' sockets, which are translucent). Fill it with `'evenodd'`. `ribbing` draws knit lines, `rng(seed)` is a deterministic random for freckles, camo and beard hairs.
- **Mesh renderer (`mesh`):** a small WebGL program. Textures are 256 px for the tray thumbnails (all cached) and 1024 px for the mask in use (only the current one is kept), so twenty-eight masks do not mean twenty-eight 4 MB canvases on a phone. `mesh.invalidate(m)` drops a mask's textures after its drawing changes. The GL layer is capped at 960 px on the long side and scaled up on the copy. No MSAA and no depth buffer (the mask edge comes from texture alpha). Fragment precision is highp where available. Back faces are culled so triangles that fold over at strong yaw do not paint over the near side. Context loss sets `mesh.lost`, and `composite()` falls back to flat drawing until the context is restored. The mean-brightness loop is clamped to the light map, because a face half out of frame used to read past its edge and send NaN to the shader. Vertex positions are the 468 normalised landmarks, UVs and triangles come from `MESH`. The fragment shader samples the mask texture and re-lights it from a 32 px wide copy of the frame (`uLight`), relative to the mean brightness of the face box (`uMean`), so the mask sits in the same light as the face. The light map is deliberately tiny so lips and brows under the mask do not print through. Knobs: `relight` strength in `render()` (0.75), the clamp range in the shader (0.7 to 1.5), and the light map width (32). Where WebGL is missing, `composite()` draws `tex()` flat in screen space instead.
- **Face mesh data (`MESH`):** the MediaPipe canonical face model, packed as base64 Uint16 in the page: `xy` (the canonical face in a 3:4 frame), `uv` (texture coordinates, v flipped so y runs down like an image) and `tri` (898 triangles). About 12 KB. Rebuild from `canonical_face_model.obj` in the MediaPipe repo if it ever needs to change. Per-vertex UVs come from the `f v/vt` records, not from vt order.
- **Reference face:** `REF` is the canonical face with the ten iris points synthesised. `refFace(ctx, g)` draws a plain face from it. Used for the tray thumbnails and by `tools/preview.mjs`.
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
| Mesh edge at the temples | 162 / 389, just above 127 / 356 |
| Face outline | `FACE_OVAL` array, reference face only |

Masks, in tray order:

- Originals: Surgical, Hero, Masquerade, Cat, Shades, Bandana.
- Full covers: Balaclava, Gaiter, Clay, Sheet, Charcoal, Gold, Mud (with cucumber slices), Skull, Clown.
- Halloween: Pumpkin, Witch, Zombie, Mummy, Devil, Sugar skull.
- Face paint: Vampire, Camo, Game day, Freckles, Gems.
- Hair: Beard, Moustache.
- Off the face: Eye patch, Bear ears, Bunny ears, Antennae.
- Custom, see below.

The tray is built from `GROUPS` in the picker, not from the order of `MASKS`: None, Custom and Surprise me first, then face coverings, eye masks, skin masks, Halloween, face paint, hair and headwear, with a thin rule between groups.

All original designs, no branded or copyrighted characters. Keep it that way.

## Custom mask

The Custom chip opens a sheet where the person picks a picture (file, link, or a snap of the live camera) and gets a mask from it. When a face is found in the picture, the mask is lifted straight off it. When no face is found, a mask is built from the picture's colours instead.

- `liftMask(photo, L)` unwraps the face in the photo into UV space: each of the 898 mesh triangles is copied, with a per-triangle affine transform and clip, from where it sits in the photo to where it sits on the mask texture. That gives the person's face flattened into the same space the masks are painted in. Then it decides which pixels are mask and which are skin. The reference skin is the neck below the chin (nine samples, kept when they look like skin), falling back to the skin-like part of the face. A pixel is mask when it differs from the reference in chroma or brightness. On top of that, a whole-face test compares the average skin-like face colour with the neck: a sheet or clay mask close to skin colour is flatter and less saturated than skin, and averaging makes that visible where single pixels cannot. When it trips, everything close to the face average is kept as mask too. The score is computed on a 96 grid, only the largest connected patch survives (which drops hair and wall at the temples), it is blurred twice for a soft edge, the photo's own lighting is flattened by a soft copy of its brightness so the live re-light can do its job, and the eyes and mouth are punched out. Coverage under 6 percent of the face means no mask was found and the colour route is used.
- **Artwork with no face in it** (a drawing, a character, a screenshot): `fitImage()` cuts the artwork out from its background (flood fill from the edges over anything near the edge colours, or light and unsaturated, which also eats the checkerboard behind a saved transparent PNG), labels the pieces left and keeps one (the first big piece with a pair of eyes in it, else the biggest, which drops a screenshot's text and thumbnails), and looks for eyes: two solid dark compact blobs side by side in the top four fifths of the piece, the higher pair preferred (a bow or ears above the head push the eyes down the box). With eyes, a head's worth of artwork around them is kept (ears and bows stay, bodies go) and `fitTransform()` pins those eyes to the wearer's eyes with a similarity transform. A character's nose and mouth sit just under its eyes where a person's are much lower, so `fitImage()` also looks below the eye line for compact marks that are not the face colour and do not touch the outline (the nose, then a mouth if there is one), and `drawFitted()` draws the artwork in horizontal bands: uniform above the eye line, then eye line to nose, nose to mouth, and on down to the chin, each band with its own vertical scale (clamped to 0.6 to 3) so the drawn nose lands on the nose and the drawn mouth on the mouth. Without eyes, the artwork is scaled to the face width. The texture draws it inside the face oval with the eyes and mouth punched out, and the Custom mask's `over()` draws the same artwork, same transform, clipped to outside the oval, so ears and bows are not cut off. Stored as `mode: 'image'` with the cut-out as a data URL, its box, its eyes, nose and mouth.
- A lifted mask is stored in `localStorage` as a PNG data URL (about 200 to 400 KB) under the same `maskup.custom` key, with `mode: 'lift'`. It is decoded on load and the chip refreshes when it arrives (`customready`).
- In the sheet, a lifted mask shows Shape as "As found" plus the three trims (full, lower, eyes). Pattern and colours are hidden, since they only apply to the colour route.
- Known limits: hands or hair over the mask in the photo are copied too if they touch the mask patch. A photo where the face is turned hard to one side lifts only the visible half. A bare face in good light with a neck in deep shadow can trip the whole-face test and lift skin, which the person will see and cancel.

- Four ways in: choose a photo, paste a link, Snap the camera (shown when the camera is on: it reads the current frame off the live video, so you can hold a real mask up to it), or describe the mask in words.
- **Describe a mask.** The words go to Claude (`claude-opus-5`, Messages API called straight from the browser with the `anthropic-dangerous-direct-browser-access` header, effort medium) with `MASK_LANGUAGE` as the system prompt, and Claude answers with a JSON program. That needs the person's own Anthropic API key, asked for on first use, kept in `localStorage` under `maskup.key`, sent only to `api.anthropic.com`, and forgettable from the sheet. A 401 clears it. The response is parsed from the first `{` to the last `}`, validated by `okProgram` (known ops only, at most 80 per layer) and every field is clamped when drawn, so a bad program draws nothing rather than throwing.
- **The mask language** is interpreted by `runOp`: three layers (`tex` on the face, `over` in front, `under` behind), points as `[anchor, up, right]` against named anchors or landmark indices, region ops (`cover`, `lower`, `eyemask`, `band`, `ring`, `poly`, `circle`, `ellipse`) that fill, stroke, shade and shadow, pattern ops (`dots`, `stripes`, `blobs`, `knit`, `freckles`, `sparkle`) clipped to a region, line ops, and presets that reuse the built-in masks' parts (`whiskers`, `nose`, `fangs`, `teeth`, `stitch`, `eyeshadow`, `blush`, `ears` in six styles, `hat` in five, `glasses`, `hood`, `neck`). The system prompt documents all of it with two worked examples. To add an op: implement it in `runOp`, add its name to `OPS_ALL`, and describe it in `MASK_LANGUAGE`.
- A described mask is stored as `mode: 'program'` with the program JSON.
- The colour route, `analyse(img, detect)` without a lift: runs face detection on the picture. If a face is found it tests eight landmarks in each of six regions (forehead, eyes, nose, cheeks, mouth, chin) against a YCbCr skin box. Regions where at least half the points are not skin count as covered, and the pattern of covered regions picks the shape: full face (with a mouth hole if the mouth is uncovered), lower face, or eyes. Colours come from the non-skin pixels at the remaining landmarks, skipping eyes, brows and lips, quantised and then merged so shades of one colour count as one colour. One dominant colour means plain, otherwise dots or blobs. With no face it takes the colours of the whole picture and defaults to a full cover.
- `drawSpec(ctx, g, spec)` draws the custom mask: the lifted texture when `spec.mode` is `'lift'` (trimmed by the chosen shape unless it is `'auto'`), otherwise the parametric mask from `{cover, mouth, pattern, colors[3]}`. Shape, pattern and the three colours are editable in the sheet. The spec is saved in `localStorage` under `maskup.custom`.
- Known limits: olive and tan sit inside the skin box, so camouflage reads as partly skin. Pasted links only work when the host sends CORS headers, which most image hosts do not. The message tells the person to save the image and choose it instead.
- The spec from `localStorage` is validated by `okSpec` before use. A bad value is ignored rather than breaking the tray on every reload.
- Pasted links must be `https`, are fetched with no credentials and no referrer, time out after 15 s, and must come back as `image/*` under 25 MB. Uploaded and fetched pictures are decoded through an `<img>` so the pixel count is known before decoding, and anything over 40 megapixels is refused.
- `window.__lastAnalysis` holds the last result, for tests.

## Testing with the real tracker

The CDN is blocked in the cloud sandbox, but `npm i --no-save @mediapipe/tasks-vision@0.10.35` works, and the model file downloads with curl. A harness that serves `index.html` with `MP` pointed at `/node_modules/@mediapipe/tasks-vision` and the model path pointed at a local copy runs real detection in headless Chromium, which is how the lift was tuned on real photos. See the session scratch files if they survive, otherwise it is about twenty lines of Playwright.

## Checking mask geometry

```
npm install
npm run preview     # writes tools/preview/<mask id>.png
```

The tool lifts the drawing code straight out of `index.html`, including the mesh renderer, so the previews can never drift from the app. Run it after touching any `tex()` or `over()` and look at the PNGs. It draws a frontal face only, so it will not catch problems that appear at extreme head angles. Headless Chromium needs the SwiftShader flags the tool passes for WebGL.

Anything drawn in `tex()` is cut off at the mesh boundary, which is the face outline. If a shape needs to leave the face, it belongs in `over()` (in front) or `under()` (behind).

To place something new, render a landmark map: draw `refFace` large and label `g.P(i)` for the indices you care about. The lower-face indices used by the beard came from one of those.

## Design tokens

- Panel `#26222E` (the sheet), stage `#0E0C12` (the page), ink `#F6F2EA`, muted `#A9A2B4` (on solid surfaces only, never over video), accent `#FF6B8B` on `#2A0A12`, chips `#3A3545`, thumbnail disc `#EADFD2`, record red `#E0262E`.
- System font stack. Headline 40px, weight 800, tight tracking. Then 22 (sheet title), 18 (brand), 15 (body), 13 (toast, mode switch), 12 (chip labels). Sentence case everywhere, no all-caps labels.
- Radii: 22px for the sheet panel, 10px for selects, pills for everything else. Touch targets 44px or more.
- Layout: full-screen camera with a floating dock. iOS-style shutter ring, circular mask tray in groups, hint under the brand at the top.
- Copy: plain verbs, tells the person what to do next ("Line up your face and tap the shutter", "No face found in that photo").

## Review round

Ten review agents went over the app (state logic, WebGL, iOS and Android, security, an automated run, mask artwork, interface, a taste test, copy, brand). Their fixes are in. Their bigger asks, in the order they were raised, are the backlog below. Not taken up: self-hosting MediaPipe (the version is pinned instead), tabs in the tray (grouping with rules instead), and cutting masks (the weak ones were reworked).

## Still to check on a real face

The first live test on an iPhone showed the flat version. The mesh version has been checked against the reference face only. Worth a look on the phone:

- Whether the re-light reads as natural or as a smudge. The three knobs are listed under the mesh renderer above. If lips still show through the surgical mask, raise the clamp floor from 0.7.
- Whether the mask edges now sit on skin when the head turns. `inset` at 0.08 for surgical and 0.06 for bandana is a guess.
- Whether the hero and masquerade eye holes (`ring(EYE_*, 1.6)`) clear the eyes when they are wide open.
- Cat ear placement on someone with a lot of hair, since 54/103 and 284/332 sit at the hairline.
- Whether alpha 0.5 in `smooth()` is the right trade between steadiness and lag.
- Frame rate. Each frame now does detection, a 2D draw, a 32 px light map read and a WebGL draw at full camera resolution. If it drags, drop the ideal resolution in `openStream` from 1080x1920 to 720x1280.
- Whether the portrait retry in `startCamera` gives a portrait frame on iOS. If the frame is still landscape, `object-fit: cover` will zoom in hard.
- Camera permission in a home screen install. iOS asks every launch in standalone mode.
- `roundRect` needs iOS 16+ Safari. Fine for current devices.

## Backlog

- Video: a hold-to-record gesture on the shutter, and a way to trim the clip.
- Glow strength slider, and a whitening or eye-brighten option.
- Duo: per-face mask choice rather than pairs, and three or more faces.
- More seasonal packs (Christmas, Valentine's, Pride, football) and colour variants, tap a selected mask again to cycle colours. Ideas from the art review: a luchador, a chrome half-plate, a knit beanie.
- Custom: adjust size and position live on the face after snapping.
- Native iOS version with ARKit face tracking if Mahmoud wants true depth-sensor fitting. Note for that conversation: LiDAR is rear-facing and not available to web pages, and TikTok-style filters use camera face mesh, not LiDAR, so the web version is already the same class of effect.

## Prior version

The first build was a static-photo version (`mask-selfie.html` in the chat): upload or capture a photo, tracking.js Haar box detection with the native FaceDetector as first choice, fixed-shape masks drawn in a face-centred frame, manual drag/pinch/rotate. Superseded by `index.html`. Only worth revisiting for a no-model offline fallback.
