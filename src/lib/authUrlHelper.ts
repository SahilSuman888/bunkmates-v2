/**
 * Robust helper to extract Firebase Auth parameters (oobCode, mode, email, etc.)
 * from action links, dynamic links, nested email links, or raw clipboard strings.
 * Handles single, double, or triple URL encoding (e.g., %253D -> %3D -> =).
 */

export interface ParsedAuthUrl {
  isReset: boolean;
  oobCode: string | null;
  mode: string | null;
  apiKey: string | null;
  continueUrl: string | null;
}

/**
 * Safely decodes a URL string iteratively until no more %XX sequences change,
 * capped at maxIterations to prevent infinite loops.
 */
export function iterativeDecodeUri(input: string, maxIterations = 5): string {
  if (!input) return '';
  let current = input;
  for (let i = 0; i < maxIterations; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

/**
 * Extracts the Firebase out-of-band code (oobCode) from any URL, query string,
 * or raw code string.
 */
export function extractResetCode(urlOrText?: string | null): string | null {
  if (!urlOrText) return null;
  const trimmed = urlOrText.trim();
  if (!trimmed) return null;

  // Fully decode the input
  const decoded = iterativeDecodeUri(trimmed);

  // Search in both trimmed and fully decoded versions
  const candidates = [trimmed, decoded];

  for (const str of candidates) {
    // 1. Standard query param: ?oobCode=XYZ or &oobCode=XYZ
    const oobMatch = str.match(/[?&]oobCode=([^&#\s]+)/i);
    if (oobMatch && oobMatch[1]) {
      return iterativeDecodeUri(oobMatch[1]);
    }

    // 2. Encoded param: oobCode%3DXYZ or oobCode=XYZ
    const encodedMatch = str.match(/oobCode(?:%3D|=)([^%&#\s]+)/i);
    if (encodedMatch && encodedMatch[1]) {
      return iterativeDecodeUri(encodedMatch[1]);
    }

    // 3. Fallback to generic code param: ?code=XYZ or &code=XYZ
    const codeMatch = str.match(/[?&]code=([^&#\s]+)/i);
    if (codeMatch && codeMatch[1]) {
      return iterativeDecodeUri(codeMatch[1]);
    }
  }

  // 4. Raw action code check (Firebase oobCodes are typically 20+ chars of A-Za-z0-9_-)
  if (!trimmed.includes('://') && !trimmed.includes('/') && !trimmed.includes('&') && /^[A-Za-z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Parses full auth parameters from either a URL string or an Expo Router params object.
 */
export function parseAuthParams(input?: string | Record<string, any> | null): ParsedAuthUrl {
  if (!input) {
    return { isReset: false, oobCode: null, mode: null, apiKey: null, continueUrl: null };
  }

  let testString = '';
  let directOobCode: string | null = null;
  let directMode: string | null = null;
  let directApiKey: string | null = null;
  let directContinueUrl: string | null = null;

  if (typeof input === 'string') {
    testString = input;
  } else {
    // If input is an object from useLocalSearchParams()
    if (typeof input.oobCode === 'string') directOobCode = input.oobCode;
    if (typeof input.mode === 'string') directMode = input.mode;
    if (typeof input.apiKey === 'string') directApiKey = input.apiKey;
    if (typeof input.continueUrl === 'string') directContinueUrl = input.continueUrl;

    // Check nested 'link' parameter (Firebase email action links encapsulate nested URLs in 'link')
    if (typeof input.link === 'string') {
      testString = input.link;
    } else {
      testString = JSON.stringify(input);
    }
  }

  const oobCode = directOobCode || extractResetCode(testString);
  const decodedStr = iterativeDecodeUri(testString);

  // Extract mode
  let mode = directMode;
  if (!mode) {
    const modeMatch = decodedStr.match(/[?&]mode=([^&#\s]+)/i);
    if (modeMatch && modeMatch[1]) {
      mode = iterativeDecodeUri(modeMatch[1]);
    }
  }

  // Extract apiKey
  let apiKey = directApiKey;
  if (!apiKey) {
    const apiMatch = decodedStr.match(/[?&]apiKey=([^&#\s]+)/i);
    if (apiMatch && apiMatch[1]) {
      apiKey = iterativeDecodeUri(apiMatch[1]);
    }
  }

  // Extract continueUrl
  let continueUrl = directContinueUrl;
  if (!continueUrl) {
    const contMatch = decodedStr.match(/[?&]continueUrl=([^&#\s]+)/i);
    if (contMatch && contMatch[1]) {
      continueUrl = iterativeDecodeUri(contMatch[1]);
    }
  }

  const isReset =
    mode === 'resetPassword' ||
    Boolean(oobCode) ||
    decodedStr.toLowerCase().includes('resetpassword') ||
    decodedStr.toLowerCase().includes('reset-password');

  return {
    isReset,
    oobCode,
    mode,
    apiKey,
    continueUrl,
  };
}
