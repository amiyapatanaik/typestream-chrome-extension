import { API } from './constants.js';

const SHORT_RECORDING_MS = 120_000;
const MIN_RECORDING_MS = 800;
const MIN_BLOB_BYTES = 500;
const RETRY_ATTEMPTS = 3;
const RETRYABLE_CODES = new Set([
  'SERVICE_UNAVAILABLE',
  'SERVER_ERROR',
  'TIMEOUT',
  'RATE_LIMITED',
  'NETWORK',
  'UPLOAD_FAILED',
]);

class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

function formatDetail(detail) {
  if (!detail) return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item?.msg || item?.message || String(item)).join(', ');
  }
  return detail.message || detail.msg || detail.error || null;
}

function errorForStatus(status, detail) {
  const detailMessage = formatDetail(detail);

  switch (status) {
    case 400: return new ApiError('BAD_REQUEST', detailMessage || 'No audio was recorded. Try again.');
    case 401: return new ApiError('INVALID_KEY', 'Invalid API key. Please update in Settings.');
    case 402: return new ApiError('OUT_OF_CREDITS', 'Out of credits. Top up at typestream.dev.');
    case 408: return new ApiError('TIMEOUT', 'Request timed out. Please try again.');
    case 415: return new ApiError('UNSUPPORTED_AUDIO', detailMessage || 'Unsupported audio format.');
    case 422: return new ApiError('INVALID_REQUEST', detailMessage || 'Invalid request to Typestream API.');
    case 429: return new ApiError('RATE_LIMITED', 'Too many requests. Please wait a moment.');
    case 503: return new ApiError('SERVICE_UNAVAILABLE', detailMessage || 'Transcription service unavailable. Try again in a moment.');
    default:
      if (status >= 500) {
        return new ApiError('SERVER_ERROR', detailMessage || 'Typestream server error. Try again.');
      }
      return new ApiError('UNKNOWN', detailMessage || `Unexpected error (${status}). Try again.`);
  }
}

function baseContentType(mimeType) {
  return (mimeType || 'audio/webm').split(';')[0].trim();
}

function filenameFor(mimeType) {
  const base = baseContentType(mimeType);
  if (base.includes('mp4') || base.includes('m4a')) return 'recording.m4a';
  if (base.includes('aac')) return 'recording.aac';
  return 'recording.webm';
}

function toUploadFile(blob, mimeType) {
  const type = baseContentType(mimeType);
  return new File([blob], filenameFor(mimeType), { type });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn) {
  let lastError;
  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && RETRYABLE_CODES.has(err.code);
      if (!retryable || attempt === RETRY_ATTEMPTS - 1) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastError;
}

async function parseErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(apiKey, path, options = {}) {
  const url = `${API.BASE}${path}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError('NETWORK', 'No internet connection. Check your network.');
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw errorForStatus(response.status, body?.detail ?? body?.message);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function createSession(apiKey, contentType = 'audio/webm') {
  const data = await request(apiKey, API.ENDPOINTS.CREATE_SESSION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType }),
  });

  return {
    sessionId: data.session_id,
    uploadUrl: data.upload_url,
    contentType: data.content_type || contentType,
  };
}

export async function uploadToPresignedUrl(uploadUrl, contentType, blob) {
  let response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
  } catch {
    throw new ApiError('NETWORK', 'No internet connection. Check your network.');
  }

  if (!response.ok) {
    throw new ApiError('UPLOAD_FAILED', `Audio upload failed (${response.status}). Try again.`);
  }
}

export async function completeSession(apiKey, sessionId) {
  const data = await request(apiKey, API.ENDPOINTS.COMPLETE(sessionId), { method: 'POST' });
  return data.transcription;
}

export async function transcribeOneShot(apiKey, blob, mimeType) {
  const formData = new FormData();
  formData.append('file', toUploadFile(blob, mimeType));

  const url = `${API.BASE}${API.ENDPOINTS.TRANSCRIBE}`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
  } catch {
    throw new ApiError('NETWORK', 'No internet connection. Check your network.');
  }

  if (!response.ok) {
    const body = await parseErrorBody(response);
    throw errorForStatus(response.status, body?.detail ?? body?.message);
  }

  const data = await response.json();
  return data.transcription;
}

export async function transcribeViaSession(apiKey, blob, mimeType) {
  const contentType = baseContentType(mimeType);
  const session = await createSession(apiKey, contentType);
  await uploadToPresignedUrl(session.uploadUrl, session.contentType, blob);
  return completeSession(apiKey, session.sessionId);
}

export async function transcribeRecording(apiKey, blob, mimeType, recordingDurationMs = 0) {
  if (!blob || blob.size === 0) {
    throw new ApiError('EMPTY_AUDIO', 'No audio recorded. Try again.');
  }

  if (blob.size < MIN_BLOB_BYTES) {
    throw new ApiError('TOO_SHORT', `Recording too short (${blob.size} bytes). Hold the shortcut and speak longer.`);
  }

  if (recordingDurationMs > 0 && recordingDurationMs < MIN_RECORDING_MS) {
    throw new ApiError('TOO_SHORT', 'Recording too short. Hold the shortcut and speak a bit longer.');
  }

  const useOneShot = recordingDurationMs < SHORT_RECORDING_MS;

  if (useOneShot) {
    try {
      return await withRetry(() => transcribeOneShot(apiKey, blob, mimeType));
    } catch (err) {
      if (!(err instanceof ApiError) || !RETRYABLE_CODES.has(err.code)) throw err;
      return withRetry(() => transcribeViaSession(apiKey, blob, mimeType));
    }
  }

  return withRetry(() => transcribeViaSession(apiKey, blob, mimeType));
}

export { ApiError };
