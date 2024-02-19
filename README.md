# EZ Watch Along Streamer

A hassle free, single command solution for watching a video you own amongst your friends!
Many alternatives out there try to be an all encompassing solution. Video management, user login system, etc.
If you want to just watch a video amongst some friends, this tool is for you!

* EZ to setup! You just need an mp4 or mkv file to stream.
* No complicated user management system. Just need use the generated unique URL.
* Subtitles support for those foreign film nights!

## Requirements

* You will need [NodeJS](https://nodejs.org/en)
* [ffmpeg binary](https://ffmpeg.org/download.html) located in PATH.

## How to Run

```bash
node index.js --root <path_to_videos_folder>
```

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



