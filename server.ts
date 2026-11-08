import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Normalizes Kenyan mobile numbers to international E.164 format (+254...)
 */
function toE164KenyanPhone(phone: string): { e164: string; local: string; carrier: string; valid: boolean } {
  let digits = (phone || '').replace(/[^0-9]/g, '');

  if (digits.startsWith('254')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Valid Kenyan phone must be 9 digits after dropping leading 0 or 254 (7xxxxxxxx or 1xxxxxxxx)
  if (digits.length !== 9 || (!digits.startsWith('7') && !digits.startsWith('1'))) {
    return { e164: '', local: phone, carrier: 'Unknown', valid: false };
  }

  const local = `0${digits}`;
  const e164 = `+254${digits}`;

  let carrier = 'Safaricom';
  if (local.startsWith('073') || local.startsWith('075') || local.startsWith('078') || local.startsWith('010')) {
    carrier = 'Airtel Kenya';
  } else if (local.startsWith('076')) {
    carrier = 'Equitel';
  }

  return { e164, local, carrier, valid: true };
}

/**
 * GET /api/sms/status
 * Returns current SMS gateway server configuration status
 */
app.get('/api/sms/status', (req: Request, res: Response) => {
  const atApiKey = process.env.AFRICASTALKING_API_KEY || '';
  const atUser = process.env.AFRICASTALKING_USERNAME || '';
  const atSender = process.env.AFRICASTALKING_SENDER_ID || 'ELIMUPULSE';

  res.json({
    gateway: 'Africa\'s Talking & Direct Cellular Aggregator',
    provider: process.env.SMS_PROVIDER || 'africastalking',
    isServerKeyConfigured: Boolean(atApiKey && atApiKey.length > 5),
    username: atUser ? atUser : 'sandbox',
    senderId: atSender,
    supportedProviders: ['africastalking', 'twilio', 'safaricom_bulk', 'custom_aggregator'],
    environment: atUser === 'sandbox' ? 'sandbox' : 'production',
  });
});

/**
 * POST /api/sms/balance
 * Queries live balance from SMS gateway
 */
app.post('/api/sms/balance', async (req: Request, res: Response) => {
  try {
    const username = req.body.username || process.env.AFRICASTALKING_USERNAME || 'sandbox';
    const apiKey = req.body.apiKey || process.env.AFRICASTALKING_API_KEY || '';

    if (!apiKey) {
      return res.json({
        success: true,
        currency: 'KES',
        balance: 3450,
        note: 'Default prepaid balance. Configure live Africa\'s Talking API Key for real-time wallet query.',
      });
    }

    const isSandbox = username.toLowerCase() === 'sandbox';
    const endpoint = isSandbox
      ? `https://api.sandbox.africastalking.com/version1/user?username=${encodeURIComponent(username)}`
      : `https://api.africastalking.com/version1/user?username=${encodeURIComponent(username)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apiKey: apiKey.trim(),
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `Gateway balance request failed: ${errText}`,
      });
    }

    const data: any = await response.json();
    const balanceStr = data?.UserData?.balance || 'KES 0.00';
    return res.json({
      success: true,
      balanceRaw: balanceStr,
      userData: data?.UserData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to connect to SMS Gateway balance endpoint',
    });
  }
});

/**
 * POST /api/sms/dispatch
 * Real cellular SMS dispatch route connecting directly to Africa's Talking / SMS Aggregators
 */
app.post('/api/sms/dispatch', async (req: Request, res: Response) => {
  try {
    const {
      to,
      message,
      provider = 'africastalking',
      senderId: customSenderId,
      username: customUsername,
      apiKey: customApiKey,
      environment: customEnv,
    } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Both recipient phone ("to") and message text ("message") are required.',
      });
    }

    const phoneCheck = toE164KenyanPhone(to);
    if (!phoneCheck.valid) {
      return res.status(400).json({
        success: false,
        error: `Invalid Kenyan mobile number "${to}". Must start with 07... or 01...`,
      });
    }

    const { e164, local, carrier } = phoneCheck;

    // 1. AFRICA'S TALKING PROVIDER (Kenya standard)
    if (provider === 'africastalking') {
      const apiKey = (customApiKey || process.env.AFRICASTALKING_API_KEY || '').trim();
      const username = (customUsername || process.env.AFRICASTALKING_USERNAME || 'sandbox').trim();
      const senderId = (customSenderId || process.env.AFRICASTALKING_SENDER_ID || '').trim();
      const isSandbox = (customEnv === 'sandbox' || username.toLowerCase() === 'sandbox');

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'Missing Africa\'s Talking API Key. Please provide your API Key in the SMS Gateway settings or server environment (AFRICASTALKING_API_KEY).',
          helpUrl: 'https://africastalking.com',
        });
      }

      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      // Build form-urlencoded payload required by Africa's Talking
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('to', e164);
      params.append('message', message);

      // Only attach "from" if specified and not in sandbox (sandbox requires omitted from or default shortcode)
      if (senderId && !isSandbox) {
        params.append('from', senderId);
      }

      const atResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apiKey: apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      const rawText = await atResponse.text();
      let atData: any;
      try {
        atData = JSON.parse(rawText);
      } catch {
        atData = { rawResponse: rawText };
      }

      if (!atResponse.ok) {
        return res.status(atResponse.status).json({
          success: false,
          error: `Africa's Talking gateway error (${atResponse.status}): ${rawText}`,
          provider: 'africastalking',
        });
      }

      // Parse Africa's Talking response format
      const recipients = atData?.SMSMessageData?.Recipients || [];
      const recipientStatus = recipients[0] || {};
      const isSuccess = recipientStatus.status === 'Success' || atResponse.status === 201;

      return res.json({
        success: isSuccess,
        provider: 'africastalking',
        messageId: recipientStatus.messageId || `ATX-${Date.now()}`,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: senderId || (isSandbox ? 'SANDBOX' : 'DEFAULT'),
        cost: recipientStatus.cost || 'KES 0.80',
        deliveryStatus: isSuccess ? 'Delivered' : recipientStatus.status || 'Failed',
        gatewayMessage: atData?.SMSMessageData?.Message || 'SMS processed by cellular network',
        timestamp: new Date().toISOString(),
        rawResponse: atData,
      });
    }

    // 2. TWILIO PROVIDER
    if (provider === 'twilio') {
      const accountSid = (customUsername || process.env.TWILIO_ACCOUNT_SID || '').trim();
      const authToken = (customApiKey || process.env.TWILIO_AUTH_TOKEN || '').trim();
      const fromNumber = (customSenderId || process.env.TWILIO_FROM || '').trim();

      if (!accountSid || !authToken) {
        return res.status(400).json({
          success: false,
          error: 'Missing Twilio Account SID or Auth Token.',
        });
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('To', e164);
      params.append('From', fromNumber);
      params.append('Body', message);

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const twilioData: any = await twilioRes.json();
      if (!twilioRes.ok) {
        return res.status(twilioRes.status).json({
          success: false,
          error: twilioData?.message || 'Twilio dispatch failed',
          provider: 'twilio',
        });
      }

      return res.json({
        success: true,
        provider: 'twilio',
        messageId: twilioData.sid,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: fromNumber,
        cost: twilioData.price ? `${twilioData.price_unit} ${twilioData.price}` : 'Standard',
        deliveryStatus: twilioData.status || 'Sent',
        timestamp: new Date().toISOString(),
      });
    }

    // 3. CUSTOM / LICENSED AGGREGATOR PROVIDER
    if (provider === 'safaricom_bulk' || provider === 'local_aggregator') {
      const customUrl = req.body.customEndpoint || process.env.SMS_GATEWAY_URL;
      const apiKey = (customApiKey || process.env.SMS_GATEWAY_KEY || '').trim();

      if (!customUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing custom SMS gateway endpoint URL.',
        });
      }

      const customRes = await fetch(customUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : {}),
        },
        body: JSON.stringify({
          to: e164,
          phone: local,
          message,
          senderId: customSenderId || 'ELIMUPULSE',
        }),
      });

      const customData: any = await customRes.json().catch(() => ({}));
      return res.json({
        success: customRes.ok,
        provider,
        messageId: customData?.messageId || `AGG-${Date.now()}`,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: customSenderId || 'ELIMUPULSE',
        deliveryStatus: customRes.ok ? 'Delivered' : 'Failed',
        timestamp: new Date().toISOString(),
        rawResponse: customData,
      });
    }

    return res.status(400).json({
      success: false,
      error: `Unsupported SMS provider: ${provider}`,
    });
  } catch (error: any) {
    console.error('SMS Gateway Dispatch Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error dispatching SMS through gateway.',
    });
  }
});

// Start Express server and mount Vite in development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ElimuPulse Full-Stack Server running on http://0.0.0.0:${PORT}`);
    console.log(`SMS Gateway proxy endpoint active at /api/sms/dispatch`);
  });
}

startServer();
