// ====== Mutant/Facility Themed End Credits ======
const CREDIT_SCROLL_DURATION_MS = 18000;
const DEFAULT_AUTO_CLOSE_MS = CREDIT_SCROLL_DURATION_MS + 2000;

let creditsStyleInjected = false;

const CREDIT_TEXT = `CREDITS

Mutation Detective

Group members
• Lauren
• Kaylee
• Adrusha
• Colby
• Sipho

Tools
• three.js
• Blender
• Vite

Thanks for playing!`;

// --- helper: turn the plain text into nicer markup (headings + bullets) ---
function buildCreditsContent(text) {
  const lines = text.split(/\r?\n/);
  const root = document.createElement("div");
  root.className = "credits-scroll";

  let list = null;

  lines.forEach((raw) => {
    const line = raw.trim();

    if (!line) {
      // paragraph break
      const br = document.createElement("div");
      br.className = "cr-spacer";
      root.appendChild(br);
      list = null;
      return;
    }

    if (line.startsWith("•")) {
      if (!list) {
        list = document.createElement("ul");
        list.className = "cr-list";
        root.appendChild(list);
      }
      const li = document.createElement("li");
      li.textContent = line.replace(/^•\s*/, "");
      list.appendChild(li);
      return;
    }

    // headings vs normal lines
    if (/^credits$/i.test(line)) {
      const h = document.createElement("div");
      h.className = "cr-h0";
      h.textContent = line;
      root.appendChild(h);
      list = null;
    } else if (/^(group members|tools|special thanks|Mutation Detective)$/i.test(line)) {
      const h = document.createElement("div");
      h.className = "cr-h1";
      h.textContent = line;
      root.appendChild(h);
      list = null;
    } else if (/^thanks for playing!?$/i.test(line)) {
      const h = document.createElement("div");
      h.className = "cr-outro";
      h.textContent = line;
      root.appendChild(h);
      list = null;
    } else {
      const p = document.createElement("div");
      p.className = "cr-line";
      p.textContent = line;
      root.appendChild(p);
      list = null;
    }
  });

  return root;
}

function ensureCreditsStyles() {
  if (creditsStyleInjected) return;

  const style = document.createElement("style");
  style.id = "credits-overlay-styles";
  style.textContent = `
    :root {
      --cr-green:#7CFF7A;
      --cr-amber:#FFC84A;
      --cr-red:#FF3131;
      --cr-fg:#e9f1ee;
      --cr-dim:#a4b0b5;
      --cr-bg:#050507;
      --cr-card:#0b0d11;
      --cr-border:#1b1f26;
    }

    @keyframes credits-roll {
      from { transform: translateY(55vh); opacity:.0; }
      8%   { opacity:1; }
      to   { transform: translateY(-120%); opacity:1; }
    }
    @keyframes cr-noiseShift { 0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-30px,20px,0)} }
    @keyframes cr-flicker { 0%,100%{opacity:.92} 50%{opacity:.98} }
    @keyframes cr-blink { 0%,100%{opacity:.6} 50%{opacity:1} }

    .credits-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: var(--cr-bg);
      color: var(--cr-fg);
      font-family: "IBM Plex Mono","Courier New",monospace;
      letter-spacing:.03em;
      overflow: hidden;
      display: grid; place-items: center;
    }
    /* layered background (vignette + lab glow + scanline noise) */
    .cr-bg {
      position:absolute; inset:0;
      background:
        radial-gradient(1200px 500px at 50% 115%, rgba(124,255,122,.08), transparent 60%),
        radial-gradient(700px 340px at 12% -10%, rgba(255,49,49,.06), transparent 60%),
        radial-gradient(700px 320px at 88% -15%, rgba(148,255,236,.07), transparent 60%),
        #020205;
      filter: saturate(.9) contrast(1.05);
    }
    .cr-vignette {
      position:absolute; inset:0; pointer-events:none;
      background: radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,.85) 100%);
      mix-blend-mode: multiply;
    }
    .cr-noise {
      position:absolute; inset:-50px; opacity:.08; pointer-events:none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' /%3E%3C/svg%3E");
      animation: cr-noiseShift 1.8s steps(3) infinite;
    }

    .credits-overlay__frame {
      position: relative;
      width: min(900px, 92vw);
      height: min(82vh, 780px);
      border: 1px solid var(--cr-border);
      background: linear-gradient(180deg, rgba(10,12,15,.9), rgba(7,8,11,.96));
      box-shadow: 0 26px 90px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.03);
      border-radius: 14px;
      overflow: hidden;
    }
    .credits-overlay__frame::before{
      content:""; position:absolute; inset:0; pointer-events:none;
      background:
        linear-gradient(0deg, rgba(255,255,255,.06), transparent 30%),
        repeating-linear-gradient(180deg, rgba(255,255,255,.03) 0 2px, transparent 2px 4px);
      mix-blend-mode: overlay; opacity:.25;
      animation: cr-flicker 1.8s infinite;
    }

    /* header bar */
    .cr-head {
      position: relative;
      padding: 14px 18px;
      display:flex; align-items:center; justify-content: space-between; gap: 12px;
      border-bottom:1px solid var(--cr-border);
      background: linear-gradient(180deg, rgba(255,255,255,.04), transparent);
    }
    .cr-badge {
      padding: 4px 10px; font-weight:900; letter-spacing:.18em; color:#121314;
      background: linear-gradient(90deg, var(--cr-amber), #ff8359);
      border-radius:4px; box-shadow: 0 0 14px rgba(255,130,60,.25);
    }
    .cr-title {
      flex:1; text-align:center; font-weight:900; letter-spacing:.14em;
      color:#fff; text-transform: uppercase;
      text-shadow: 0 0 16px rgba(0,0,0,.6);
    }
    .cr-dot {
      width:10px; height:10px; border-radius:50%;
      background: var(--cr-red); box-shadow:0 0 10px rgba(255,49,49,.85);
      animation: cr-blink 1.4s infinite;
    }

    /* scroll area */
    .credits-overlay__inner {
      position: absolute; inset: 64px 0 64px 0;
      display:grid; place-items:center;
      overflow:hidden;
    }
    .credits-scroll {
      width: min(720px, 86%);
      text-align:center;
      filter: drop-shadow(0 2px 0 rgba(0,0,0,.75));
      animation: credits-roll ${CREDIT_SCROLL_DURATION_MS}ms linear forwards;
      will-change: transform;
    }

    .cr-h0 {
      font-size: clamp(1.6rem, 4.8vw, 2.8rem);
      font-weight: 900; letter-spacing: .22em; margin-bottom: 16px;
      text-transform: uppercase; color:#fff;
      text-shadow: 0 0 24px rgba(124,255,122,.25);
    }
    .cr-h1 {
      margin: 26px 0 10px 0;
      font-size: clamp(1.1rem, 2.8vw, 1.4rem);
      font-weight: 800; letter-spacing:.2em; text-transform: uppercase;
      color: var(--cr-green, #7CFF7A);
      filter: drop-shadow(0 0 10px rgba(124,255,122,.35));
    }
    .cr-line {
      color: var(--cr-dim); margin: 6px 0 2px 0; letter-spacing:.1em;
    }
    .cr-list { list-style: none; padding:0; margin: 4px 0 0 0; }
    .cr-list li {
      margin: 4px 0;
      color: #f1fff1;
      letter-spacing: .08em;
    }
    .cr-spacer { height: 14px; }

    .cr-outro {
      margin-top: 28px;
      font-size: clamp(1.1rem, 3.2vw, 1.6rem);
      font-weight:900; letter-spacing:.18em; text-transform: uppercase;
      color:#ffffff;
      text-shadow: 0 0 24px rgba(148,255,236,.35), 0 0 8px rgba(255,255,255,.15);
    }

    /* bottom bar + skip */
    .cr-foot {
      position:absolute; inset:auto 0 0 0;
      height: 64px; display:flex; align-items:center; justify-content:center; gap:12px;
      border-top:1px solid var(--cr-border);
      background: linear-gradient(0deg, rgba(255,255,255,.04), transparent);
    }
    .credits-overlay__close {
      border:1px solid rgba(124,255,122,.45);
      background: linear-gradient(180deg, #0ef0951a, #0d1411);
      color:#e9f1ee; font-weight:800; letter-spacing:.14em; text-transform: uppercase;
      padding: 10px 16px; border-radius:10px; cursor:pointer;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.03), 0 10px 26px rgba(0,0,0,.5);
      transition: transform .08s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
    }
    .credits-overlay__close:hover { transform: translateY(-1px); box-shadow: 0 12px 30px rgba(0,0,0,.55); }
    .credits-overlay__close:active { transform: translateY(0); }

    /* helper: hide via attribute if needed */
    [hidden] { display:none !important; }
  `;
  document.head.appendChild(style);
  creditsStyleInjected = true;
}

/**
 * Displays the shared credits overlay.
 * @param {Object} options
 * @param {number} [options.autoCloseMs] - Automatically close after this many ms (default ~20s).
 * @param {boolean} [options.restartOnFinish] - If true, dispatches a restart event when closed.
 * @param {() => void} [options.onClose] - Optional callback invoked after overlay is removed.
 * @returns {Promise<void>} Resolves when the overlay closes.
 */
export function showCreditsOverlay({
  autoCloseMs = DEFAULT_AUTO_CLOSE_MS,
  restartOnFinish = false,
  onClose
} = {}) {
  ensureCreditsStyles();

  // Prevent multiple overlays
  const existing = document.querySelector(".credits-overlay");
  if (existing) existing.remove();

  // Root overlay
  const overlay = document.createElement("div");
  overlay.className = "credits-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.tabIndex = -1;

  // BG layers
  const bg = document.createElement("div");
  bg.className = "cr-bg";
  const vig = document.createElement("div");
  vig.className = "cr-vignette";
  const noise = document.createElement("div");
  noise.className = "cr-noise";

  // Frame
  const frame = document.createElement("div");
  frame.className = "credits-overlay__frame";

  // Header
  const head = document.createElement("div");
  head.className = "cr-head";
  head.innerHTML = `
    <div class="cr-badge">CLASS-Δ REPORT</div>
    <div class="cr-title">TERMINATION PROTOCOL // END CREDITS</div>
    <div class="cr-dot" aria-hidden="true"></div>
  `;

  // Scroll area
  const innerWrap = document.createElement("div");
  innerWrap.className = "credits-overlay__inner";
  const scrollContent = buildCreditsContent(CREDIT_TEXT);
  innerWrap.appendChild(scrollContent);

  // Footer / Skip
  const footer = document.createElement("div");
  footer.className = "cr-foot";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "credits-overlay__close";
  button.textContent = "Skip Credits";
  footer.appendChild(button);

  frame.appendChild(head);
  frame.appendChild(innerWrap);
  frame.appendChild(footer);

  overlay.appendChild(bg);
  overlay.appendChild(vig);
  overlay.appendChild(noise);
  overlay.appendChild(frame);

  return new Promise((resolve) => {
    let finished = false;
    let closeTimer = null;

    const finalize = () => {
      if (finished) return;
      finished = true;
      if (closeTimer) window.clearTimeout(closeTimer);
      window.removeEventListener("keydown", handleKey);
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      try { onClose?.(); } catch (err) { console.warn("[credits] onClose handler error:", err); }
      if (restartOnFinish) window.dispatchEvent(new Event("credits:restart"));
      resolve();
    };

    const handleKey = (event) => {
      if (event.code === "Escape" || event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        finalize();
      }
    };

    // finish on scroll animation end
    scrollContent.addEventListener("animationend", finalize, { once: true });
    button.addEventListener("click", finalize);
    window.addEventListener("keydown", handleKey);

    if (autoCloseMs > 0) {
      closeTimer = window.setTimeout(finalize, autoCloseMs);
    }

    document.body.appendChild(overlay);
    overlay.focus();
  });
}
