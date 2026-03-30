import { getClientMessageStreamUrl } from './api';

const SUPPORTED_EVENTS = ['chat-message', 'chat-presence', 'chat-call'];
const listenersByEvent = new Map(
  SUPPORTED_EVENTS.map((eventName) => [eventName, new Set()])
);

let stream = null;

function dispatchEvent(eventName, rawEvent) {
  const listeners = listenersByEvent.get(eventName);
  if (!listeners || !listeners.size) {
    return;
  }

  for (const listener of listeners) {
    try {
      listener(rawEvent);
    } catch (error) {
      console.error(`[realtime] ${eventName} listener failed`, error);
    }
  }
}

export function ensureClientRealtimeStream() {
  if (stream) {
    return stream;
  }

  const streamUrl = getClientMessageStreamUrl();
  if (!streamUrl) {
    return null;
  }

  stream = new EventSource(streamUrl);

  for (const eventName of SUPPORTED_EVENTS) {
    stream.addEventListener(eventName, (event) => {
      dispatchEvent(eventName, event);
    });
  }

  stream.onerror = () => {
    // Native EventSource performs reconnection automatically.
  };

  return stream;
}

export function subscribeClientRealtime(eventName, listener) {
  if (!listenersByEvent.has(eventName)) {
    throw new Error(`Unsupported realtime event: ${eventName}`);
  }

  const listeners = listenersByEvent.get(eventName);
  listeners.add(listener);
  ensureClientRealtimeStream();

  return () => {
    listeners.delete(listener);
  };
}

export function closeClientRealtimeStream() {
  if (!stream) {
    return;
  }

  stream.close();
  stream = null;
}
