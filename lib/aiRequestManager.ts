export type AIRequestStatus =
  | "Idle"
  | "Processing"
  | "Rate Limited"
  | "Waiting"
  | "Error";

export type AIRequestState = {
  status: AIRequestStatus;

  activeRequests: number;

  queuedRequests: number;

  failedRequests: number;

  lastError: string;

  retryAt: string;
};

const STORAGE_KEY = "ai_request_manager";

const defaultState: AIRequestState = {
  status: "Idle",

  activeRequests: 0,

  queuedRequests: 0,

  failedRequests: 0,

  lastError: "",

  retryAt: "",
};

export function getAIRequestState(): AIRequestState {
  if (typeof window === "undefined") {
    return defaultState;
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));

    return defaultState;
  }

  try {
    return JSON.parse(saved) as AIRequestState;
  } catch {
    return defaultState;
  }
}

export function saveAIRequestState(state: AIRequestState) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function markAIRequestStarted() {
  const current = getAIRequestState();

  saveAIRequestState({
    ...current,

    status: "Processing",

    activeRequests: current.activeRequests + 1,

    lastError: "",
  });
}

export function markAIRequestCompleted() {
  const current = getAIRequestState();

  const activeRequests = Math.max(0, current.activeRequests - 1);

  saveAIRequestState({
    ...current,

    status: activeRequests > 0 ? "Processing" : "Idle",

    activeRequests,
  });
}

export function markAIRequestRateLimited(
  retryAfterSeconds: number,
  errorMessage: string,
) {
  const current = getAIRequestState();

  const retryAt = new Date(Date.now() + retryAfterSeconds * 1000).toISOString();

  saveAIRequestState({
    ...current,

    status: "Rate Limited",

    activeRequests: Math.max(0, current.activeRequests - 1),

    queuedRequests: current.queuedRequests + 1,

    lastError: errorMessage,

    retryAt,
  });
}

export function markAIRequestWaiting() {
  const current = getAIRequestState();

  saveAIRequestState({
    ...current,

    status: "Waiting",
  });
}

export function markQueuedRequestStarted() {
  const current = getAIRequestState();

  saveAIRequestState({
    ...current,

    status: "Processing",

    queuedRequests: Math.max(0, current.queuedRequests - 1),

    activeRequests: current.activeRequests + 1,
  });
}

export function markAIRequestFailed(errorMessage: string) {
  const current = getAIRequestState();

  saveAIRequestState({
    ...current,

    status: "Error",

    activeRequests: Math.max(0, current.activeRequests - 1),

    failedRequests: current.failedRequests + 1,

    lastError: errorMessage,
  });
}

export function resetAIRequestManager() {
  saveAIRequestState(defaultState);
}
