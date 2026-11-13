/**
 * Kenyan Cellular SMS Gateway Integration Service
 * Connects directly to Africa's Talking API, Twilio, and Safaricom bulk SMS gateways
 * via server-side proxy route (/api/sms/dispatch).
 * Enforces strict Kenyan 07... and 01... phone number compliance and E.164 translation.
 */
import { validateKenyanPhoneNumber } from './cryptoService';

export interface SmsGatewayConfig {
  provider: 'africastalking' | 'twilio' | 'safaricom_bulk' | 'local_aggregator';
  senderId: string; // e.g. "ELIMUPULSE" (Max 11 alphanumeric chars) or blank for shared verified ID
  apiKey: string;
  usernameOrPartnerId: string;
  customEndpoint?: string;
  backendProxyUrl?: string; // Optional external Node/Cloud Run backend base URL when hosted on a static host
  shortCode?: string;
  smsBalanceUnits: number;
  environment: 'production' | 'sandbox';
}

const DEFAULT_CONFIG: SmsGatewayConfig = {
  provider: 'africastalking',
  senderId: '',
  apiKey: '',
  usernameOrPartnerId: '',
  backendProxyUrl: '',
  shortCode: '28491',
  smsBalanceUnits: 3450,
  environment: 'production',
};

const STORAGE_KEY = 'elimupulse_sms_gateway_config_v2';

export function getSmsGatewayConfig(): SmsGatewayConfig {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      /* ignore */
    }
  }
  return DEFAULT_CONFIG;
}

export function saveSmsGatewayConfig(config: Partial<SmsGatewayConfig>): SmsGatewayConfig {
  const current = getSmsGatewayConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export interface SmsDispatchResult {
  success: boolean;
  messageId: string;
  recipientPhone: string;
  senderId: string;
  networkCarrier: 'Safaricom' | 'Airtel Kenya' | 'Equitel' | 'Unknown';
  costUnits: number;
  remainingBalance: number;
  deliveryStatus: string;
  isSimulated?: boolean;
  environment?: 'production' | 'sandbox';
  timestamp: string;
  gatewayMessage?: string;
  error?: string;
  rawResponse?: any;
}

export interface GatewayServerStatus {
  gateway?: string;
  provider?: string;
  isServerKeyConfigured?: boolean;
  username?: string;
  senderId?: string;
  environment?: string;
  reachable: boolean;
  htmlFallbackDetected?: boolean;
}

function buildApiUrl(path: string, backendProxyUrl?: string): string {
  const base = (backendProxyUrl || '').trim().replace(/\/+$/, '');
  if (!base) return path;
  return `${base}${path}`;
}

async function safeParseApiResponse(response: Response): Promise<{
  ok: boolean;
  data: any;
  isHtmlFallback: boolean;
  errorMessage?: string;
}> {
  const rawText = await response.text();
  const trimmed = rawText.trim();
  const looksLikeHtml =
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<');

  if (looksLikeHtml) {
    return {
      ok: false,
      data: null,
      isHtmlFallback: true,
      errorMessage:
        'Gateway API (/api/sms/dispatch) returned an HTML web page instead of JSON. If you installed this app as a PWA or deployed it to static hosting (e.g. Netlify without serverless functions), clear site cache or configure a Live Gateway Proxy Server URL below.',
    };
  }

  try {
    const parsed = trimmed ? JSON.parse(trimmed) : {};
    return {
      ok: response.ok,
      data: parsed,
      isHtmlFallback: false,
      errorMessage: parsed?.error || (!response.ok ? `HTTP ${response.status} from SMS Gateway` : undefined),
    };
  } catch {
    return {
      ok: false,
      data: null,
      isHtmlFallback: false,
      errorMessage: `Unexpected non-JSON response (${response.status}): ${trimmed.slice(0, 140)}`,
    };
  }
}

export async function fetchGatewayServerStatus(): Promise<GatewayServerStatus> {
  const config = getSmsGatewayConfig();
  try {
    const res = await fetch(buildApiUrl('/api/sms/status', config.backendProxyUrl), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const parsed = await safeParseApiResponse(res);
    if (parsed.isHtmlFallback || !parsed.ok || !parsed.data) {
      return {
        reachable: false,
        htmlFallbackDetected: parsed.isHtmlFallback,
      };
    }
    return {
      ...parsed.data,
      reachable: true,
      htmlFallbackDetected: false,
    };
  } catch {
    return { reachable: false };
  }
}

/**
 * Dispatches real SMS through the server-side cellular SMS gateway route.
 */
export async function dispatchRealSms(
  targetPhone: string,
  messageText: string
): Promise<SmsDispatchResult> {
  const validation = validateKenyanPhoneNumber(targetPhone);
  if (!validation.isValid) {
    return {
      success: false,
      messageId: `err-${Date.now()}`,
      recipientPhone: targetPhone,
      senderId: 'ERROR',
      networkCarrier: 'Unknown',
      costUnits: 0,
      remainingBalance: getSmsGatewayConfig().smsBalanceUnits,
      deliveryStatus: 'Failed',
      timestamp: new Date().toISOString(),
      error: validation.error || 'Invalid phone format. Must start with 07... or 01...',
    };
  }

  const cleanPhone = validation.cleanPhone!;
  const config = getSmsGatewayConfig();

  // Detect Kenyan Carrier by prefix
  let networkCarrier: 'Safaricom' | 'Airtel Kenya' | 'Equitel' | 'Unknown' = 'Safaricom';
  if (cleanPhone.startsWith('073') || cleanPhone.startsWith('075') || cleanPhone.startsWith('078') || cleanPhone.startsWith('010')) {
    networkCarrier = 'Airtel Kenya';
  } else if (cleanPhone.startsWith('076')) {
    networkCarrier = 'Equitel';
  }

  try {
    const url = buildApiUrl('/api/sms/dispatch', config.backendProxyUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        to: cleanPhone,
        message: messageText,
        provider: config.provider,
        senderId: config.senderId,
        username: config.usernameOrPartnerId,
        apiKey: config.apiKey,
        environment: config.environment,
        customEndpoint: config.customEndpoint,
      }),
    });

    const parsed = await safeParseApiResponse(response);

    if (parsed.isHtmlFallback || !parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        messageId: parsed.data?.messageId || `err-${Date.now()}`,
        recipientPhone: cleanPhone,
        senderId: config.senderId || 'SHARED',
        networkCarrier: parsed.data?.networkCarrier || networkCarrier,
        costUnits: 0,
        remainingBalance: config.smsBalanceUnits,
        deliveryStatus: 'Failed',
        environment: config.environment,
        timestamp: new Date().toISOString(),
        error: parsed.errorMessage || parsed.data?.error || 'The SMS Gateway failed to dispatch the message.',
        rawResponse: parsed.data,
      };
    }

    const data = parsed.data;
    const newBalance = Math.max(0, config.smsBalanceUnits - 1);
    saveSmsGatewayConfig({ smsBalanceUnits: newBalance });

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      success: true,
      messageId: data.messageId,
      recipientPhone: cleanPhone,
      senderId: data.senderId || config.senderId || 'SHARED',
      networkCarrier: data.networkCarrier || networkCarrier,
      costUnits: 1,
      remainingBalance: newBalance,
      deliveryStatus: data.deliveryStatus || 'Sent to Cellular Network',
      isSimulated: Boolean(data.isSimulated),
      environment: data.environment || config.environment,
      gatewayMessage: data.gatewayMessage,
      timestamp: `${now.toISOString().slice(0, 10)} ${formattedTime}`,
      rawResponse: data.rawResponse,
    };
  } catch (error: any) {
    return {
      success: false,
      messageId: `err-${Date.now()}`,
      recipientPhone: cleanPhone,
      senderId: config.senderId || 'SHARED',
      networkCarrier,
      costUnits: 0,
      remainingBalance: config.smsBalanceUnits,
      deliveryStatus: 'Failed',
      environment: config.environment,
      timestamp: new Date().toISOString(),
      error: error?.message || 'Failed to connect to SMS Gateway server endpoint.',
    };
  }
}

/**
 * Checks live wallet balance from the SMS Gateway provider
 */
export async function fetchLiveGatewayBalance(): Promise<{
  success: boolean;
  balanceText: string;
  error?: string;
}> {
  const config = getSmsGatewayConfig();
  try {
    const res = await fetch(buildApiUrl('/api/sms/balance', config.backendProxyUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        username: config.usernameOrPartnerId,
        apiKey: config.apiKey,
        environment: config.environment,
      }),
    });

    const parsed = await safeParseApiResponse(res);
    if (parsed.isHtmlFallback || !parsed.ok || !parsed.data?.success) {
      return {
        success: false,
        balanceText: '',
        error: parsed.errorMessage || parsed.data?.error || 'Unable to retrieve wallet balance.',
      };
    }

    const data = parsed.data;
    return {
      success: true,
      balanceText: `${data.balanceRaw || `${data.balance} units`} (${data.environment === 'sandbox' ? 'Sandbox Simulator' : 'Live Production'})`,
    };
  } catch (error: any) {
    return {
      success: false,
      balanceText: '',
      error: error?.message || 'Connection to SMS Gateway server failed.',
    };
  }
}
