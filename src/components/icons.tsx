import type { SVGProps } from "react";

/**
 * Small inline stroke icons (currentColor). Decorative by default.
 *
 * Every icon carries an `icon icon-<kind>` class. index.css plays a small micro-animation for each kind
 * when the nearest button / link / `.group` ancestor is hovered, keyboard-focused or pressed
 * (and skips it under reduced motion).
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, kind, className, children, ...rest }: IconProps & { kind: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`icon icon-${kind}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg kind="chevron-left" {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg kind="chevron-right" {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);

export const GearIcon = (p: IconProps) => (
  <Svg kind="gear" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const TicketIcon = (p: IconProps) => (
  <Svg kind="ticket" {...p}>
    <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />
    <path d="M14 6v2M14 11v2M14 16v2" />
  </Svg>
);

export const ClipboardIcon = (p: IconProps) => (
  <Svg kind="clipboard" {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg kind="calendar" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 10h18" />
  </Svg>
);

export const PinIcon = (p: IconProps) => (
  <Svg kind="pin" {...p}>
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg kind="check" {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg kind="download" {...p}>
    <path className="icon-part-arrow" d="M12 4v11M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Svg>
);

export const MailIcon = (p: IconProps) => (
  <Svg kind="mail" {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path className="icon-part-flap" d="M3 7l9 6 9-6" />
  </Svg>
);

export const CameraIcon = (p: IconProps) => (
  <Svg kind="camera" {...p}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle className="icon-part-lens" cx="12" cy="13" r="3.5" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg kind="search" {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);

export const RefreshIcon = (p: IconProps) => (
  <Svg kind="refresh" {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20v-4h-4" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg kind="plus" {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const WifiOffIcon = (p: IconProps) => (
  <Svg kind="wifi-off" {...p}>
    <path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.7M19 12.9a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5" />
    <circle cx="12" cy="20" r="0.5" />
  </Svg>
);
