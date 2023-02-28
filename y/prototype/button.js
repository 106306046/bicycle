
function start() {

    change_to_running(true);

};

function stop() {

    change_to_running(false);

}
function change_to_running(ruuning) {

    var default_div = document.getElementById("default");
    var running_div = document.getElementById("running");

    var start_button = document.getElementById("start_button");
    var stop_button = document.getElementById("stop_button");

    if (ruuning) {

        default_div.style.display = 'none';
        running_div.style.display = 'block';

        start_button.style.display = 'none';
        stop_button.style.display = 'block';

    } else {
        default_div.style.display = 'block';
        running_div.style.display = 'none';

        start_button.style.display = 'block';
        stop_button.style.display = 'none';
    }
}
function setContent(id, new_content) {
    let div = document.getElementById(id);
    div.innerHTML = new_content.toString;
}