# Image upload policy

New images are optimized before cloud storage across product/category/banner and branding uploads, bulk drafts, background-edited photos, reviews, return/packing evidence, social imports and generated reel frames. Previously stored images are not rewritten or deleted.

## Selection versus storage limits

- Select still JPG/JPEG, PNG or WebP originals up to **20MiB each**. HEIC/RAW/SVG/animated files are not supported by these photo upload controls; export them to a supported still format first.
- The bulk picker previously rejected originals over 2MiB **before** the existing compressor could run. It now uses the same source allowance as the product/category uploader. Group references and file order are determined before conversion and retained.
- All frontend upload mutations share image preparation, including multipart fields named `files` (mixed evidence). Videos retain their existing behavior. Large WebP files and a client compression marker no longer bypass the size policy.
- Cloud image storage has an authoritative **0.7MiB (about 734KB) per-image maximum** and **1600px maximum edge**. Browser compression generally targets 0.3–0.7MiB; small existing WebP files need no repeated lossy encode. Do not pad already-small images to reach a target.
- Server optimization verifies actual image data, rejects corrupt/animated/unbounded files, corrects EXIF orientation and removes metadata. The server processes images sequentially with bounded input pixels, queue and conversion time. JPEG/PNG originals are not merely renamed `.webp`.
- R2 and Cloudinary use the same guard. Product photos retain transparency/aspect ratio, without crop or upscale. The server tries quality 90 then 84 at up to 1600/1440/1280px; if the budget still cannot be met, it rejects the image instead of storing the original. This is visual web optimization, not a promise of pixel-identical lossless output.
- Social publishing explicitly retains JPEG where required, with the same byte/dimension limits. Other stored photos use WebP. The Python reel worker also applies the budget before R2/Cloudinary writes.

Raw multipart server limits remain smaller (2MiB for draft uploads, 3MiB for normal uploads) because the app sends already-compressed images. They are transport safety limits, not source-picker limits. Direct import/storage calls are additionally bounded to 20MiB/60 megapixels before decoding. Existing video limits are unchanged.

## Deploy and verify

Deploy frontend and backend together; backend `npm ci` installs the added `sharp` dependency (Node 20.9+). No new API keys, paid image service or environment variables are required. If the separate Python reel worker is deployed, redeploy it too. It uses Pillow, already part of its existing image/background stack.

Check a 5–15MiB phone photo through Product Drafts, Category/Product ImageUploader, and mixed return/packing evidence. The request photo should be WebP well below 1MiB; the returned cloud URL, MIME and size should describe the actual optimized bytes. Verify grouping/order, transparency, portrait orientation and saved previews. Conversion errors must produce no original-image upload; video evidence must remain unchanged.

Automated tests use real server-side image encoding and mocked cloud transports, plus frontend compression/multipart tests and isolated Python worker tests. Live Cloudflare storage and visual inspection on representative jewellery photos still need a staging smoke test.

The per-image budget helps control storage, but cannot guarantee a total bucket below 10GB: total image/video counts and pre-existing assets still determine usage.

Implementation reference: [Sharp output options](https://sharp.pixelplumbing.com/api-output/), [resize options](https://sharp.pixelplumbing.com/api-resize/).
