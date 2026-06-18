const LOG = '[Typestream Offscreen]';

const MSG = {
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  RECORDING_READY: 'RECORDING_READY',
  RECORDING_STOPPED: 'RECORDING_STOPPED',
  OFFSCREEN_ERROR: 'OFFSCREEN_ERROR',
};

const TARGET = {
  OFFSCREEN: 'offscreen',
  BACKGROUND: 'background',
};

const MIN_BLOB_BYTES = 500;
const MIME_TYPE = 'audio/webm';

let recorder = null;
let data = [];
let activeStreams = [];
let audioContext = null;
let isStarting = false;
let stopRequested = false;

function sendToBackground(msg) {
  console.log(LOG, 'Sending:', msg.type);
  chrome.runtime.sendMessage({ ...msg, target: TARGET.BACKGROUND });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== TARGET.OFFSCREEN) return;

  console.log(LOG, 'Received:', message.type);
  switch (message.type) {
    case MSG.START_RECORDING:
      void startRecording();
      break;
    case MSG.STOP_RECORDING:
      void stopRecording();
      break;
    default:
      break;
  }
});

function micErrorMessage(name) {
  switch (name) {
    case 'NotAllowedError':
      return 'Microphone access denied. Open extension settings and grant mic access.';
    case 'NotFoundError':
      return 'No microphone found. Connect a mic and try again.';
    case 'NotReadableError':
      return 'Microphone is in use by another application.';
    default:
      return `Microphone error: ${name}. Try again.`;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode audio'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to encode audio'));
    reader.readAsDataURL(blob);
  });
}

async function emitRecordingStopped() {
  const chunkSizes = data.map((chunk) => chunk.size);
  const blob = new Blob(data, { type: MIME_TYPE });
  data = [];

  console.log(LOG, 'Chunks:', chunkSizes, '→ blob:', blob.size, 'bytes');

  if (blob.size < MIN_BLOB_BYTES) {
    sendToBackground({
      type: MSG.OFFSCREEN_ERROR,
      payload: {
        message: `Mic captured only ${blob.size} bytes. Grant microphone access in onboarding and try again.`,
      },
    });
    return;
  }

  const base64 = await blobToBase64(blob);
  console.log(LOG, 'Encoded base64 length:', base64.length);

  sendToBackground({
    type: MSG.RECORDING_STOPPED,
    payload: {
      mimeType: MIME_TYPE,
      byteLength: blob.size,
      base64,
    },
  });
}

async function startRecording() {
  console.log(LOG, 'startRecording()');
  if (isStarting || recorder?.state === 'recording') {
    console.log(LOG, 'Already recording or starting, ignoring');
    return;
  }

  isStarting = true;
  stopRequested = false;

  try {
    await stopAllStreams();
    data = [];

    if (!MediaRecorder.isTypeSupported(MIME_TYPE)) {
      throw new Error('WebM audio recording is not supported in this browser.');
    }

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    activeStreams.push(micStream);

    const track = micStream.getAudioTracks()[0];
    console.log(LOG, 'Mic track:', track?.label, 'state:', track?.readyState, 'muted:', track?.muted);

    audioContext = new AudioContext();
    await audioContext.resume();

    const micSource = audioContext.createMediaStreamSource(micStream);
    const micGain = audioContext.createGain();
    micGain.gain.value = 1.0;

    const destination = audioContext.createMediaStreamDestination();
    micSource.connect(micGain);
    micGain.connect(destination);

    recorder = new MediaRecorder(destination.stream, { mimeType: MIME_TYPE });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        console.log(LOG, 'dataavailable:', event.data.size, 'bytes');
        data.push(event.data);
      }
    };
    recorder.onstop = () => {
      console.log(LOG, 'MediaRecorder stopped');
      void emitRecordingStopped().finally(() => {
        void stopAllStreams();
      });
    };
    recorder.onerror = (event) => {
      console.log(LOG, 'MediaRecorder error:', event);
      void stopAllStreams();
      sendToBackground({
        type: MSG.OFFSCREEN_ERROR,
        payload: { message: 'Recording error occurred. Try again.' },
      });
    };

    recorder.start();
    console.log(LOG, 'MediaRecorder started');

    if (stopRequested) {
      stopRequested = false;
      void stopRecording();
      return;
    }

    sendToBackground({ type: MSG.RECORDING_READY });
  } catch (err) {
    console.log(LOG, 'startRecording ERROR:', err.name, err.message);
    await stopAllStreams();
    sendToBackground({
      type: MSG.OFFSCREEN_ERROR,
      payload: { message: err.message || micErrorMessage(err.name) },
    });
  } finally {
    isStarting = false;
  }
}

async function stopRecording() {
  console.log(LOG, 'stopRecording(), isStarting:', isStarting, 'recorder:', recorder?.state);

  if (isStarting) {
    stopRequested = true;
    return;
  }

  if (recorder?.state === 'recording') {
    recorder.stop();
    return;
  }

  await stopAllStreams();
  sendToBackground({
    type: MSG.RECORDING_STOPPED,
    payload: { mimeType: MIME_TYPE, byteLength: 0, base64: '' },
  });
}

async function stopAllStreams() {
  activeStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  activeStreams = [];

  if (audioContext) {
    try {
      await audioContext.close();
    } catch {}
    audioContext = null;
  }

  recorder = null;
  isStarting = false;
  stopRequested = false;
}

console.log(LOG, 'Offscreen document ready');
