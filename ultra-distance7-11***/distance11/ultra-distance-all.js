// DEVICES
let isIOS = 'webkitAudioContext' in window;

const audioControlCount = 4; //0~3 傳送的訊息是4位元
let oscillators = [];
let gainNodes = [];
let analyser = null;
let bufferLength = null;
let dataArray = null;

navigator.mediaDevices
    .getUserMedia({
        audio:true
    })
    .then(this.handleSuccess.bind(this))
    .catch(this.handleError.bind(this));
//console.log(navigator.mediaDevices.getSupportedConstraints());
//safari支援:echoCancellation
//chrome支援:echoCancellation, autoGainControl, noiseSuppression

function handleSuccess(stream) {

    let audioContext = new window.AudioContext;

    // SOUND
    for (let i = 0; i < audioControlCount; i++) {
        oscillators[i] = audioContext.createOscillator(); //OscillatorNode a source representing a periodic waveform 產生波形
        gainNodes[i] = audioContext.createGain(); //controll volume of audio graph 調節音量
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
    bufferLength = analyser.frequencyBinCount;//自動分頻率？
    dataArray = new Uint8Array(bufferLength);//unsigned 8bit int array

    let mediaStreamSource = audioContext.createMediaStreamSource(stream);
    mediaStreamSource.connect(analyser);
}

function handleError(error) {
    console.log(`Record doesn't not Work! ${error}`);
}

// 0,0,0,0 | 0,0,0,0
const RECVMSG = document.getElementById('display');
//50: AVG { 0.00,0.00,0.00,0.00 | 0.00,0.00,0.00,0.00 }
const THRESH = document.getElementById('thresh');

const FR_LIST = [
    [19380, 19423, 19466, 19510],
    [19724, 19767, 19810, 19854],
];  //Ｏscillator頻率

//#region Broadcast Sound Code
const tranMessage = 11;

let SI_BC = null;
let message = '';

function broadcast(fb) {
    //set fb=0
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
    //audioControlCount =4
    for (let i = 0; i < audioControlCount; i++) {
        soundControl[audioControlCount - 1 - i] = message % 2 === 1;
        message = Math.floor(message / 2);
    }
    
    console.log(soundControl)
    console.log(message)
    /*
    if tranMessage =11
    console:
    [true, false, true, true] 1011
    0
    if tranMessage =7
    [false, true, true, true] 0111
    0
    */

    let shouldKill = false;
    for (let i = 0; i < audioControlCount; i++) {
        oscillators[i].frequency.setValueAtTime(FR_LIST[fb][i], audioCtx.currentTime);
    }

    SI_BC = setInterval(() => {
        //先執行下面的，過一秒執行上面的
        if (shouldKill) {
            for (let i = 0; i < audioControlCount; i++) { //跑0~3
                message = null;
                gainNodes[i].gain.value = 0;
                clearInterval(SI_BC);
                SI_BC = null;
            }//清空gainNode＆停止這段程式
            shouldKill = false;
            return;
        } else {
            for (let i = 0; i < audioControlCount; i++) { //跑0~3
                if (soundControl[i]) gainNodes[i].gain.value = 0.5;
                else gainNodes[i].gain.value = 0;
            }//gainNode根據soundControl排 1的話排0.5 0的話排0
            shouldKill = true;
        }
    }, 1000);
}


//#region Listen Sound Code
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

const IDX_LIST = [
    [826, 828, 830, 832, 834],
    [841, 843, 845, 847, 849],
];

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
            ).toFixed(2);//小數位數
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
    RECVMSG.innerHTML = `${code[0]} | ${code[1]}`;
}


//#region Draw
const canvas = document.getElementById('canvas');
const canvasContext = canvas.getContext('2d');
canvas.width = screen.width;
canvas.height = screen.height / 2;

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

//主程式
setInterval(() => {
    try {
        analyser.getByteFrequencyData(dataArray);
        if (isListenReady) listen();
        else beforeListen();
        THRESH.innerText = `${dataBuffer.length}: AVG { ${avgThreshold[0]} | ${avgThreshold[1]} }`;
        draw();
    } catch {}
    //console.log(dataArray);
}, 33);
