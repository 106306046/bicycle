
function start() {

    switch_change('warning');

};

function stop() {

    switch_change('default');

}

function switch_change(status) {

    var default_div = document.getElementById("default");
    var running_div = document.getElementById("running");
    var warning_div = document.getElementById("warning");

    var start_button = document.getElementById("start_button");
    var stop_button = document.getElementById("stop_button");

    switch (status) {
        case 'default':
            default_div.style.display = 'block';
            running_div.style.display = 'none';
            warning_div.style.display = 'none';

            start_button.style.display = 'block';
            stop_button.style.display = 'none';

            break;

        case 'running':
            default_div.style.display = 'none';
            running_div.style.display = 'block';
            warning_div.style.display = 'none';

            start_button.style.display = 'none';
            stop_button.style.display = 'block';

            break;

        case 'warning':
            default_div.style.display = 'none';
            running_div.style.display = 'none';
            warning_div.style.display = 'block';

            start_button.style.display = 'none';
            stop_button.style.display = 'block';

            break;

        default:
            console.log(`no switch stauts: ${expr}`);
    }

}
function setContent(id, new_content) {
    let div = document.getElementById(id);
    div.innerHTML = new_content.toString;
}

///ultra-distance

