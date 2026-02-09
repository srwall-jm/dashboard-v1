
import React from 'react';
import { HardDrive } from 'lucide-react';

export const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="w-full h-full flex flex-col items-center justify-center gap-4 opacity-40">
    <HardDrive className="w-10 h-10 text-slate-300" />
    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{text}</p>
  </div>
);
