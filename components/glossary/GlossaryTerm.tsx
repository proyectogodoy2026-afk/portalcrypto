"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

export default function GlossaryTerm({
  term,
  definition,
}: {
  term: string;
  definition: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setOpen(false)}
        className="cursor-help underline decoration-dotted underline-offset-4"
      >
        {term}
      </button>
      <span
        className={cn(
          "pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-800 shadow-lg",
          open ? "block" : "hidden",
        )}
      >
        <span className="font-semibold">{term}:</span> {definition}
      </span>
    </span>
  );
}

