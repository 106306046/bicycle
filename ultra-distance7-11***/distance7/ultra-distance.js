// DEVICES
let isIOS = 'webkitAudioContext' in window;
// AUDIO
let audioContext = null;
let oscillator = null;
let gainNode = null;
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
    oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 440;

    gainNode = audioContext.createGain();
    gainNode.gain.value = 0;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();

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

const RECVMSG = document.getElementById('display');
const CONSOLE = document.getElementById('console');
const THRESH = document.getElementById('thresh');

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
const tranMessage = '132303130'; // 396 四進位 00 -> 0, 01 -> 1, 10 -> 2, 11 -> 3

let SI_BC = null;
let message = '';
function broadcast(fb) {
    // frequency band
    if (SI_BC !== null) return;

    // TimeStamp
    // let now = new Date();
    // let t = now.getMilliseconds();
    // let timestamp = '';
    // for (let i = 0; i < 5; i++) {
    //     timestamp += (t % BANDWIDTH).toString();
    //     t = Math.floor(t / BANDWIDTH);
    // }
    // timestamp = timestamp.split('').reverse().join('');

    // Message
    message = '';
    message += tranMessage;
    //message += timestamp;

    let LIST = FR_LIST[fb].map((x) => x);
    let REST = false;
    SI_BC = setInterval(() => {
        // Check Ending
        if (message.length === 0) {
            message = '';
            gainNode.gain.value = 0;
            clearInterval(SI_BC);
            SI_BC = null;
            return;
        }

        // Make Sound
        if (!REST) {
            oscillator.frequency.value = LIST[message[0]];
            gainNode.gain.value = 1;
            REST = true;
            message = message.slice(1);
        } else {
            gainNode.gain.value = 0;
            REST = false;
        }
    }, 300);
}
//#endregion

//#region Listen Sound Code
let recvMessage = ['', ''];
let cur = [-1, -1];
let count = [0, 0];
let LEASTCOUNT = 10;
let lastTime = [0, 0];
let MAXTIME = 1500;
let threshold = [0, 0];
let FB_LENGTH = 2;
function listen() {
    // analyser.getByteFrequencyData(dataArray);

    CONSOLE.innerText = '';
    RECVMSG.innerText = '';
    THRESH.innerText = '';

    for (let fb = 0; fb < FB_LENGTH; fb++) {
        let peak = -1;
        let peakWeight = 0;
        let sumThreshold = 0;
        for (let i = IDX_LIST[fb][0] - 1; i < IDX_LIST[fb][4] + 1; i++) {
            let v = dataArray[i];

            if (peakWeight < v) {
                peak = i;
                peakWeight = v;
            }

            sumThreshold += v;
        }
        threshold[fb] = sumThreshold / (IDX_LIST[fb][4] - IDX_LIST[fb][0] + 2);

        if (
            peak >= IDX_LIST[fb][0] &&
            peak < IDX_LIST[fb][4] &&
            (peakWeight > threshold[fb] * 2.5 ||
                peakWeight > threshold[fb] + 40)
        ) {
            for (let i = 0; i < IDX_LIST[fb].length - 1; i++) {
                if (peak >= IDX_LIST[fb][i] && peak < IDX_LIST[fb][i + 1]) {
                    if (i === cur[fb]) {
                        count[fb]++;

                        if (count[fb] > LEASTCOUNT) {
                            cur[fb] = -1;
                            count[fb] = 0;
                            recvMessage[fb] += i.toString();
                        }
                    } else {
                        cur[fb] = i;
                        count[fb] = 1;
                        let d = new Date();
                        lastTime[fb] = d.getTime();
                    }
                    break;
                }
            }
        }

        let d = new Date();
        let time = d.getTime();
        if (time - lastTime[fb] > MAXTIME) {
            recvMessage[fb] = '';
            cur[fb] = -1;
            count[fb] = 0;
        }

        THRESH.innerText += `\n${threshold[fb]}`;
        RECVMSG.innerText += `\n${recvMessage[fb]}`;
        CONSOLE.innerText += `\ncur = ${cur[fb]}, peak = ${peak}: ${peakWeight} -> ${count[fb]}`;
    }
}
// setInterval(listen, 33);
//#endregion

/**********************************************************************************************/

//#region Draw
// CANVAS
const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
canvas.width = screen.width;
canvas.height = screen.height / 2;
canvasContext.clearRect(0, 0, canvas.width, canvas.height);

function draw() {
    try {
        // requestAnimationFrame(draw);

        canvasContext.fillStyle = 'rgb(200, 200, 200)';
        canvasContext.fillRect(0, 0, screen.width, screen.height);
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'rgb(0, 0, 0)';
        canvasContext.beginPath();

        let startPoint = 800; //0;
        let endPoint = 900; // bufferLength;
        let length = endPoint - startPoint;
        let sliceWidth = (canvas.width * 1.0) / length;
        let x = 0;
        for (let i = startPoint; i < endPoint; i++) {
            let v = dataArray[i];
            let y = -v + canvas.height;

            if (i === startPoint) canvasContext.moveTo(x, y);
            else canvasContext.lineTo(x, y);

            x += sliceWidth;
        }

        canvasContext.lineTo(canvas.width, canvas.height);
        canvasContext.stroke();

        canvasContext.beginPath();
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'rgb(255, 0, 0)';
        canvasContext.moveTo(0, -threshold[0] + canvas.height);
        canvasContext.lineTo(canvas.width, -threshold[0] + canvas.height);
        canvasContext.stroke();

        canvasContext.beginPath();
        canvasContext.lineWidth = 2;
        canvasContext.strokeStyle = 'rgb(0, 255, 0)';
        canvasContext.moveTo(0, -threshold[1] + canvas.height);
        canvasContext.lineTo(canvas.width, -threshold[1] + canvas.height);
        canvasContext.stroke();
    } catch {}
}
draw();
//#endregion

/**********************************************************************************************/

setInterval(() => {
    try {
        analyser.getByteFrequencyData(dataArray);
        listen();
        draw();
    } catch {}
}, 33);
