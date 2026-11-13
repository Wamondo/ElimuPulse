import express, { Request, Response, NextFunction } from 'express';
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

// Allow cross-origin calls from standalone PWA or external static frontends to /api/*
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function isSandboxKeyCheck(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.sandbox.africastalking.com/version1/user?username=sandbox', {
      method: 'GET',
      headers: {
        apiKey: apiKey.trim(),
        Accept: 'application/json',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /api/sms/status
 * Returns current SMS gateway server configuration status
 */
app.get('/api/sms/status', (req: Request, res: Response) => {
  const atApiKey = (process.env.AFRICASTALKING_API_KEY || '').trim();
  const atUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
  const atSender = (process.env.AFRICASTALKING_SENDER_ID || '').trim();

  res.json({
    gateway: "Africa's Talking & Direct Cellular Aggregator",
    provider: process.env.SMS_PROVIDER || 'africastalking',
    isServerKeyConfigured: Boolean(atApiKey && atApiKey.length > 5),
    username: atUser || 'sandbox',
    senderId: atSender,
    supportedProviders: ['africastalking', 'twilio', 'safaricom_bulk', 'local_aggregator'],
    environment: atUser.toLowerCase() === 'sandbox' ? 'sandbox' : 'production',
  });
});

/**
 * POST /api/sms/balance
 * Queries live balance from SMS gateway
 */
app.post('/api/sms/balance', async (req: Request, res: Response) => {
  try {
    const customEnv = (req.body.environment || '').toLowerCase();
    const rawCustomUser = (req.body.username || '').trim();
    const envUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
    const apiKey = (req.body.apiKey || process.env.AFRICASTALKING_API_KEY || '').trim();

    // If user left default 'sandbox' while selecting production and server env has a non-sandbox user, prefer server env user unless customApiKey was also given
    const username =
      customEnv === 'sandbox'
        ? 'sandbox'
        : rawCustomUser && rawCustomUser.toLowerCase() !== 'sandbox'
        ? rawCustomUser
        : envUser || rawCustomUser || 'sandbox';

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "No Africa's Talking API key configured. Enter your Live API Key or set AFRICASTALKING_API_KEY.",
      });
    }

    const isSandbox = customEnv === 'sandbox' || username.toLowerCase() === 'sandbox';
    const endpoint = isSandbox
      ? `https://api.sandbox.africastalking.com/version1/user?username=${encodeURIComponent(username)}`
      : `https://api.africastalking.com/version1/user?username=${encodeURIComponent(username)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apiKey,
        Accept: 'application/json',
      },
    });

    const rawText = await response.text();
    const data = safeParseJson(rawText);

    if (!response.ok) {
      if (response.status === 401 && !isSandbox) {
        const worksOnSandbox = await isSandboxKeyCheck(apiKey);
        if (worksOnSandbox) {
          return res.status(401).json({
            success: false,
            error:
              "Authentication rejected on Live Production: Your configured API key is an Africa's Talking SANDBOX key (works only in simulator mode). Replace it with your Live App API Key & Username from dashboard.africastalking.com for real phone delivery.",
          });
        }
      }
      return res.status(response.status).json({
        success: false,
        error: `Gateway balance request failed (${response.status}): ${data?.errorMessage || rawText}`,
      });
    }

    const balanceStr = data?.UserData?.balance || 'KES 0.00';
    return res.json({
      success: true,
      environment: isSandbox ? 'sandbox' : 'production',
      username,
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
 * Real cellular SMS dispatch route connecting directly to Africa's Talking / Twilio / Bulk Aggregators
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
      customEndpoint,
    } = req.body || {};

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
      const rawCustomUser = (customUsername || '').trim();
      const envUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
      const senderId = (customSenderId !== undefined ? customSenderId : process.env.AFRICASTALKING_SENDER_ID || '').trim();

      const requestedEnv = customEnv === 'sandbox' ? 'sandbox' : 'production';

      // Resolve effective username cleanly:
      // - In sandbox mode, Africa's Talking ALWAYS requires username "sandbox"
      // - In production mode, prefer explicit non-sandbox username, else server env username
      const username =
        requestedEnv === 'sandbox'
          ? 'sandbox'
          : rawCustomUser && rawCustomUser.toLowerCase() !== 'sandbox'
          ? rawCustomUser
          : envUser || rawCustomUser;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error:
            "Missing Africa's Talking API Key. Enter your Live API Key in Gateway Settings or set AFRICASTALKING_API_KEY on the server.",
          helpUrl: 'https://africastalking.com',
        });
      }

      if (requestedEnv === 'production' && (!username || username.toLowerCase() === 'sandbox')) {
        return res.status(400).json({
          success: false,
          error:
            'Real cellular handset delivery requires your Live Africa\'s Talking App Username (not "sandbox"). Switch Operational Environment to Sandbox for simulator tests, or enter your Live App Username & Live API Key for real phone delivery.',
        });
      }

      const isSandbox = requestedEnv === 'sandbox';
      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const sendViaAfricasTalking = async (useSenderId: string) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('to', e164);
        params.append('message', message);

        if (useSenderId && !isSandbox) {
          params.append('from', useSenderId);
        }

        const atResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: params.toString(),
        });

        const rawText = await atResponse.text();
        const atData = safeParseJson(rawText) || { rawResponse: rawText };
        return { atResponse, rawText, atData };
      };

      let { atResponse, rawText, atData } = await sendViaAfricasTalking(senderId);

      // If live production fails with InvalidSenderId because alphanumeric sender ID isn't CAK-registered yet,
      // automatically retry with shared verified Africa's Talking sender ID (omit `from`)
      const firstRecipient = atData?.SMSMessageData?.Recipients?.[0];
      const msgText = String(atData?.SMSMessageData?.Message || rawText || '');
      let effectiveSenderId = senderId || (isSandbox ? 'SANDBOX' : 'SHARED');

      if (
        !isSandbox &&
        senderId &&
        (firstRecipient?.status === 'InvalidSenderId' || msgText.includes('InvalidSenderId'))
      ) {
        const retry = await sendViaAfricasTalking('');
        atResponse = retry.atResponse;
        rawText = retry.rawText;
        atData = retry.atData;
        effectiveSenderId = 'SHARED (Verified)';
      }

      if (!atResponse.ok) {
        if (atResponse.status === 401 && !isSandbox) {
          const worksOnSandbox = await isSandboxKeyCheck(apiKey);
          if (worksOnSandbox) {
            return res.status(401).json({
              success: false,
              error:
                'Cannot deliver to real cellular phones: Your API key is an Africa\'s Talking SANDBOX key (simulator only). To send real SMS to ' +
                local +
                ', open dashboard.africastalking.com -> create/select a Live App -> generate a Live API Key, fund your SMS wallet via M-Pesa, and save your Live Username & Live API Key here.',
              provider: 'africastalking',
              environment: requestedEnv,
            });
          }
        }

        return res.status(atResponse.status).json({
          success: false,
          error: `Africa's Talking gateway error (${atResponse.status}): ${atData?.errorMessage || rawText}`,
          provider: 'africastalking',
          environment: requestedEnv,
        });
      }

      // Check recipient-level delivery status (AT returns HTTP 201 even when individual recipients fail!)
      const recipients = atData?.SMSMessageData?.Recipients || [];
      const recipientStatus = recipients[0] || {};
      const statusText = String(recipientStatus.status || '');
      const statusCode = Number(recipientStatus.statusCode || 0);
      const isRecipientAccepted =
        statusText === 'Success' ||
        statusText === 'Sent' ||
        statusCode === 100 ||
        statusCode === 101 ||
        statusCode === 102;

      if (!isRecipientAccepted) {
        return res.status(400).json({
          success: false,
          provider: 'africastalking',
          environment: requestedEnv,
          recipientPhone: local,
          networkCarrier: carrier,
          error: `Cellular carrier/gateway rejected SMS (${statusText || atData?.SMSMessageData?.Message || 'Rejected'}). Check account SMS balance, sender ID, or DND status.`,
          rawResponse: atData,
        });
      }

      return res.json({
        success: true,
        provider: 'africastalking',
        environment: requestedEnv,
        isSimulated: isSandbox,
        messageId: recipientStatus.messageId || `ATX-${Date.now()}`,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: effectiveSenderId,
        cost: recipientStatus.cost || 'KES 0.80',
        deliveryStatus: isSandbox ? 'Simulated (Sandbox)' : 'Sent to Cellular Network',
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

      if (!accountSid || !authToken || !fromNumber) {
        return res.status(400).json({
          success: false,
          error: 'Missing Twilio Account SID, Auth Token, or From Phone/Sender Number.',
        });
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
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

      const rawText = await twilioRes.text();
      const twilioData = safeParseJson(rawText) || {};

      if (!twilioRes.ok) {
        return res.status(twilioRes.status).json({
          success: false,
          error: twilioData?.message || `Twilio dispatch failed (${twilioRes.status})`,
          provider: 'twilio',
        });
      }

      return res.json({
        success: true,
        provider: 'twilio',
        environment: 'production',
        isSimulated: false,
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

    // 3. CUSTOM / SAFARICOM BULK / KENYAN LICENSED AGGREGATOR PROVIDER
    if (provider === 'safaricom_bulk' || provider === 'local_aggregator') {
      const customUrl = (customEndpoint || process.env.SMS_GATEWAY_URL || '').trim();
      const apiKey = (customApiKey || process.env.SMS_GATEWAY_KEY || '').trim();
      const partnerId = (customUsername || process.env.SMS_PARTNER_ID || '').trim();

      if (!customUrl) {
        return res.status(400).json({
          success: false,
          error: 'Missing Custom Bulk SMS Gateway HTTP API Endpoint URL.',
        });
      }

      const customRes = await fetch(customUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey, apikey: apiKey } : {}),
        },
        body: JSON.stringify({
          to: e164,
          mobile: e164,
          phone: local,
          message,
          shortcode: customSenderId || 'ELIMUPULSE',
          senderId: customSenderId || 'ELIMUPULSE',
          partnerID: partnerId || undefined,
          apikey: apiKey || undefined,
        }),
      });

      const rawText = await customRes.text();
      const customData = safeParseJson(rawText) || { rawResponse: rawText };

      if (!customRes.ok) {
        return res.status(customRes.status).json({
          success: false,
          provider,
          error: customData?.message || customData?.error || `Aggregator returned HTTP ${customRes.status}`,
          rawResponse: customData,
        });
      }

      return res.json({
        success: true,
        provider,
        environment: 'production',
        isSimulated: false,
        messageId: customData?.messageId || customData?.responses?.[0]?.messageid || `AGG-${Date.now()}`,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: customSenderId || 'ELIMUPULSE',
        deliveryStatus: 'Sent to Cellular Network',
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

// Guarantee /api/* routes never fall through to Vite HTML or static SPA index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
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
