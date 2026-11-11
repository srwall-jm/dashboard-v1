import React from 'react';

// Renders the AI answer as plain React nodes (no raw HTML), with light support
// for the markdown the models usually return: **bold**, bullets and headings.
const renderInline = (line: string) =>
  line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );

export const InsightsText: React.FC<{ text: string }> = ({ text }) => (
  <div className="max-w-none font-medium text-sm md:text-base leading-relaxed z-10 relative space-y-2 text-slate-200">
    {text.split('\n').map((raw, i) => {
      const line = raw.trim();
      if (!line) return null;
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) return <p key={i} className="font-bold text-white pt-2">{renderInline(heading[1])}</p>;
      const bullet = line.match(/^[-*•]\s+(.*)$/);
      if (bullet) {
        return (
          <div key={i} className="flex gap-3">
            <span className="text-[#F8B133]">•</span>
            <p>{renderInline(bullet[1])}</p>
          </div>
        );
      }
      return <p key={i}>{renderInline(line)}</p>;
    })}
  </div>
);
