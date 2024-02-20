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

const proj_name = "ez_watch_along_server";
const cwd = process.cwd();
const dirname = path.dirname(fileURLToPath(import.meta.url));


program
  .name(proj_name)
  .description("Stream a simple MP4 file with subtitles support.")
  .version("0.1.0")
  .option("-r, --root <fpath>", "root directory to serve video files", path.join(cwd, "videos"))
  .option("-t, --token <uid>", "unique token required for access the program", Math.random().toString(16).slice(2))

program.parse();
let options = program.opts();
const root_dir = options.root;
const token = options.token;

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
    "set_video",
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
  if (req.query.token != token) {
      return res.sendStatus(404);
  }
  res.sendFile(dirname + "/index.html");
});

app.get("/index.css", (req, res) => {
  res.sendFile(path.join(dirname, "index.css"))
});

app.get("/client.js", async (req, res) => {
    res.sendFile(path.join(dirname, "client.js"))
});


async function generate_video_db() {
    let options = {cwd: root_dir};
    let results = (await Promise.all([
        // glob("**/*.mkv", options), TODO
        glob("**/*.mp4", options)
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

    const data = {videos: metadata_array};
    const payload = JSON.stringify(data);
    console.log("Videos loaded to database: ", data.videos.length);

    // Write the cache file.
    let cache_file_fpath = path.join(root_dir, 'video_library.json');
    fs.writeFileSync(cache_file_fpath, payload);

    LIB_CACHE = data;
    return data
}

// Rest API for server status.
app.get("/get_videos", async (req, res) => {
    if (req.query.token != token) {
        return res.sendStatus(404);
    }

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
    let payload = await generate_video_db();
    res.send(payload);
});

// TODO: set Videos
app.post("/controls", function(req, res) {
    if (req.query.token != token) {
        return res.sendStatus(404);
    }

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
        case "set_video":
            const video_fname = req.body.fname;
            if (video_fname == undefined) {
                return res.sendStatus(404);
            } 
            let search = LIB_CACHE["videos"].find((e) => { return e.fname === video_fname; });
            if (search == undefined) {
                return res.sendStatus(404);
            }

            PLAYER_STATE.metadata = new VideoMetadata(search.fname, search.max_length);
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
    if (req.query.token != token) {
        return res.sendStatus(404);
    }

    // Retrieve controller information.
    res.setHeader("Content-Type", "application/json");
    const payload = JSON.stringify(PLAYER_STATE);
    res.send(payload);
});

app.get("/video", function(req, res) {
    if (req.query.token != token) {
        return res.sendStatus(404);
    }

    const video_name = req.query.fname;

    if (video_name == undefined) {
        return res.sendStatus(404);
    } else if (LIB_CACHE == null) {
        return res.sendStatus(404);
    }

    let valid_video = LIB_CACHE["videos"].find((e) => { return e.fname == video_name; });
    if (valid_video == undefined) {
        return res.sendStatus(404);
    }

    const range = req.headers.range;
    if (!range) {
        res.status(400).send("Requires Range header");
    }

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

// TODO: Support multi track?
app.get("/subtitles", function(req, res) {
    if (req.query.token != token) {
        return res.sendStatus(404);
    }

    const video_name = req.query.fname;
    // Verify that the file exists.
    if (video_name == undefined) {
        return res.sendStatus(404);
    } else if (LIB_CACHE == null) {
        return res.sendStatus(404);
    }

    let valid_video = LIB_CACHE["videos"].find((e) => { return e.fname == video_name; });
    if (valid_video == undefined) {
        return res.sendStatus(404);
    }

    // Once video is found, check if there is a subtitle we can retrieve.
    let subtitle_name = video_name.substring(0, video_name.length - 4) + ".vtt"
    let subtitle_fpath = path.join(root_dir, subtitle_name);
    if (!fs.existsSync(subtitle_fpath)) {
        return res.sendStatus(404);
    }

    return res.sendFile(subtitle_fpath);
})

let server = app.listen(8080, function() {
    console.log(proj_name + " server started!")
    console.log("Your unique token for this session is: " + token)
    console.log("Keep the token a secret and share only with your friends. Access your server via:")
    console.log("Visit at: http://localhost:8080?token=" + token + "\n")
});

// For testing purposes.
server.token = token;

await generate_video_db();

// Used for testing purposes.
export default server;
