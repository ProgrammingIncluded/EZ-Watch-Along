var DISABLE_PUSH_DATA = false;
var UPDATE_CYCLE = 500;

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

$(document).ready(function() {
    // Set a update loop to sync with server.
    update_loop();

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
});
