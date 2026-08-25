type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const WINDOW_MS = 60_000;

/*
  High enough for normal multi-agent
  missions, but low enough to stop
  runaway request loops.
*/

const MAX_REQUESTS_PER_WINDOW = 20;

/*
  Store timestamps on globalThis so
  Next.js development hot reloads do
  not immediately reset the limiter.
*/

const globalForRateLimit = globalThis as typeof globalThis & {
  aiStudioRequestTimes?: number[];
};

if (!globalForRateLimit.aiStudioRequestTimes) {
  globalForRateLimit.aiStudioRequestTimes = [];
}

export function checkAIServerRateLimit(): RateLimitResult {
  const now = Date.now();

  const requestTimes = globalForRateLimit.aiStudioRequestTimes ?? [];

  /*
    Remove requests older than
    the current one-minute window.
  */

  const recentRequests = requestTimes.filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestRequest = recentRequests[0];

    const retryAfterMs = WINDOW_MS - (now - oldestRequest);

    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    globalForRateLimit.aiStudioRequestTimes = recentRequests;

    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  recentRequests.push(now);

  globalForRateLimit.aiStudioRequestTimes = recentRequests;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}
