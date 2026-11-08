import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Smartphone,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Sliders,
  DollarSign,
  Info,
  Radio
} from 'lucide-react';
import {
  getSmsGatewayConfig,
  saveSmsGatewayConfig,
  dispatchRealSms,
  fetchLiveGatewayBalance,
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
  const [config, setConfig] = useState<SmsGatewayConfig>(getSmsGatewayConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Live balance check state
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [liveBalanceNotice, setLiveBalanceNotice] = useState<string | null>(null);

  // Live test SMS dispatch state
  const [testPhone, setTestPhone] = useState('0716235185');
  const [testMessage, setTestMessage] = useState(
    `ElimuPulse (${schoolProfile?.name || 'School Portal'}): Live SMS gateway test. Student tuition fee statements and CBC score cards are active.`
  );
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // Server gateway status
  const [serverStatus, setServerStatus] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/sms/status')
        .then((res) => res.json())
        .then((data) => setServerStatus(data))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveSmsGatewayConfig(config);
    setConfig(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  const handleQueryLiveBalance = async () => {
    setIsCheckingBalance(true);
    setLiveBalanceNotice(null);
    const result = await fetchLiveGatewayBalance();
    setIsCheckingBalance(false);
    if (result.success) {
      setLiveBalanceNotice(`Live Gateway Balance: ${result.balanceText}`);
    } else {
      setLiveBalanceNotice(`Notice: ${result.error}`);
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

    setIsSendingTest(true);
    const res = await dispatchRealSms(validation.cleanPhone!, testMessage);
    setIsSendingTest(false);

    if (res.success) {
      setTestResult(res);
      setConfig(getSmsGatewayConfig()); // refresh balance
    } else {
      setTestError(res.error || 'Failed to dispatch real SMS through the gateway.');
    }
  };

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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Live Cellular SMS Gateway Integration
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  REAL SMS ACTIVE
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
                <p className="font-bold text-xs">Africa's Talking &amp; Cellular Aggregators</p>
                <p className="text-[11px] text-blue-800 leading-relaxed mt-0.5">
                  ElimuPulse proxies SMS dispatches directly through the server route (<code className="font-mono bg-blue-100 px-1 py-0.2 rounded text-[10px]">/api/sms/dispatch</code>) to bypass browser CORS constraints and deliver real SMS to parents' mobile handsets.
                </p>
              </div>
            </div>
            <a
              href="https://dashboard.africastalking.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shrink-0 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Africa's Talking Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>SMS Gateway settings successfully saved to institutional configuration.</span>
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
                  <option value="local_aggregator">Custom CAK Bulk SMS Aggregator / Webhook</option>
                </select>
              </div>

              {/* Environment (Production vs Sandbox) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Operational Environment
                </label>
                <select
                  value={config.environment}
                  onChange={(e) => setConfig({ ...config, environment: e.target.value as any })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="production">Production (Real Cellular Handset Delivery)</option>
                  <option value="sandbox">Sandbox Testing (Africa's Talking Simulator)</option>
                </select>
              </div>

              {/* Official Sender ID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Alphanumeric Sender ID (Max 11 Chars)
                </label>
                <input
                  type="text"
                  maxLength={11}
                  required
                  value={config.senderId}
                  onChange={(e) => setConfig({ ...config, senderId: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. ELIMUPULSE"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Appears as the Sender Name on parents' phones instead of a random number.
                </p>
              </div>

              {/* API Username / Partner ID / Account SID */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {config.provider === 'twilio' ? 'Twilio Account SID' : 'Africa\'s Talking Username / App Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={config.provider === 'africastalking' ? 'e.g. sandbox or your_app_username' : 'e.g. ACxxxxxxxx'}
                  value={config.usernameOrPartnerId}
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
                  placeholder="Enter your live API Key (e.g. atsk_live_...)"
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
                    Custom Aggregator HTTP API Endpoint
                  </label>
                  <input
                    type="url"
                    value={config.customEndpoint || ''}
                    placeholder="https://api.smsaggregator.co.ke/v1/send"
                    onChange={(e) => setConfig({ ...config, customEndpoint: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Balance Badge & Actions */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                  {config.smsBalanceUnits.toLocaleString()}
                </div>
                <div>
                  <div className="font-bold text-slate-900">Prepaid SMS Units Available</div>
                  <div className="text-[11px] text-slate-500">
                    Sufficient for ~{config.smsBalanceUnits.toLocaleString()} direct parent fee reminders
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
              <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs font-mono">
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
              <span className="text-[11px] text-slate-500">Dispatches real SMS to any phone number</span>
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
                    <span>Real SMS Dispatched Successfully!</span>
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
