/* Hand-drawn inline SVG icon set — single stroke style, 24px grid. */

import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function make(node: ReactNode) {
  return function Icon({ size = 16, ...rest }: P) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {node}
      </svg>
    );
  };
}

export const IRadar = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4.5" opacity=".45" />
    <path d="M12 12l6.5-6.5" />
    <circle cx="15.4" cy="14.6" r="1.15" fill="currentColor" stroke="none" />
  </>,
);
export const ITarget = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
export const ISignal = make(
  <>
    <path d="M4 19v-4" />
    <path d="M9 19v-8" />
    <path d="M14 19V7" />
    <path d="M19 19V4" />
  </>,
);
export const IBranch = make(
  <>
    <circle cx="6" cy="5" r="2.4" />
    <circle cx="6" cy="19" r="2.4" />
    <circle cx="18" cy="8" r="2.4" />
    <path d="M6 7.4v9.2" />
    <path d="M18 10.4c0 3.4-4 3.6-7.5 4.2-1.9.3-3.2 1-3.9 2.2" />
  </>,
);
export const IStar = make(<path d="M12 3.6l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.2 6.9 19l1.1-5.6-4.2-3.9 5.7-.7z" />);
export const IFork = make(
  <>
    <circle cx="6" cy="5.5" r="2.2" />
    <circle cx="18" cy="5.5" r="2.2" />
    <circle cx="12" cy="18.5" r="2.2" />
    <path d="M6 7.7v1.8a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.7" />
    <path d="M12 12.5v3.8" />
  </>,
);
export const IIssue = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" opacity=".8" />
  </>,
);
export const ISearch = make(
  <>
    <circle cx="10.5" cy="10.5" r="6.2" />
    <path d="M15.2 15.2 20 20" />
  </>,
);
export const ISend = make(
  <>
    <path d="M20 4 10.5 13.5" />
    <path d="M20 4 13.5 20l-3-6.5L4 10.5z" />
  </>,
);
export const ICopy = make(
  <>
    <rect x="9" y="9" width="11" height="11" rx="1.5" />
    <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />
  </>,
);
export const ICheck = make(<path d="M4.5 12.5 10 18 19.5 6.5" />);
export const IX = make(
  <>
    <path d="M5.5 5.5l13 13" />
    <path d="M18.5 5.5l-13 13" />
  </>,
);
export const IPlus = make(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>,
);
export const ITrash = make(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12" />
    <path d="M10 11v6M14 11v6" />
  </>,
);
export const INote = make(
  <>
    <path d="M12 5H5.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V12" />
    <path d="M17.8 3.9l2.3 2.3-7.4 7.4-2.9.6.6-2.9z" />
  </>,
);
export const IClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.4 2" />
  </>,
);
export const IArrowR = make(
  <>
    <path d="M4 12h15" />
    <path d="M13.5 5.5 20 12l-6.5 6.5" />
  </>,
);
export const IArrowL = make(
  <>
    <path d="M20 12H5" />
    <path d="M10.5 5.5 4 12l6.5 6.5" />
  </>,
);
export const IChevronD = make(<path d="M6 9.5 12 15.5 18 9.5" />);
export const ILogout = make(
  <>
    <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
    <path d="M10 12h10" />
    <path d="M16.5 8.5 20 12l-3.5 3.5" />
  </>,
);
export const IShield = make(
  <>
    <path d="M12 3.5 5 6v6c0 4.4 3 7.4 7 8.5 4-1.1 7-4.1 7-8.5V6z" />
    <path d="M9 11.8l2.2 2.2L15.4 9.6" />
  </>,
);
export const IMail = make(
  <>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="m4.5 7 7.5 6 7.5-6" />
  </>,
);
export const ITerminal = make(
  <>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
    <path d="m7 9.5 3 2.5-3 2.5" />
    <path d="M12.5 15H17" />
  </>,
);
export const ILayers = make(
  <>
    <path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" />
    <path d="m4.5 12.5 7.5 4 7.5-4" />
    <path d="m4.5 16.5 7.5 4 7.5-4" />
  </>,
);
export const ITrend = make(
  <>
    <path d="M3.5 17.5 9 12l3.5 3.5L20.5 7" />
    <path d="M15.5 7h5v5" />
  </>,
);
export const IFlag = make(
  <>
    <path d="M5.5 21V4" />
    <path d="M5.5 4.5c4-2 7 2 12 0v9c-5 2-8-2-12 0" />
  </>,
);
export const ILock = make(
  <>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </>,
);
export const IEye = make(
  <>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </>,
);
export const IGlobe = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17" />
    <path d="M12 3.5c2.6 2.3 3.9 5.1 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.1-3.9-8.5s1.3-6.2 3.9-8.5z" />
  </>,
);
export const IUsers = make(
  <>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
    <circle cx="16.8" cy="9.5" r="2.4" />
    <path d="M16.2 14.6c2.2.3 3.8 1.8 4.3 4.4" />
  </>,
);
export const IExt = make(
  <>
    <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14" />
    <path d="M13.5 4.5H19.5V10.5" />
    <path d="M19 5 11.5 12.5" />
  </>,
);
export const IAlert = make(
  <>
    <path d="M12 4 2.8 19.5h18.4z" />
    <path d="M12 10v4" />
    <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
  </>,
);
export const ICompass = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </>,
);
export const IInbox = make(
  <>
    <path d="M4 5.5h16V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z" />
    <path d="M4 13h4.5l1.5 2.5h4L15.5 13H20" />
  </>,
);
export const IFilter = make(<path d="M4 6h16M7 12h10M10 18h4" />);
export const IHash = make(
  <>
    <path d="M9.5 4 7.5 20M16.5 4l-2 16M4.5 9h16M3.5 15h16" />
  </>,
);
export const IZap = make(<path d="M13 3 4.5 13.5H11L10 21l8.5-10.5H12z" />);
export const IHand = make(
  <>
    <path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0v4.7" />
    <path d="M10.8 11V5.2a1.4 1.4 0 0 1 2.8 0V11" />
    <path d="M13.6 11V6.8a1.4 1.4 0 0 1 2.8 0v6.4" />
    <path d="M16.4 13.2l1.8-2a1.4 1.4 0 0 1 2.2 1.8l-3.6 5.6c-1 1.6-2.4 2.4-4.6 2.4-3.4 0-4.6-1.6-5.8-4.4l-1.7-4a1.4 1.4 0 0 1 2.5-1.2L8 12.5" />
  </>,
);
export const IBook = make(
  <>
    <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H19.5v15H6.5a2 2 0 0 0-2 2z" />
    <path d="M4.5 18.5v2h15" />
    <path d="M8.5 7.5h7M8.5 11h5" />
  </>,
);
export const IDownload = make(
  <>
    <path d="M12 3.5v10.5M7.5 10 12 14.5 16.5 10" />
    <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </>,
);
export const IZip = make(
  <>
    <path d="M5.5 6.5A2 2 0 0 1 7.5 4.5h6l5 5v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2z" />
    <path d="M13.5 4.5v5h5" />
    <path d="M9.5 9.5h1.5M9.5 12.5h1.5M9.5 15.5h1.5" />
  </>,
);
