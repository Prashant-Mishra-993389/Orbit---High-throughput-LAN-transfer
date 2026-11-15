import React, { useState, useEffect } from 'react';
import { Send, Laptop, ShieldCheck, Zap, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface OnboardingModalProps {
  initialDeviceName: string;
  onComplete: (customDeviceName: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  initialDeviceName,
  onComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [deviceName, setDeviceName] = useState(initialDeviceName);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const onboarded = localStorage.getItem('sharelan_onboarded');
      if (!onboarded) {
        setIsOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (initialDeviceName && !deviceName) {
      setDeviceName(initialDeviceName);
    }
  }, [initialDeviceName, deviceName]);

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = deviceName.trim() || initialDeviceName || 'My Laptop';
    localStorage.setItem('sharelan_onboarded', 'true');
    localStorage.setItem('sharelan_client_name', finalName);
    setIsOpen(false);
    onComplete(finalName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-surface-50 border border-white/10 shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden">
        {/* Glow ambient decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {step === 1 ? (
          /* STEP 1: WELCOME SCREEN */
          <div className="space-y-6 text-center animate-fade-in relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 border border-white/20 flex items-center justify-center mx-auto shadow-xl shadow-cyan-500/25">
              <Send className="w-8 h-8 text-white" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to ShareLAN</h2>
              <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                AirDrop-speed file transfer between your laptops and computers. Zero cloud uploads.
              </p>
            </div>

            {/* Value Props */}
            <div className="space-y-2.5 text-left pt-2">
              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-surface-100/70 border border-white/5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Direct LAN Streaming</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Streams original files directly at raw network wire speeds.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-2xl bg-surface-100/70 border border-white/5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Zero Intermediate Copies</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    No duplicate files are created on sender. Verified bit-for-bit with SHA-256.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* STEP 2: DEVICE NAMING SCREEN */
          <form onSubmit={handleFinish} className="space-y-6 text-center animate-fade-in relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg">
              <Laptop className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-white">Name your device</h2>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                Other laptops on your Wi-Fi will see this name when you pair and transfer files.
              </p>
            </div>

            <div className="text-left space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Device Name</label>
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Prashant's Laptop"
                maxLength={32}
                autoFocus
                className="w-full px-4 py-3 rounded-2xl bg-surface-200 border border-white/10 text-white font-semibold text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3 px-4 rounded-2xl bg-surface-100 hover:bg-surface-200 text-slate-400 text-xs font-semibold transition-all border border-white/5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!deviceName.trim()}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>Start Sharing</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
