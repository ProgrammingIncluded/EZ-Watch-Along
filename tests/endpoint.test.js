/**
 * Simple tests for our endpoints and application state.
 */

import request from "supertest";
import app from "../index";
import { globSync } from "glob";
import path from "path";

// A test like implementation for parsing payload
function transform_payload(raw_json) {
  expect(raw_json).toHaveProperty("delta")
  expect(raw_json).toHaveProperty("is_playing")
  expect(raw_json).toHaveProperty("start_time")
  expect(raw_json).toHaveProperty("metadata")

  if (raw_json.start_time == null) {
    return;
  }

  raw_json.start_time = new Date(raw_json.start_time)
}

let TOKEN = app.token;

describe("Player States", () => {
  test("Basic get point", async () => {
    const res = await request(app).get("/?token=" + TOKEN).expect(200);
    expect(res.text).toContain("DOCTYPE html");
  })

  test("Player default state", async () => {
    const res = await request(app).get("/controls?token=" + TOKEN)
                                  .expect("Content-Type", /json/)
                                  .expect(200, {
                                    delta: 0,
                                    start_time: null,
                                    is_playing: false,
                                    metadata: null
                                  });
  })

  test("Play action enum check", async () => {
    for(let act of ["play", "pause", "reset"]) {
      await request(app).post("/controls?token=" + TOKEN)
                  .send({action: act})
                  .expect("Content-Type", /json/)
                  .expect(200);
    }

    // Set time has extra params.
    await request(app).post("/controls?token=" + TOKEN)
                .send({action: "set_time", delta: 0, is_playing: false})
                .expect("Content-Type", /json/)
                .expect(200);

    // Test invalid points
    await request(app).post("/controls?token=" + TOKEN).expect(404);
    await request(app).post("/controls?actions=invalid&token=" + TOKEN).expect(404);
    await request(app).post("/controls?token=" + TOKEN).send({action: "invalid"}).expect(404);
  })

  test("Test play action from default", async () => {
    let res = await request(app).post("/controls?token=" + TOKEN).send({action: "play"})
                      .expect("Content-Type", /json/)
                      .expect(200);

    const payload = res.body;
    transform_payload(payload);
    expect(payload.delta).toEqual(0);
    expect(payload.is_playing).toEqual(true);

    // The start time should only be within a few milliseconds
    const start_time_tolerance = 20;
    const start_ms = new Date(payload.start_time).getTime()
    const now_ms = new Date().getTime();
    expect(Math.abs(now_ms - start_ms)).toBeLessThanOrEqual(start_time_tolerance);
  })

  test("Test play after pause", async () => {
    let res_play = await request(app).post("/controls?token=" + TOKEN).send({action: "play"})
                      .expect("Content-Type", /json/)
                      .expect(200);

    let pre_call_start = new Date();
    const payload_play = res_play.body;
    transform_payload(payload_play);
    await new Promise((r) => setTimeout(r, 0.2 * 1000));

    // Then pause once more
    let res_pause = await request(app).post("/controls?token=" + TOKEN).send({action: "pause"})
                      .expect("Content-Type", /json/)
                      .expect(200);
    const payload_pause = res_pause.body;
    transform_payload(payload_pause);
    expect(payload_pause.start_time).toEqual(null);
    expect(payload_pause.is_playing).toEqual(false);

    // Calculate total elapsed time after pause.
    const start_time_upper_bound = new Date() - pre_call_start;
    const start_time_tolerance = 20;
    expect(Math.abs(start_time_upper_bound - payload_pause.delta)).toBeLessThanOrEqual(start_time_tolerance);
  })
})

// We can only run metadata tests if there exists atleast one video.
const cwd = process.cwd();
const video_fpath = path.join(cwd, "videos");
const check_if_mp4 = globSync("*.mp4", {cwd: video_fpath}).length > 0;
const maybe_mp4 = check_if_mp4 ? describe : describe.skip;
maybe_mp4("Player Metadata MP4", () => {
  test("List Metadata", async () => {
    let res = await request(app).get("/get_videos?token=" + TOKEN) 
                      .expect("Content-Type", /json/)
                      .expect(200);

    // There will always be atleast one video because of skip if check.
    expect(res.body).toHaveProperty("videos")
    expect(res.body.videos[0]).toHaveProperty("fname")
    expect(res.body.videos[0]).toHaveProperty("max_length")
    expect(res.body.videos[0].fname).toContain(".mp4")
  })
})

afterEach(() => {
    // Force reset of player for future testing.
    request(app).post("/controls?token=" + TOKEN).send({action: "reset"})
                .expect("Content-Type", /json/)
                  .expect(200);
})

afterAll(() => {
  app.close();
})
