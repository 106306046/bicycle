//
var listen_timer = null;
var broadcaster = null;
var listener = null;
var listened = false;

// DEVICES
let isIOS = 'webkitAudioContext' in window;

// AUDIO
let audioContext = null;
const audioControlCount = 4;
let oscillators = [];
let gainNodes = [];
let analyser = null;
let bufferLength = null;
let dataArray = null;

// IOS SAFARI NOT SUPPORTED HIGHPASSFILTER
if (isIOS) {
    navigator.mediaDevices
        .getUserMedia({
            audio: {
                echoCancellation: false,
                mozAutoGainControl: false,
                mozNoiseSuppression: false,
                googEchoCancellation: false,
                googAutoGainControl: false,
                googNoiseSuppression: false,
                googHighpassFilter: false,
            },
            video: false,
        })
        .then(this.handleSuccess.bind(this))
        .catch(this.handleError.bind(this));
} else {
    navigator.webkitGetUserMedia(
        {
            audio: {
                optional: [
                    { echoCancellation: false },
                    { mozAutoGainControl: false },
                    { mozNoiseSuppression: false },
                    { googEchoCancellation: false },
                    { googAutoGainControl: false },
                    { googNoiseSuppression: false },
                    { googHighpassFilter: false },
                ],
            },
            video: false,
        },
        this.handleSuccess.bind(this),
        this.handleError.bind(this)
    );
}

function handleSuccess(stream) {
    if (isIOS) {
        audioContext = new window.webkitAudioContext();
    } else {
        audioContext = new window.AudioContext();
    }
    // SOUND
    for (let i = 0; i < audioControlCount; i++) {
        oscillators[i] = audioContext.createOscillator();
        gainNodes[i] = audioContext.createGain();
        gainNodes[i].gain.value = 0;
    }

    for (let i = 0; i < audioControlCount; i++) {
        oscillators[i].connect(gainNodes[i]);
        gainNodes[i].connect(audioContext.destination);
    }

    for (let i = 0; i < audioControlCount; i++) oscillators[i].start();

    // VISUAL
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    let mediaStreamSource = audioContext.createMediaStreamSource(stream);
    mediaStreamSource.connect(analyser);
}

function handleError(error) {
    console.log(`Record doesn't not Work! ${error}`);
}

/************************************************************************************************/


const IDX_LIST = [
    [826, 828, 830, 832, 834],
    [841, 843, 845, 847, 849],
];
const FR_LIST = [
    [19380, 19423, 19466, 19510],
    [19724, 19767, 19810, 19854],
];
//const BANDWIDTH = 4;

//#region Broadcast Sound Code
const tranMessage = 7;
binary_recMessage = [1, 0, 1, 1];

let SI_BC = null;
let message = '';
function broadcast(fb) {
    // frequency band
    if (
        SI_BC !== null ||
        tranMessage < 0 ||
        tranMessage > 15 ||
        isNaN(tranMessage)
    )
        return;

    let message = tranMessage;
    let soundControl = [];
    for (let i = 0; i < audioControlCount; i++) {
        soundControl[audioControlCount - 1 - i] = message % 2 === 1;
        message = Math.floor(message / 2);
    }
    console.log(soundControl)
    console.log(message)

    let shouldKill = false;
    for (let i = 0; i < audioControlCount; i++) {
        oscillators[i].frequency.value = FR_LIST[fb][i];
    }
    SI_BC = setInterval(() => {
        if (shouldKill) {
            for (let i = 0; i < audioControlCount; i++) {
                message = null;
                gainNodes[i].gain.value = 0;
                clearInterval(SI_BC);
                SI_BC = null;
            }
            shouldKill = false;
            return;
        } else {
            for (let i = 0; i < audioControlCount; i++) {
                if (soundControl[i]) gainNodes[i].gain.value = 0.5;
                else gainNodes[i].gain.value = 0;
            }
            shouldKill = true;
        }
    }, 1000);
}
//#endregion

//#region Listen Sound Code
let recvMessage = ['', ''];
let lastTime = [0, 0];
let MAXTIME = 700;
let threshold = 80;
let offset = 10;
let isListenReady = false;
let avgAmount = 50;
let avgThreshold = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
];
let dataBuffer = [];
let count = 0;
let FB_LENGTH = 2;
function beforeListen() {
    if (count >= avgAmount) {
        isListenReady = true;
        return;
    }
    for (let fb = 0; fb < FB_LENGTH; fb++) {
        for (let i = 0; i < audioControlCount; i++) {
            let d = 0,
                len = 0;
            for (let v = IDX_LIST[fb][i]; v < IDX_LIST[fb][i + 1]; v++) {
                len++;
                d += dataArray[v];
            }
            d /= len;
            avgThreshold[fb][i] = (
                (avgThreshold[fb][i] * count + d) /
                (count + 1)
            ).toFixed(2);
        }
    }
    dataBuffer.push(dataArray.slice());
    count++;
}

function listen() {

    let curThreshold = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ];
    let d, prev;
    for (let fb = 0; fb < FB_LENGTH; fb++) {
        for (let i = 0; i < audioControlCount; i++) {
            d = 0;
            prev = 0;
            let len = 0;
            for (let v = IDX_LIST[fb][i]; v < IDX_LIST[fb][i + 1]; v++) {
                len++;
                d += dataArray[v];
                prev += dataBuffer[0][v];
            }
            d /= len;
            prev /= len;
            avgThreshold[fb][i] = (
                (avgThreshold[fb][i] * avgAmount - prev + d) /
                avgAmount
            ).toFixed(2);
            curThreshold[fb][i] = d.toFixed(2);
        }
    }
    dataBuffer.push(dataArray.slice());
    dataBuffer.shift();

    let maxThreshold = [0, 0];
    for (let fb = 0; fb < FB_LENGTH; fb++) {
        for (let i = 0; i < audioControlCount; i++) {
            if (
                curThreshold[fb][i] > avgThreshold[fb][i] * 1.5 &&
                curThreshold[fb][i] > avgThreshold[fb][i] + threshold
            ) {
                if (maxThreshold[fb] < curThreshold[fb][i])
                    maxThreshold[fb] = curThreshold[fb][i];
            }
        }
    }

    let code = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ];
    for (let fb = 0; fb < FB_LENGTH; fb++) {
        if (maxThreshold[fb] !== 0) {
            for (let i = 0; i < audioControlCount; i++) {
                if (curThreshold[fb][i] > maxThreshold[fb] - offset) {
                    code[fb][i] = 1;
                }
            }
        }
    }

    //check receive
    if (check_array(code[0], binary_recMessage) || check_array(code[1], binary_recMessage)) {
        // alert('收到');

        listened = true;

    }
}

function check_array(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}


// setInterval(listen, 33);
//#endregion

/**********************************************************************************************/
//button.js

function start() {

    switch_change('running');
    broadcaster = setInterval(() => {

        broadcast(0);

    }, 33);
    listener = setInterval(() => {
        try {
            analyser.getByteFrequencyData(dataArray);
            if (isListenReady) listen();
            else beforeListen();
        } catch { };
    }, 33);

    listen_timer = setInterval(() => {
        if (listened == false) {
            if (broadcaster) {
                clearInterval(broadcaster);
                broadcaster = null;
            }
            if (listener) {
                clearInterval(listener);
                listener = null;
            }
            if (listen_timer) {
                clearInterval(listen_timer);
                listen_timer = null;
            }
            switch_change('warning');
        } else {
            listened = false;
        }
    }, 5000);

};

function stop() {
    if (broadcaster) {
        clearInterval(broadcaster);
        broadcaster = null;
    }
    if (listener) {
        clearInterval(listener);
        listener = null;
    }
    if (listen_timer) {
        clearInterval(listen_timer); d
        listen_timer = null;
    }
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



