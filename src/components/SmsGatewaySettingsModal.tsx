import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  ExternalLink,
  RefreshCw,
  Radio,
  Server,
  ShieldAlert
} from 'lucide-react';
import {
  getSmsGatewayConfig,
  saveSmsGatewayConfig,
  dispatchRealSms,
  fetchLiveGatewayBalance,
  fetchGatewayServerStatus,
  GatewayServerStatus,
  SmsGatewayConfig
} from '../services/smsGatewayService';
import { validateKenyanPhoneNumber } from '../services/cryptoService';
import { useApp } from '../context/AppContext';

interface SmsGatewaySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmsGatewaySettingsModal: React.FC<SmsGatewaySettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { schoolProfile } = useApp();
  const schoolName = schoolProfile?.name || 'School Portal';

  const [config, setConfig] = useState<SmsGatewayConfig>(getSmsGatewayConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAdvancedProxy, setShowAdvancedProxy] = useState(false);

  // Live balance check state
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [liveBalanceNotice, setLiveBalanceNotice] = useState<string | null>(null);
  const [liveBalanceIsError, setLiveBalanceIsError] = useState(false);

  // Live test SMS dispatch state
  const [testPhone, setTestPhone] = useState('0716235185');
  const [testMessage, setTestMessage] = useState(
    `ElimuPulse (${schoolName}): Live SMS gateway test. Student tuition fee statements and CBC score cards are active.`
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Server gateway status
  const [serverStatus, setServerStatus] = useState<GatewayServerStatus | null>(null);

  useEffect(() => {
    setTestMessage(
      `ElimuPulse (${schoolName}): Live SMS gateway test. Student tuition fee statements and CBC score cards are active.`
    );
  }, [schoolName]);

  useEffect(() => {
    if (isOpen) {
      const latestConfig = getSmsGatewayConfig();
      setConfig(latestConfig);
      fetchGatewayServerStatus().then((status) => {
        setServerStatus(status);
        if (status.htmlFallbackDetected) {
          setShowAdvancedProxy(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveSmsGatewayConfig(config);
    setConfig(updated);
    setSavedSuccess(true);
    fetchGatewayServerStatus().then(setServerStatus);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleQueryLiveBalance = async () => {
    // Persist current form fields so balance check uses what is currently typed
    saveSmsGatewayConfig(config);
    setIsCheckingBalance(true);
    setLiveBalanceNotice(null);
    setLiveBalanceIsError(false);
    const result = await fetchLiveGatewayBalance();
    setIsCheckingBalance(false);
    if (result.success) {
      setLiveBalanceNotice(`Live Gateway Balance: ${result.balanceText}`);
    } else {
      setLiveBalanceIsError(true);
      setLiveBalanceNotice(result.error || 'Unable to query balance.');
    }
  };

  const handleSendTestSms = async () => {
    setTestError(null);
    setTestResult(null);

    const validation = validateKenyanPhoneNumber(testPhone);
    if (!validation.isValid) {
      setTestError(
        validation.error ||
          'The phone number format must start with 07... or 01... (Kenyan mobile format).'
      );
      return;
    }

    // Persist current form fields immediately so typed keys/usernames are used right away
    saveSmsGatewayConfig(config);

    setIsSendingTest(true);
    const res = await dispatchRealSms(validation.cleanPhone!, testMessage);
    setIsSendingTest(false);

    if (res.success) {
      setTestResult(res);
      setConfig(getSmsGatewayConfig());
    } else {
      setTestError(res.error || 'Failed to dispatch real SMS through the gateway.');
      if (res.error?.includes('HTML web page')) {
        setShowAdvancedProxy(true);
      }
    }
  };

  const isSandboxMode = config.environment === 'sandbox';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden text-slate-900 text-xs">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">
                  Live Cellular SMS Gateway Integration
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    isSandboxMode
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {isSandboxMode ? 'SANDBOX SIMULATOR' : 'LIVE CELLULAR MODE'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Direct cellular network delivery to Safaricom, Airtel, and Telkom numbers (07... / 01...)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Provider Overview & External Console Link */}
          <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-900 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Radio className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">Real Cellular Network Routing (Non-Simulated)</p>
                <p className="text-[11px] text-blue-800 leading-relaxed mt-0.5">
                  For actual SMS delivery to mobile handsets, select <strong>Production</strong> and enter your funded <strong>Live App Username &amp; Live API Key</strong> from Africa's Talking (not Sandbox), Twilio, or a Kenyan Bulk SMS aggregator.
                </p>
              </div>
            </div>
            <a
              href="https://account.africastalking.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Africa's Talking</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {serverStatus?.htmlFallbackDetected && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">Static Host / Proxy Fallback Detected</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  This origin returned HTML for <code className="font-mono">/api/sms/status</code>. If deployed as a static site without serverless functions, set your <strong>Gateway Backend Proxy URL</strong> below (e.g. your full-stack Cloud Run / Node server URL).
                </p>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>SMS Gateway settings saved for {schoolName}.</span>
            </div>
          )}

          {/* Configuration Form */}
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Provider Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Primary SMS Provider / Gateway *
                </label>
                <select
                  value={config.provider}
                  onChange={(e) => setConfig({ ...config, provider: e.target.value as any })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="africastalking">Africa's Talking (Kenya &amp; East Africa)</option>
                  <option value="twilio">Twilio Global Cellular SMS</option>
                  <option value="safaricom_bulk">Safaricom Bulk SMS Enterprise Gateway</option>
                  <option value="local_aggregator">Custom Kenyan Bulk SMS Aggregator (Advanta / TextSMS / Celcom)</option>
                </select>
              </div>

              {/* Environment (Production vs Sandbox) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Operational Environment
                </label>
                <select
                  value={config.environment}
                  onChange={(e) => {
                    const nextEnv = e.target.value as 'production' | 'sandbox';
                    setConfig({
                      ...config,
                      environment: nextEnv,
                      usernameOrPartnerId:
                        nextEnv === 'sandbox'
                          ? 'sandbox'
                          : config.usernameOrPartnerId === 'sandbox'
                          ? ''
                          : config.usernameOrPartnerId,
                    });
                  }}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="production">Production (Real Cellular Handset Delivery)</option>
                  <option value="sandbox">Sandbox Testing (Simulator Only - No Real Phone)</option>
                </select>
              </div>

              {/* Official Sender ID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Sender ID (Optional — Leave Blank for Shared ID)
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={config.senderId}
                  onChange={(e) => setConfig({ ...config, senderId: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Blank = Shared Verified ID"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Custom alphanumeric names require CAK approval. Leave blank to send immediately via shared verified ID.
                </p>
              </div>

              {/* API Username / Partner ID / Account SID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {config.provider === 'twilio'
                    ? 'Twilio Account SID *'
                    : config.provider === 'africastalking'
                    ? isSandboxMode
                      ? "Africa's Talking Sandbox Username"
                      : "Africa's Talking Live App Username *"
                    : 'Partner ID / Account Username'}
                </label>
                <input
                  type="text"
                  value={config.usernameOrPartnerId}
                  placeholder={
                    config.provider === 'twilio'
                      ? 'ACxxxxxxxxxxxxxxxx'
                      : isSandboxMode
                      ? 'sandbox'
                      : serverStatus?.username && serverStatus.username !== 'sandbox'
                      ? `Server default: ${serverStatus.username}`
                      : 'Enter your Live App Username'
                  }
                  onChange={(e) => setConfig({ ...config, usernameOrPartnerId: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* API Key / Secret Token */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  {config.provider === 'twilio' ? 'Twilio Auth Token' : 'Live Gateway API Key / Secret Token'}
                </label>
                <input
                  type="password"
                  value={config.apiKey}
                  placeholder={
                    serverStatus?.isServerKeyConfigured
                      ? 'Server key detected — paste here to override with a Live App API Key'
                      : 'Paste your Live API Key (from Live App Settings -> API Key)'
                  }
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Can also be configured via server environment variable <code className="font-mono bg-slate-100 px-1 py-0.2 rounded">AFRICASTALKING_API_KEY</code>.
                </p>
              </div>

              {/* Custom Webhook URL if aggregator selected */}
              {(config.provider === 'safaricom_bulk' || config.provider === 'local_aggregator') && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Custom Aggregator HTTP API Endpoint *
                  </label>
                  <input
                    type="url"
                    value={config.customEndpoint || ''}
                    placeholder="https://quicksms.advantasms.com/api/services/sendsms/"
                    onChange={(e) => setConfig({ ...config, customEndpoint: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Optional Remote Backend Proxy URL toggle */}
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedProxy((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{showAdvancedProxy ? 'Hide Backend Proxy URL' : 'Configure Remote Backend Proxy URL (for static deployments)'}</span>
                </button>
                {showAdvancedProxy && (
                  <div className="mt-2">
                    <input
                      type="url"
                      value={config.backendProxyUrl || ''}
                      placeholder="https://your-elimupulse-server.run.app (leave blank for same-origin /api/sms)"
                      onChange={(e) => setConfig({ ...config, backendProxyUrl: e.target.value })}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Balance Badge & Actions */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {config.smsBalanceUnits.toLocaleString()}
                </div>
                <div>
                  <div className="font-bold text-slate-900">SMS Units Tracker</div>
                  <div className="text-[11px] text-slate-500">
                    Click Check Balance to query live gateway wallet
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleQueryLiveBalance}
                  disabled={isCheckingBalance}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                  title="Query real wallet balance from Africa's Talking"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCheckingBalance ? 'animate-spin' : ''}`} />
                  <span>Check Balance</span>
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  Save Settings
                </button>
              </div>
            </div>

            {liveBalanceNotice && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  liveBalanceIsError
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-900 font-mono'
                }`}
              >
                {liveBalanceNotice}
              </div>
            )}
          </form>

          {/* Test SMS Dispatcher */}
          <div className="pt-5 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Send className="w-4 h-4 text-emerald-600" />
                <span>Live Test Dispatch Tool</span>
              </h4>
              <span className="text-[11px] text-slate-500">
                {isSandboxMode ? 'Routes to Africa\'s Talking Simulator' : 'Dispatches real SMS to phone handset'}
              </span>
            </div>

            {testError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Gateway Dispatch Notice:</p>
                  <p className="leading-relaxed">{testError}</p>
                </div>
              </div>
            )}

            {testResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {testResult.isSimulated
                        ? 'Sandbox Simulator Accepted Test SMS'
                        : 'Real SMS Sent to Cellular Network!'}
                    </span>
                  </span>
                  <span className="font-mono text-[10px] bg-emerald-200/80 text-emerald-950 px-2 py-0.5 rounded font-bold">
                    Carrier: {testResult.networkCarrier}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-700 grid grid-cols-2 gap-2 pt-1 border-t border-emerald-200/60">
                  <div>Recipient: <strong>{testResult.recipientPhone}</strong></div>
                  <div>Sender: <strong>{testResult.senderId}</strong></div>
                  <div>Message ID: <strong className="text-indigo-700">{testResult.messageId}</strong></div>
                  <div>Status: <strong className="text-emerald-700">{testResult.deliveryStatus}</strong></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Recipient Phone Number *
                </label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="0716235185 or 0110445566"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Format: 07... or 01...</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Test Message Content
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestSms}
                    disabled={isSendingTest}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 shrink-0 flex items-center gap-1.5"
                  >
                    {isSendingTest ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Real SMS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
