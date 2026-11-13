const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const customEnv = (body.environment || '').toLowerCase();
    const rawCustomUser = (body.username || '').trim();
    const envUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
    const apiKey = (body.apiKey || process.env.AFRICASTALKING_API_KEY || '').trim();

    const username =
      customEnv === 'sandbox'
        ? 'sandbox'
        : rawCustomUser && rawCustomUser.toLowerCase() !== 'sandbox'
        ? rawCustomUser
        : envUser || rawCustomUser || 'sandbox';

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No Africa's Talking API key configured. Enter your Live API Key or set AFRICASTALKING_API_KEY.",
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const isSandbox = customEnv === 'sandbox' || username.toLowerCase() === 'sandbox';
    const endpoint = isSandbox
      ? `https://api.sandbox.africastalking.com/version1/user?username=${encodeURIComponent(username)}`
      : `https://api.africastalking.com/version1/user?username=${encodeURIComponent(username)}`;

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { apiKey, Accept: 'application/json' },
    });

    const rawText = await response.text();
    const data = safeParseJson(rawText);

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Gateway balance request failed (${response.status}): ${data?.errorMessage || rawText}`,
        }),
        { status: response.status, headers: jsonHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        environment: isSandbox ? 'sandbox' : 'production',
        username,
        balanceRaw: data?.UserData?.balance || 'KES 0.00',
        userData: data?.UserData,
      }),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to connect to SMS Gateway balance endpoint',
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
};
