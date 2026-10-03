import { ShieldCheck } from 'lucide-react';

export default function OtpDeliveryNotice() {
  return (
    <div role="note" aria-label="OTP delivery information" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-600">
      <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-wine" />
      <div className="min-w-0 text-[12px] leading-relaxed">
        <p className="font-semibold text-slate-700">How you receive your OTP</p>
        <p className="mt-1">Your login OTP may arrive by SMS or an automated phone call.</p>
        <p className="mt-1">Never share your OTP with anyone.</p>
      </div>
    </div>
  );
}
