var DISABLE_PUSH_DATA = false;
var UPDATE_CYCLE = 500;

var SERVER_VIDEOS = null;
var LOADING_VIDEO_DATA = true;

// kudos to: https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
function msToTime(ms) {
    let seconds = (ms / 1000).toFixed(1);
    let minutes = (ms / (1000 * 60)).toFixed(1);
    let hours = (ms / (1000 * 60 * 60)).toFixed(1);
    let days = (ms / (1000 * 60 * 60 * 24)).toFixed(1);
    if (seconds < 60) return seconds + " Sec";
    else if (minutes < 60) return minutes + " Min";
    else if (hours < 24) return hours + " Hrs";
    else return days + " Days"
}

function reset_cool_down_push() {
    DISABLE_PUSH_DATA = false;
    setTimeout(update_loop, UPDATE_CYCLE);
}

function set_video_state(control_data) {
    let video_player = $("#video_player");
    let delta = control_data.delta / 1000;
    if (control_data.start_time != null) {
        delta += (new Date() - new Date(control_data.start_time)) / 1000;
    }

    if (control_data.is_playing) {
        video_player.get(0).play();
    } else {
        video_player.get(0).pause();
    }

    let ct = video_player.get(0).currentTime;
    if (Math.abs(ct - delta) >= 2) {
        video_player.get(0).currentTime = delta;
    }
}

function update_loop() {
    $.get("/controls", function(control_data) {
        if (control_data == null) {
            alert("FIX ME PLS.");
        }

        DISABLE_PUSH_DATA = true;
        set_video_state(control_data);
        setTimeout(reset_cool_down_push, 100);
    });
}

function side_bar_search() {
    let search_text = $("#search").val();
    let side_bar = $("#side_bar");
    if (SERVER_VIDEOS == null) {
        side_bar.html("Loading...")
        setTimeout(side_bar_search, 1000);
    }

    let filtered_results = SERVER_VIDEOS["videos"].filter((d) => d.fname.includes(search_text));
    if (filtered_results.length <= 0) {
        side_bar.html("No results found for: " + search_text);
        return;
    }

    let idx = 0;
    side_bar.html("");
    for (let r of filtered_results) {
        let fname_dom = $("<div>", {"class": "search_pathname", "idx": idx})
        fname_dom.html(r.fname);

        let duration_dom = $("<div>", {"class": "duration"})
        // TODO: Better duration visualization.
        duration_dom.html("Duration: " + msToTime(r.max_length));

        let search_result = $("<div>", {"class": "search_result"})
        search_result.append(fname_dom)
        search_result.append(duration_dom)
        
        side_bar.append(search_result);
        idx += 1;
    }
};

$(document).ready(function() {
    // Set a update loop to sync with server.
    update_loop();

    // Get result.
    $.get("/get_videos", function(data) {
        SERVER_VIDEOS = data;
        LOADING_VIDEO_DATA = false;
        side_bar_search();
    });

    // Add handlers
    let video_player = $("#video_player");
    video_player.on("play", function(){
        if (DISABLE_PUSH_DATA) {
            return;
        }
        $.post({
            traditional: true,
            url: "/controls",
            contentType: "application/json",
            data: JSON.stringify({action: "play"}),
            dataType: "json",
            success: function(data) { console.log(data); }
        });
    });

    video_player.on("pause", function(){
        if (DISABLE_PUSH_DATA) {
            return;
        }
        $.post({
            traditional: true,
            url: "/controls",
            contentType: "application/json",
            data: JSON.stringify({action: "pause"}),
            dataType: "json",
            success: function(data) { console.log(data); }
        });
    });

    video_player.on("seeking", function() {
        if (DISABLE_PUSH_DATA) {
            return;
        }
        $.post({
            traditional: true,
            url: "/controls",
            contentType: "application/json",
            data: JSON.stringify({
                    action: "set_time",
                    delta: video_player.get(0).currentTime * 1000,
                    is_playing: !video_player.get(0).paused
                  }),
            dataType: "json",
            success: function(data) { console.log(data); }
        });
    });

    // Search bar logic
    let search_bar = $("#search");
    let side_bar = $("#side_bar");
    let bar_appear = false;
    search_bar.on("click", function(e) {
        if (!bar_appear) {
            side_bar.show("slide", {direction: "left"}, 500); 
            bar_appear = true;
        }
    })

    $("#player_grid").on("click", function() {
        if (bar_appear) {
            side_bar.hide("slide", {direction: "left"}, 500); 
            bar_appear = false;
        }
    });

    search_bar.keyup(side_bar_search);
});
