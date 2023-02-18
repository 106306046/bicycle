// DEVICES
let isIOS = 'webkitAudioContext' in window;

// AUDIO
let audioContext = null;
const audioControlCount = 10;
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

const IDX_LIST = [
    [826, 828, 830, 832, 834, 836, 838, 840, 842, 844, 846],
    [851, 853, 855, 857, 859, 861, 863, 865, 867, 869, 871],
];
const FR_LIST = [
    [19380, 19423, 19466, 19509, 19552, 19595, 19638, 19681, 19724, 19766],
    [19724, 19767, 19810, 19853, 19896, 19939, 19982, 20025, 20068, 20110],
];
//const BANDWIDTH = 4;

//#region Broadcast Sound Code
const tranMessage = 'B';
const code1 = '000';
const code2 = '011';

let SI_BC = null;
let message = '';
function broadcast(fb) { //default fb == 0 

    let message = tranMessage;
    let soundControl = [];

    console.log('broadcast:' + soundControl);
    // frequency band
    if (SI_BC != null) {
        return;
    }



    ascii_message = message.charCodeAt();
    binary_message = ascii_message.toString(2);
    reversed_message = binary_message.split("").reverse().join("");
    combined_code_message = code1 + reversed_message;
    soundControl = combined_code_message.split("");

    console.log('broadcast translated maessage:' + soundControl);

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
                if (soundControl[i]) {
                    gainNodes[i].gain.value = 0.5;
                } else {
                    gainNodes[i].gain.value = 0;
                }
            }
            shouldKill = true;
        }
    }, 1000);
}
//#endregion

//#region Listen Sound Code

let threshold = 80;
let offset = 10;
let isListenReady = false;
let avgAmount = 50;
let avgThreshold = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,]
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
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,]
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
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0,]
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


    RECVMSG.innerHTML = `${code[0]} | ${code[1]}`;
}

/* 
function check_array(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

let ID_behind = '';

function receive(array) {

    //     前7位為ID
    //     後3位為code
    array = array.reverse();

    let control = array[0].toString() + array[1].toString() + array[2].toString();
    let ID_receive = '';

    for (i = 3; i < array.lenth; i++) {
        ID_receive += array[i].toString();
    }
    ID_receive = String.fromChatCode(parseInt(ID_receive, 2));
    return control, ID_receive;

}

*/

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

    // console.log(dataArray);
}, 33);
