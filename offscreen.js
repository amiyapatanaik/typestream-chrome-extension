import { saveRecordingBlob } from './lib/audio-store.js';

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
const RECORDER_TIMESLICE_MS = 1000;

let recorder = null;
let data = [];
let activeStreams = [];
let isStarting = false;
let stopRequested = false;
let stopInFlight = false;

function sendToBackground(msg) {
  console.log(LOG, 'Sending:', msg.type);
  chrome.runtime.sendMessage({ ...msg, target: TARGET.BACKGROUND }, () => {
    void chrome.runtime.lastError;
  });
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

  const audioId = await saveRecordingBlob(blob);
  console.log(LOG, 'Saved recording to IndexedDB:', audioId, blob.size, 'bytes');

  sendToBackground({
    type: MSG.RECORDING_STOPPED,
    payload: {
      mimeType: MIME_TYPE,
      byteLength: blob.size,
      audioId,
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
  stopInFlight = false;

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

    recorder = new MediaRecorder(micStream, { mimeType: MIME_TYPE });
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

    recorder.start(RECORDER_TIMESLICE_MS);
    console.log(LOG, 'MediaRecorder started (timeslice:', RECORDER_TIMESLICE_MS, 'ms)');

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

  if (stopInFlight) {
    console.log(LOG, 'Stop already in flight, ignoring');
    return;
  }

  if (isStarting) {
    stopRequested = true;
    return;
  }

  if (recorder?.state === 'recording') {
    stopInFlight = true;
    try {
      if (typeof recorder.requestData === 'function') {
        recorder.requestData();
      }
      recorder.stop();
    } catch (err) {
      stopInFlight = false;
      console.log(LOG, 'stopRecording ERROR:', err.message);
      sendToBackground({
        type: MSG.OFFSCREEN_ERROR,
        payload: { message: 'Failed to stop recording. Try again.' },
      });
    }
    return;
  }

  console.log(LOG, 'No active recorder to stop');
  sendToBackground({
    type: MSG.OFFSCREEN_ERROR,
    payload: { message: 'No audio recorded. Try again.' },
  });
}

async function stopAllStreams() {
  activeStreams.forEach((stream) => {
    stream.getTracks().forEach((track) => track.stop());
  });
  activeStreams = [];

  recorder = null;
  isStarting = false;
  stopRequested = false;
  stopInFlight = false;
}

console.log(LOG, 'Offscreen document ready');
