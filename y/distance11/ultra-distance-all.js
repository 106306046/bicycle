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

const RECVMSG = document.getElementById('display');
const CONSOLE = document.getElementById('console');
const THRESH = document.getElementById('thresh');

const DistanceMSG = document.getElementById('distance');
let timestamp = 0;

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
const tranMessage = 11;
let receive = false;
let SI_BC = null;
let message = '';
let limit = (2 / 340) * 2;

function broadcast(fb) {
    receive = false;

    timestamp = Date.now();
    countDown = setInterval(() => {
        now = Date.now();
        console.log(now, timestamp);
        if (((now - timestamp) / 1000 >= limit) && receive == false) {
            alert('超出距離');
            clearInterval(countDown);
        }
    }, 10);
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
    CONSOLE.innerText = '';
    RECVMSG.innerText = '';
    THRESH.innerText = '';

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
    //send 11 [1011] receive 7[0111]
    if (code[0] == [0, 1, 1, 1]) {
        receive = ture;
        timeDiff = Math.floor((Date.now() - timestamp) / 1000);
        distance = parseInt(timeDiff * 340.29 * 100)
        DistanceMSG.innerHTML = distance.toString() + ' cm';
        if (distance > 200) {
            alert('範圍外');
        }
    }

    RECVMSG.innerHTML = `${code[0]} | ${code[1]}`;
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
    } catch { }
}
draw();
//#endregion

/**********************************************************************************************/

setInterval(() => {
    try {
        analyser.getByteFrequencyData(dataArray);
        if (isListenReady) listen();
        else beforeListen();
        THRESH.innerText = `${dataBuffer.length}: AVG { ${avgThreshold[0]} | ${avgThreshold[1]} }`;
        draw();
    } catch { }
}, 33);
