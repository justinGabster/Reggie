import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { CameraIcon, ClipboardIcon, MailIcon, TicketIcon } from "@/components/icons";
import { LinkButton, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { copy, fill } from "@/lib/copy";
import { useShouldReduceMotion } from "@/lib/settings";

const C = copy.home;

/** The bubble text with Reggie's name picked out in the accent color. */
function BubbleText() {
  const [before, after] = C.bubble.split("{name}");
  return (
    <>
      {before}
      <span className="font-black text-accent-text">{copy.app.name}</span>
      {after}
    </>
  );
}

/** Live count of events still taking registrations (null while loading or if the API is down). */
function useOpenEvents(): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .events()
      .then(({ events }) => alive && setN(events.filter((e) => e.spotsLeft > 0).length))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return n;
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/**
 * Home: two columns on wide screens.
 *   Left: Reggie + speech bubble, the two-line headline, subtext.
 *   Right: "Choose your role" -> the big Registrant card, three feature cards, and the Organizer row.
 * Below lg everything stacks in one column (Reggie stacks over the bubble below 480px).
 */
export default function Home() {
  const reduce = useShouldReduceMotion();
  const open = useOpenEvents();
  const narrow = useMedia("(max-width: 479px)");
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.2, 0.7, 0.3, 1] as const },
        };
  const openLabel = open === null ? null : open === 0 ? C.noEventsOpen : open === 1 ? C.oneEventOpen : fill(C.eventsOpen, { n: open });

  return (
    <div className="mx-auto grid w-full max-w-[560px] flex-1 content-center gap-8 py-2 lg:max-w-none lg:grid-cols-[1fr_1.12fr] lg:items-center lg:gap-10">
      {/* ------------------------------------------------ left: Reggie + headline */}
      <section aria-labelledby="home-title">
        <div className="flex flex-col items-center gap-3 min-[480px]:flex-row min-[480px]:items-start min-[480px]:gap-2">
          <div className="relative shrink-0">
            <Reggie mood="idle" size={narrow ? 170 : 200} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-2 left-1 flex -rotate-6 items-center gap-1 text-xs font-black lowercase text-link"
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 12C10 11 5 8 3 2M3 2l-1 5M3 2l5 2" />
              </svg>
              {copy.reggie.tapHint}
            </span>
          </div>
          <motion.div
            className="w-full min-[480px]:mt-[18%] min-[480px]:flex-1"
            {...(reduce
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.94 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 0.35, delay: 0.1, ease: [0.3, 1.4, 0.5, 1] as const },
                  style: { transformOrigin: "0% 50%" },
                })}
          >
            <ReggieBubble tail="auto" className="text-[15px] font-bold leading-snug text-fg">
              <p>
                <BubbleText />
              </p>
            </ReggieBubble>
          </motion.div>
        </div>

        <motion.div className="mt-5" {...enter(0.15)}>
          <h1 id="home-title" className="text-[2.35rem] leading-[1.05] tracking-tight sm:text-5xl lg:text-[clamp(2.4rem,3.9vw,3.1rem)]">
            <span className="block text-heading">{C.headline1}</span>
            <span className="block text-accent-text">{C.headline2}</span>
          </h1>
          <p className="mt-3 max-w-[30rem] text-base font-semibold leading-snug text-fg/75 sm:text-lg">{C.sub}</p>
        </motion.div>
      </section>

      {/* ------------------------------------------------ right: role choice */}
      <motion.nav aria-labelledby="home-choose" className="flex flex-col gap-4" {...enter(0.22)}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="home-choose" className="text-xl text-heading">
            {C.choose}
          </h2>
          {openLabel && <span className="text-xs font-black uppercase tracking-wider text-fg/60">{openLabel}</span>}
        </div>

        {/* Registrant: the main path */}
        <div className="overflow-hidden rounded-[22px] border-2 border-line bg-card ledge">
          <div className="relative overflow-hidden bg-primary px-5 py-5 text-primary-fg">
            <span aria-hidden="true" className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-primary-fg/10" />
            <TicketArt className="absolute right-4 top-1/2 h-16 w-20 -translate-y-1/2 sm:right-6" />
            <p className="relative text-xs font-black uppercase tracking-wider opacity-85">{C.registrantEyebrow}</p>
            <p className="relative mt-0.5 max-w-[70%] text-2xl font-black leading-tight">{C.registrantTitle}</p>
          </div>
          <div className="flex flex-col gap-3 p-5 pt-4">
            <LinkButton to="/events" variant="primary" full>
              <TicketIcon size={22} />
              {C.registrant}
            </LinkButton>
          </div>
        </div>

        {/* What you get: hovering a tile animates its icon (see the .icon-* rules in index.css) */}
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Feature tile="bg-maroon text-white" icon={<ClipboardIcon size={20} />} {...C.features[0]} />
          <Feature tile="bg-gold text-maroon" icon={<MailIcon size={20} />} {...C.features[1]} />
        </ul>

        {/* Organizer: the second path */}
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] border-2 border-dashed border-line px-4 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-fg/10 text-heading">
            <CameraIcon size={20} />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-snug text-fg/80">
            <span className="font-black text-heading">{C.organizerLead}</span> {C.organizerRest}
          </p>
          <LinkButton to="/admin" variant="ghost" size="sm" className="max-[419px]:w-full">
            {C.organizer}
          </LinkButton>
        </div>
      </motion.nav>
    </div>
  );
}

function Feature({ tile, icon, lead, rest }: { tile: string; icon: ReactNode; lead: string; rest: string }) {
  return (
    <li className="group flex gap-3 rounded-[18px] border-2 border-line bg-card p-3.5 transition-colors hover:border-heading min-[420px]:flex-col min-[420px]:gap-2.5">
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", tile)} aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm leading-snug text-fg/80">
        <span className="font-black text-heading">{lead}</span>
        {rest}
      </p>
    </li>
  );
}

/** Decorative ticket with a mini QR, drawn in the card header's text color. */
function TicketArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 64" aria-hidden="true" className={className}>
      <g transform="rotate(-10 40 32)">
        <path
          d="M8 14 H72 a4 4 0 0 1 4 4 v6 a6 6 0 0 0 0 16 v6 a4 4 0 0 1 -4 4 H8 a4 4 0 0 1 -4 -4 v-6 a6 6 0 0 0 0 -16 v-6 a4 4 0 0 1 4 -4 Z"
          fill="currentColor"
        />
        <path d="M50 18 V46" stroke="var(--color-primary)" strokeWidth={2} strokeDasharray="3 3" opacity={0.5} />
        <g fill="var(--color-primary)">
          <rect x="14" y="21" width="9" height="9" rx="1.5" />
          <rect x="30" y="21" width="9" height="9" rx="1.5" />
          <rect x="14" y="35" width="9" height="9" rx="1.5" />
          <rect x="31" y="36" width="3.5" height="3.5" />
          <rect x="36" y="40" width="3.5" height="3.5" />
          <rect x="26" y="33" width="3.5" height="3.5" />
          <rect x="57" y="27" width="10" height="3" rx="1.5" />
          <rect x="57" y="34" width="7" height="3" rx="1.5" />
        </g>
      </g>
    </svg>
  );
}
