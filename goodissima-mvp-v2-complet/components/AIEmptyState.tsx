"use client";

export function AIEmptyState({
  title,
  description,
  suggestions,
}: {
  title: string;
  description: string;
  suggestions: string[];
}) {
  return (
    <div data-ai-empty-state="true" className="mt-5 rounded-2xl border border-[#d6e7e8] bg-[#f7fbfa] p-5 shadow-[0_10px_28px_rgba(47,52,55,0.045)]">
      <div className="flex gap-4">
        <div className="relative mt-1 h-12 w-12 shrink-0 rounded-2xl bg-white ring-1 ring-[#d6e7e8]">
          <span className="absolute left-3 top-3 h-2.5 w-2.5 rounded-full bg-[#2fb8c4]" />
          <span className="absolute right-3 top-4 h-2 w-2 rounded-full bg-[#c9e7ea]" />
          <span className="absolute bottom-3 left-5 h-2 w-5 rounded-full bg-[#e7e0d6]" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-[#2f3437]">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#746d66]">{description}</p>
          <div className="mt-4 grid gap-2">
            {suggestions.map((suggestion) => (
              <div key={suggestion} className="rounded-xl bg-white px-3 py-2 text-xs text-[#3f4548] ring-1 ring-[#d6e7e8]">
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
