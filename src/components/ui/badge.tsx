import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
  {
    variants: {
      variant: {
        live: "border-accent/30 bg-accent/15 text-accent",
        upcoming: "border-sky/30 bg-sky/10 text-sky",
        done: "border-white/15 bg-white/5 text-foreground",
        muted: "border-line bg-transparent text-muted",
        lime: "border-accent/40 bg-accent text-[#101608]",
        sky: "border-sky/40 bg-sky text-[#082033]",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
