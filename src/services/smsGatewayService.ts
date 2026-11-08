/**
 * Kenyan Cellular SMS Gateway Integration Service
 * Connects directly to Africa's Talking API, Twilio, and Safaricom bulk SMS gateways
 * via server-side proxy route (/api/sms/dispatch).
 * Enforces strict Kenyan 07... and 01... phone number compliance and E.164 translation.
 */
import { validateKenyanPhoneNumber } from './cryptoService';

export interface SmsGatewayConfig {
  provider: 'africastalking' | 'twilio' | 'safaricom_bulk' | 'local_aggregator';
  senderId: string; // e.g. "ELIMUPULSE" (Max 11 alphanumeric chars)
  apiKey: string;
  usernameOrPartnerId: string;
  customEndpoint?: string;
  shortCode?: string;
  smsBalanceUnits: number;
  environment: 'production' | 'sandbox';
}

const DEFAULT_CONFIG: SmsGatewayConfig = {
  provider: 'africastalking',
  senderId: 'ELIMUPULSE',
  apiKey: '',
  usernameOrPartnerId: 'sandbox',
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
  deliveryStatus: 'Sent' | 'Delivered' | 'Failed';
  timestamp: string;
  gatewayMessage?: string;
  error?: string;
  rawResponse?: any;
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
    const response = await fetch('/api/sms/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        messageId: data.messageId || `err-${Date.now()}`,
        recipientPhone: cleanPhone,
        senderId: config.senderId || 'ELIMUPULSE',
        networkCarrier: data.networkCarrier || networkCarrier,
        costUnits: 0,
        remainingBalance: config.smsBalanceUnits,
        deliveryStatus: 'Failed',
        timestamp: new Date().toISOString(),
        error: data.error || 'The SMS Gateway failed to dispatch the message.',
        rawResponse: data,
      };
    }

    // Deduct credit
    const newBalance = Math.max(0, config.smsBalanceUnits - 1);
    saveSmsGatewayConfig({ smsBalanceUnits: newBalance });

    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      success: true,
      messageId: data.messageId,
      recipientPhone: cleanPhone,
      senderId: data.senderId || config.senderId,
      networkCarrier: data.networkCarrier || networkCarrier,
      costUnits: 1,
      remainingBalance: newBalance,
      deliveryStatus: data.deliveryStatus || 'Delivered',
      gatewayMessage: data.gatewayMessage,
      timestamp: `${now.toISOString().slice(0, 10)} ${formattedTime}`,
      rawResponse: data.rawResponse,
    };
  } catch (error: any) {
    return {
      success: false,
      messageId: `err-${Date.now()}`,
      recipientPhone: cleanPhone,
      senderId: config.senderId || 'ELIMUPULSE',
      networkCarrier,
      costUnits: 0,
      remainingBalance: config.smsBalanceUnits,
      deliveryStatus: 'Failed',
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
    const res = await fetch('/api/sms/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.usernameOrPartnerId,
        apiKey: config.apiKey,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        balanceText: '',
        error: data.error || 'Unable to retrieve wallet balance.',
      };
    }

    return {
      success: true,
      balanceText: data.balanceRaw || `${data.balance} units`,
    };
  } catch (error: any) {
    return {
      success: false,
      balanceText: '',
      error: error?.message || 'Connection to SMS Gateway server failed.',
    };
  }
}
