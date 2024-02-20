# EZ Watch Along Streamer

A hassle free, single command solution for watching a video you own amongst your friends!
If you want to just watch a video amongst some friends, this tool is for you!

* 🤗 EZ to setup! You just need an mp4 file to stream.
* 📱Mobile support!
* 📜 Subtitles support for those foreign film nights!
* 🛡️ No complicated user management system. Just need to use the generated unique URL.

## Requirements

* You will need [NodeJS](https://nodejs.org/en)
* [ffmpeg binary](https://ffmpeg.org/download.html) located in PATH.

## How to Run

```bash
node index.js --root <path_to_videos_folder>
```

A lookup table of all `*.mp4` that can be recursively found in the root folder will execute.
This can take a bit of time.

## Setup

Your root should contain various mp4 videos.
Subtitles can be optionally registered, in the same folder, by having the same name as the `.mp4` but with `.vtt` extension.

MKV codecs are coming soon (see [Future Goals](#future-goals)) but until then, you will need to manually convert.

# Contributions and Testing

To contribute to the code, ensure that your tests are passing before submitting a PR.
To run a test, use the following:

```bash
npm test
```

# Trouble Shooting

## Issues with Finding `ffmpeg`?

`ffmpeg` is the standard for video utilities and our tools requires this installation, ensure the tool is in your PATH.
Most Linux distributions have an apppropriate single line call to install this library.
Windows can be a bit more involved, however, you can find tutorials online.

We use [node-fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg) under-the-hood.
You can use the variables `FFMPEG_PATH` and `FFPROBE_PATH` instead of `PATH` to point to your binary.

## Cannot connect to server?

A couple of things to verify:

* Ensure your server has port (8080) forwarding on the router (if hosting at home.)
* Ensure you are passing in a `token` in the URL.
* Ensure that your firewall is allow port 8080.
* Ensure you don't have another program using port 8080.

## Taking a while to generate video lookup cache?

If your library is very large, it can take a while to generate a `video_library.json` cache file which caches video metadata.
The original purpose of this tool was to support a small to medium sized library. Consider pointing your root to a sub-folder for a single session.

If there is interest in supporting larger video libraries, please file an issue.


# Future Goals

* Support simple MKV with h.246 and subtitles.
* Support fancier subtitle interactions.
* Make `video_library.json` generation more efficient.
