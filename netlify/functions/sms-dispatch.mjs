const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function toE164KenyanPhone(phone) {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('254')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.slice(1);

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

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function isSandboxKeyCheck(apiKey) {
  try {
    const res = await fetch('https://api.sandbox.africastalking.com/version1/user?username=sandbox', {
      method: 'GET',
      headers: { apiKey: apiKey.trim(), Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function jsonResp(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResp({ success: false, error: 'Method Not Allowed. Use POST.' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      to,
      message,
      provider = 'africastalking',
      senderId: customSenderId,
      username: customUsername,
      apiKey: customApiKey,
      environment: customEnv,
      customEndpoint,
    } = body;

    if (!to || !message) {
      return jsonResp({ success: false, error: 'Both recipient phone ("to") and message text ("message") are required.' }, 400);
    }

    const phoneCheck = toE164KenyanPhone(to);
    if (!phoneCheck.valid) {
      return jsonResp({ success: false, error: `Invalid Kenyan mobile number "${to}". Must start with 07... or 01...` }, 400);
    }

    const { e164, local, carrier } = phoneCheck;

    if (provider === 'africastalking') {
      const apiKey = (customApiKey || process.env.AFRICASTALKING_API_KEY || '').trim();
      const rawCustomUser = (customUsername || '').trim();
      const envUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
      const senderId = (customSenderId !== undefined ? customSenderId : process.env.AFRICASTALKING_SENDER_ID || '').trim();
      const requestedEnv = customEnv === 'sandbox' ? 'sandbox' : 'production';

      const username =
        requestedEnv === 'sandbox'
          ? 'sandbox'
          : rawCustomUser && rawCustomUser.toLowerCase() !== 'sandbox'
          ? rawCustomUser
          : envUser || rawCustomUser;

      if (!apiKey) {
        return jsonResp({ success: false, error: "Missing Africa's Talking API Key." }, 400);
      }

      if (requestedEnv === 'production' && (!username || username.toLowerCase() === 'sandbox')) {
        return jsonResp(
          {
            success: false,
            error:
              'Real cellular handset delivery requires your Live Africa\'s Talking App Username (not "sandbox"). Switch Operational Environment to Sandbox for simulator tests, or enter your Live App Username & Live API Key.',
          },
          400
        );
      }

      const isSandbox = requestedEnv === 'sandbox';
      const endpoint = isSandbox
        ? 'https://api.sandbox.africastalking.com/version1/messaging'
        : 'https://api.africastalking.com/version1/messaging';

      const sendViaAT = async (useSenderId) => {
        const params = new URLSearchParams();
        params.append('username', username);
        params.append('to', e164);
        params.append('message', message);
        if (useSenderId && !isSandbox) params.append('from', useSenderId);

        const atRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: params.toString(),
        });
        const rawText = await atRes.text();
        return { atRes, rawText, atData: safeParseJson(rawText) || { rawResponse: rawText } };
      };

      let { atRes, rawText, atData } = await sendViaAT(senderId);
      const firstRecipient = atData?.SMSMessageData?.Recipients?.[0];
      const msgText = String(atData?.SMSMessageData?.Message || rawText || '');
      let effectiveSenderId = senderId || (isSandbox ? 'SANDBOX' : 'SHARED');

      if (!isSandbox && senderId && (firstRecipient?.status === 'InvalidSenderId' || msgText.includes('InvalidSenderId'))) {
        const retry = await sendViaAT('');
        atRes = retry.atRes;
        rawText = retry.rawText;
        atData = retry.atData;
        effectiveSenderId = 'SHARED (Verified)';
      }

      if (!atRes.ok) {
        if (atRes.status === 401 && !isSandbox && (await isSandboxKeyCheck(apiKey))) {
          return jsonResp(
            {
              success: false,
              error:
                'Cannot deliver to real cellular phones: Your API key is an Africa\'s Talking SANDBOX key (simulator only). Enter your Live App Username & Live API Key from account.africastalking.com for real phone delivery.',
              provider: 'africastalking',
            },
            401
          );
        }
        return jsonResp(
          { success: false, error: `Africa's Talking gateway error (${atRes.status}): ${atData?.errorMessage || rawText}` },
          atRes.status
        );
      }

      const recipientStatus = atData?.SMSMessageData?.Recipients?.[0] || {};
      const statusText = String(recipientStatus.status || '');
      const statusCode = Number(recipientStatus.statusCode || 0);
      const isAccepted = statusText === 'Success' || statusText === 'Sent' || [100, 101, 102].includes(statusCode);

      if (!isAccepted) {
        return jsonResp(
          {
            success: false,
            error: `Cellular carrier/gateway rejected SMS (${statusText || atData?.SMSMessageData?.Message || 'Rejected'}).`,
            rawResponse: atData,
          },
          400
        );
      }

      return jsonResp({
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

    if (provider === 'twilio') {
      const accountSid = (customUsername || process.env.TWILIO_ACCOUNT_SID || '').trim();
      const authToken = (customApiKey || process.env.TWILIO_AUTH_TOKEN || '').trim();
      const fromNumber = (customSenderId || process.env.TWILIO_FROM || '').trim();

      if (!accountSid || !authToken || !fromNumber) {
        return jsonResp({ success: false, error: 'Missing Twilio Account SID, Auth Token, or From Number.' }, 400);
      }

      const params = new URLSearchParams();
      params.append('To', e164);
      params.append('From', fromNumber);
      params.append('Body', message);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      const twilioData = safeParseJson(await twilioRes.text()) || {};
      if (!twilioRes.ok) {
        return jsonResp({ success: false, error: twilioData?.message || `Twilio dispatch failed (${twilioRes.status})` }, twilioRes.status);
      }

      return jsonResp({
        success: true,
        provider: 'twilio',
        environment: 'production',
        isSimulated: false,
        messageId: twilioData.sid,
        recipientPhone: local,
        recipientE164: e164,
        networkCarrier: carrier,
        senderId: fromNumber,
        deliveryStatus: twilioData.status || 'Sent',
        timestamp: new Date().toISOString(),
      });
    }

    if (provider === 'safaricom_bulk' || provider === 'local_aggregator') {
      const customUrl = (customEndpoint || process.env.SMS_GATEWAY_URL || '').trim();
      const apiKey = (customApiKey || process.env.SMS_GATEWAY_KEY || '').trim();
      const partnerId = (customUsername || process.env.SMS_PARTNER_ID || '').trim();

      if (!customUrl) {
        return jsonResp({ success: false, error: 'Missing Custom Bulk SMS Gateway HTTP API Endpoint URL.' }, 400);
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

      const customData = safeParseJson(await customRes.text()) || {};
      if (!customRes.ok) {
        return jsonResp({ success: false, error: customData?.message || customData?.error || `Aggregator HTTP ${customRes.status}` }, customRes.status);
      }

      return jsonResp({
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

    return jsonResp({ success: false, error: `Unsupported SMS provider: ${provider}` }, 400);
  } catch (error) {
    return jsonResp({ success: false, error: error?.message || 'Internal error dispatching SMS' }, 500);
  }
};
