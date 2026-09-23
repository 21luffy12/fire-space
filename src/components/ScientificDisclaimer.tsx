import React from 'react';
import { Info } from 'lucide-react';

export const ScientificDisclaimer: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 py-1 border-t border-[#1e293b]/60">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>
          Satellite hotspots are radiometric thermal anomalies. The 6-hour spread projection is an experimental decision-support model, not an official emergency forecast.
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#0f172a]/60 border border-[#1e293b] rounded text-xs font-mono text-slate-400 space-y-1">
      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
        <Info className="w-4 h-4" />
        <span>SCIENTIFIC FRAMEWORK & OPERATIONAL LIMITATIONS NOTICE</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Radiometric thermal hotspots detected by VIIRS (375m) and MODIS (1km) sensors indicate elevated mid-infrared surface brightness temperatures. They do not constitute guaranteed ground-truth burned-area boundaries. Detections can be influenced by atmospheric cloud obscuration, satellite orbital revisit intervals, and non-wildfire thermal signatures (industrial flares, controlled burns). The six-hour forward spread model is an experimental physics-based decision-support estimation combining wind vectors and terrain slope, and must never replace official emergency agency warnings or incident commander directives.
      </p>
    </div>
  );
};
