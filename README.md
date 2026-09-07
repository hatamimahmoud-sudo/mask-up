# Mask up

Live face masks in the browser. Point the camera at yourself, pick a mask, and it tracks your face and follows it as you move. Everything outside the mask is left untouched.

`index.html` is the whole app. No build step, no runtime dependencies. It needs to be served over HTTPS, because the camera and the face-tracking model both require a secure origin.

- **Tracking:** MediaPipe Tasks Vision Face Landmarker, 478 points per face, up to two faces.
- **Masks:** Surgical, Hero, Masquerade, Cat, Shades, Bandana. Drawn as polygons through real landmarks, so they deform with expression and head turn.
- **Output:** freeze the frame, then share or download a PNG.

## Checking mask geometry

```
npm install
npm run preview
```

Renders every mask over a reference face into `tools/preview/`, so mask shapes can be checked without a camera.

See `HANDOFF.md` for how the code is laid out.
