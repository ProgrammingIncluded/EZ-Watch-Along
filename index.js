// ext
import { program } from "commander";
import express from "express";
import { glob } from "glob";
import ffmpeg from "fluent-ffmpeg";

// std
import fs from "fs";
import readLine from "readline";
import path from "path";
import { fileURLToPath } from "url";
import util from "util";

const proj_name = "ez_watch_along_streamer";
const cwd = process.cwd();
const dirname = path.dirname(fileURLToPath(import.meta.url));


program
  .name(proj_name)
  .description("Stream a simple MP4/MKV file with subtitles support.")
  .version("0.1.0")
  .option("-r, --root <fpath>", "root directory to serve video files", path.join(cwd, "videos"));

program.parse();
let options = program.opts();
const root_dir = options.root;

class VideoMetadata {
    constructor(fname, max_length) {
        this.fname = fname
        // in milliseconds
        this.max_length = max_length;
    }
}

class PlayerState {
    constructor() {
        // We use timestamps to calculate deltas. The start time indicates
        // delta time via now - start_time.
        // When video is paused, the start_time is set to undefined and
        // delta accumulator updated with number of milliseconds.
        this.start_time = null;
        this.delta = 0; // milliseconds.
        this.is_playing = false;
        this.metadata = null;
    }

    set_video_metadata(video_metadata) {
        this.metadata = video_metadata;
    }

    get_video_metadata(video_metadata) {
        return this.metadata;
    }

    play() {
        // idempotent guarantee.
        if (this.start_time == null) {
            this.start_time = new Date();
        }
        this.is_playing = true;
    }

    pause() {
        this.delta += (new Date()) - this.start_time;
        this.start_time = null;
        this.is_playing = false;
    } 

    set_new_time(new_delta_time_ms, is_playing) {
        this.start_time = new Date();
        this.delta = new_delta_time_ms;
        this.is_playing = is_playing;
    }
}

let PLAYER_STATE = new PlayerState();

let LIB_CACHE = null;
const ACTIONS = [
    "play",
    "pause",
    "reset",
    "set_time"
];
function verify_action(str_action) {
    return ACTIONS.indexOf(str_action) > -1;
}

const app = express();
app.use(express.json()); // for json
app.use(express.urlencoded({ extended: true })); // for form data

// Simple endpoints for files.
app.get("/", function(req, res) {
  res.sendFile(dirname + "/index.html");
});

app.get("/index.css", (req, res) => {
  res.sendFile(path.join(dirname, "index.css"))
});

app.get("/client.js", async (req, res) => {
    res.sendFile(path.join(dirname, "client.js"))
});


// Rest API for server status.
app.get("/get_videos", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (LIB_CACHE != null) {
        return res.send(JSON.stringify(LIB_CACHE));
    }

    // Check if cache exists, if so, we use that instead.
    let cache_file_fpath = path.join(root_dir, 'video_library.json');

    // Attempt to load the file
    let cache = null;
    if (fs.existsSync(cache_file_fpath)) {
        try {
            cache = JSON.parse(await util.promisify(fs.readFile)(cache_file_fpath, "utf-8"))
            LIB_CACHE = cache;
            return res.send(JSON.stringify(cache));
        } catch(e) {
            console.log(e);
            console.log("Unable to read cache file: " + cache_file_fpath);
        }
    }
    
    // Cache does not exist, we attempt to generate one of our own.
     
    let options = {cwd: root_dir};
    let results = (await Promise.all([
        glob("*.mkv", options),
        glob("*.mp4", options)
    ])).flat();

    // Enforce order for indices.
    results.sort();

    // go through each results
    let metadata_array = [];
    for (let short_fpath of results) {
        let fpath = path.join(root_dir, short_fpath);
        let metadata = await util.promisify(ffmpeg.ffprobe)(fpath);
        // Convert to ms.
        metadata_array.push(new VideoMetadata(short_fpath, metadata.format.duration * 1000)); 
    }

    const payload = JSON.stringify({videos: metadata_array});
    // Write the cache file.
    fs.writeFileSync(cache_file_fpath, payload);
    res.send(payload);
});

// TODO: set Videos
app.post("/controls", function(req, res) {
    const action = req.body.action;
    if (!verify_action(action)) {
        return res.sendStatus(404);
    }

    // Process the state
    switch(action) {
        case "reset":
            PLAYER_STATE = new PlayerState();
            break;
        case "play":
            PLAYER_STATE.play();
            break;
        case "pause":
            PLAYER_STATE.pause();
            break;
        case "set_time":
            if (req.body.delta == undefined || req.body.is_playing == undefined) {
                return res.sendStatus(404);
            }

            PLAYER_STATE.set_new_time(req.body.delta, req.body.is_playing);
            break;
    }

    res.setHeader("Content-Type", "application/json");
    const payload = JSON.stringify(PLAYER_STATE);
    res.send(payload);
});

app.get("/controls", function(req, res) {
    // Retrieve controller information.
    res.setHeader("Content-Type", "application/json");
    const payload = JSON.stringify(PLAYER_STATE);
    res.send(payload);
});

app.get("/video", function(req, res) {
    const range = req.headers.range;
    if (!range) {
        res.status(400).send("Requires Range header");
    }
    const video_name = "ova.mp4";
    const video_path = path.join(root_dir, video_name);
    const video_size = fs.statSync(video_path).size;
    const CHUNK_SIZE = 10 ** 6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start + CHUNK_SIZE, video_size - 1);
    const content_length = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${video_size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": content_length,
        "Content-Type": "video/mp4",
    };
    res.writeHead(206, headers);
    const video_stream = fs.createReadStream(video_path, { start, end });
    video_stream.pipe(res);
})

const server = app.listen(8080, function() {
  console.log(proj_name + " server started!")
  console.log("Visit at: http://localhost:8080")
});

// Used for testing purposes.
export default server;
