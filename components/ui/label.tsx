"use client";

import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn("text-sm font-medium text-zinc-900", className)}
      {...props}
    />
  );
}

