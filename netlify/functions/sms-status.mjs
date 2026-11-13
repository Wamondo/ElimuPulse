const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: jsonHeaders });
  }

  const atApiKey = (process.env.AFRICASTALKING_API_KEY || '').trim();
  const atUser = (process.env.AFRICASTALKING_USERNAME || '').trim();
  const atSender = (process.env.AFRICASTALKING_SENDER_ID || '').trim();

  return new Response(
    JSON.stringify({
      gateway: "Africa's Talking & Direct Cellular Aggregator",
      provider: process.env.SMS_PROVIDER || 'africastalking',
      isServerKeyConfigured: Boolean(atApiKey && atApiKey.length > 5),
      username: atUser || 'sandbox',
      senderId: atSender,
      supportedProviders: ['africastalking', 'twilio', 'safaricom_bulk', 'local_aggregator'],
      environment: atUser.toLowerCase() === 'sandbox' ? 'sandbox' : 'production',
    }),
    { status: 200, headers: jsonHeaders }
  );
};
