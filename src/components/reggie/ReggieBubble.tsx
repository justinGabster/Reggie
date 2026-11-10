import type { ReactNode } from "react";

export type ReggieBubbleProps = {
  children: ReactNode;
  className?: string;
  /** Which side the tail points to (toward Reggie). Default "top" (Reggie above the bubble). */
  tail?: "top" | "left" | "auto";
};

/** Reggie's speech bubble. aria-live so screen readers hear what Reggie says. */
export function ReggieBubble({ children, className, tail = "top" }: ReggieBubbleProps) {
  const tailClass =
    tail === "top"
      ? "left-1/2 -top-[9px] -translate-x-1/2 border-l-2 border-t-2"
      : tail === "left"
        ? "top-1/2 -left-[9px] -translate-y-1/2 border-b-2 border-l-2"
        : // "auto": points up when stacked under Reggie, left once they sit side by side (>= 480px)
          "left-1/2 -top-[9px] -translate-x-1/2 border-l-2 border-t-2 min-[480px]:left-[-9px] min-[480px]:top-1/2 min-[480px]:translate-x-0 min-[480px]:-translate-y-1/2 min-[480px]:border-t-0 min-[480px]:border-b-2";
  return (
    <div
      aria-live="polite"
      className={`relative rounded-[20px] border-2 border-line bg-card px-4 py-3 text-base font-extrabold text-fg ledge ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute h-4 w-4 rotate-45 rounded-[3px] border-line bg-card ${tailClass}`}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default ReggieBubble;
