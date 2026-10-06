# Video to Frames

A simple browser-based tool to extract frames from a video.

## Run

Open `index.html` in a modern browser.

No server is required.

## Features

- MP4/WebM and other browser-supported videos
- Select extraction FPS
- PNG/JPG/WebP output
- Quality control
- Preview extracted frames
- Download all frames as ZIP
- Processing happens locally in the browser

## Note

The ZIP library is loaded from jsDelivr. If you need a completely offline version,
download `jszip.min.js` and replace the CDN script in `index.html` with:

<script src="jszip.min.js"></script>
