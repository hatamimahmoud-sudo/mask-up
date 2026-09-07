# Mask up

Live face masks in the browser. Point the camera at yourself, pick a mask, and it tracks your face and follows it as you move. Everything outside the mask is left untouched.

`index.html` is the whole app. No build step, no runtime dependencies. It needs to be served over HTTPS, because the camera and the face-tracking model both require a secure origin. Add it to the home screen on a phone and it opens full screen.

- **Tracking:** MediaPipe Tasks Vision Face Landmarker, 478 points per face, up to two faces.
- **Masks:** thirty-three of them, with a Halloween set, from a surgical mask to a balaclava, clay and sheet skin masks, a skull, a beard and bunny ears, plus a custom one built from a picture you choose. Painted as textures onto the 898-triangle face mesh in WebGL and re-lit from the video, so they wrap the nose and cheeks, move with the mouth and sit in the same light as the face.
- **Glow and Duo:** a skin-smoothing base layer that stacks under any mask, and paired masks when two people are in frame.
- **Output:** take a photo, or record a clip with sound and swap masks while it records. Share straight to the share sheet, or save.

## Checking mask geometry

```
npm install
npm run preview
```

Renders every mask over a reference face into `tools/preview/`, so mask shapes can be checked without a camera.

See `HANDOFF.md` for how the code is laid out.
