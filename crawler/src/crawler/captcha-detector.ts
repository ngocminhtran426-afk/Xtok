// ===== CAPTCHA Detector =====
// Checks HTTP responses for common CAPTCHA patterns.
// If detected, crawler STOPS and marks job as captcha_detected.
// Does NOT attempt to bypass or solve CAPTCHA.

export interface CaptchaCheckResult {
  detected: boolean;
  type?: string;
  message?: string;
}

// Common CAPTCHA indicators in response body
const CAPTCHA_PATTERNS = [
  /captcha/i,
  /recaptcha/i,
  /hcaptcha/i,
  /cf-challenge/i,         // Cloudflare challenge
  /challenge-platform/i,
  /turnstile/i,            // Cloudflare Turnstile
  /cdn-cgi\/challenge/i,   // Cloudflare challenge path
  /please verify you are human/i,
  /are you a robot/i,
  /bot detection/i,
  /access denied/i,
  /rate limit/i,
];

// HTTP status codes that may indicate blocking
const BLOCK_STATUS_CODES = [403, 429, 503];

/**
 * Check if a response indicates CAPTCHA or bot detection.
 */
export function detectCaptcha(
  statusCode: number,
  responseBody: string,
  headers?: Record<string, string>,
): CaptchaCheckResult {
  // Check status code
  if (BLOCK_STATUS_CODES.includes(statusCode)) {
    // 429 is rate limit, 403 could be CAPTCHA, 503 could be challenge
    for (const pattern of CAPTCHA_PATTERNS) {
      if (pattern.test(responseBody)) {
        return {
          detected: true,
          type: 'captcha_in_body',
          message: `CAPTCHA detected (HTTP ${statusCode}, pattern: ${pattern.source})`,
        };
      }
    }

    // Even without CAPTCHA patterns, 429 means we should back off
    if (statusCode === 429) {
      return {
        detected: true,
        type: 'rate_limit',
        message: 'Rate limited (HTTP 429)',
      };
    }
  }

  // Check Cloudflare specific headers
  if (headers) {
    const cfRay = headers['cf-ray'];
    const server = headers['server']?.toLowerCase();
    
    if (server === 'cloudflare' && statusCode === 403) {
      return {
        detected: true,
        type: 'cloudflare_block',
        message: 'Cloudflare block detected',
      };
    }
  }

  // Check body for CAPTCHA patterns regardless of status code
  for (const pattern of CAPTCHA_PATTERNS) {
    if (pattern.test(responseBody)) {
      // Only flag as CAPTCHA if the page is suspiciously short
      // (a normal page with the word "captcha" in content shouldn't trigger)
      if (responseBody.length < 10000) {
        return {
          detected: true,
          type: 'captcha_page',
          message: `Possible CAPTCHA page (pattern: ${pattern.source}, body length: ${responseBody.length})`,
        };
      }
    }
  }

  return { detected: false };
}
