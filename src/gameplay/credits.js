// ====== Mutant/Facility Themed End Credits ======
const CREDIT_SCROLL_DURATION_MS = 18000;
const DEFAULT_AUTO_CLOSE_MS = CREDIT_SCROLL_DURATION_MS + 2000;
const AUTO_SCROLL_SPEED_PX_PER_SEC = 40;

let creditsStyleInjected = false;

const CREDIT_TEXT = `CREDITS

Mutation Detective

Group members
Sipho Jr. Mntambo 2430285 
Adrusha Reddy 2667194 
Lauren Lachman 2702445 
Aluwani Nndwamato 2671832 
Colby Subramoney 2604668 
Kaylee Bibis 2538031

Background imagery
• Level 1 to 2 cutscene: "Eerie Abandoned Elevator" photo by Stockcake - https://stockcake.com/i/eerie-abandoned-elevator_1179472_95384
• Level 2 to 3 cutscene: Generated with ChatGPT

Sounds & music
• Monster bellowing - Thanra - https://freesound.org/s/245429/
• Scary monster roar #2 - NicknameLarry - https://freesound.org/s/489901/
• Heavy breathing scared male - DeqstersLab - https://freesound.org/s/721351/
• Metallic clatter - Porphyr - https://freesound.org/s/192067/
• Creepy old elevator 2 - bassboybg - https://freesound.org/s/218928/
• Background ambience - Pixabay freesound_community - https://pixabay.com/users/freesound_community-46691455/

Videos
• In-engine capture by CGV team

Models
• Rats - Lauren
• Specimen tank base - Lauren
• Pipes on wall - Lauren
• Creature Specimen Jar - Michael V (Sketchfab Free) - https://skfb.ly/prFLr
• Dead Body - Lukas Bobor (CC Attribution) - https://skfb.ly/RDwI
• Exit Door - barbodoji (CC Attribution) - https://skfb.ly/pupIB
• Low poly dead body covered - Arthur.Zim (CC Attribution) - https://skfb.ly/ooOXt
• Blood Spattered - adolfochs (CC Attribution) - https://skfb.ly/oIZUR
• Broken glass - mkelly2024 (CC Attribution) - https://skfb.ly/oAZIy
• Cheap old shelf - Blender3D (CC Attribution) - https://skfb.ly/6zs9z
• Blood splatter - Robin.Mikalsen (CC Attribution) - https://skfb.ly/owsuS
• 18650 Li-Ion battery - Stepan Sallinen (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/a0c98938-0da6-4288-82a3-5cf1a692d21c/
• AAA battery - Models by sherhn (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/4fc3e36f-de98-4fb0-94cd-0945bd659db0/
• Among Us dead body - DI BY (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/3810e6de-ab20-4635-aeb5-92501219ef63/
• Human skull bone - Mojo (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/b938c1b2-ad1c-4dd3-ab67-a59d42cb0777/
• Broken flower pot - Jophet Mark (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/10e6d670-55f0-44d1-9917-28f78ff50ea8/
• Corsair keyboard - Matt Pontacole (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/828e6aa8-a3ad-4fec-bb5d-47fdd7f84831/
• Dog skeleton - LeviEntity Pierre (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/0067c3e4-14bd-4b29-851b-2c6da4cbdfc4/
• Flashlight camping - Klo Works (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/ab51bb9b-6747-48eb-a011-e3c73022e847/
• Generator - Davydas Alytas (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/5be80ae6-2ad3-4f3a-8780-90d9b71fb5d7/
• Industrial elevator doors (3D scanned) - Nobody (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/9f9033b9-1627-4e79-aeda-6ade4249942e/
• Reception desk - Salyh Babaev (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/4c19f984-3f80-4aa6-be41-5265dabc526a/
• Antique jewelry box - Ed Ackerman (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/89fe8372-4709-4168-8451-55ec9f70d7d2/
• Barrel 01 - Poly Haven (CC0) - https://www.blenderkit.com/asset-gallery-detail/bf1be93e-27d3-49c3-9c17-47891dab1bbf/
• Blue metal door - Freepoly (CC0) - https://www.blenderkit.com/asset-gallery-detail/7203198b-765c-4609-a666-a8550760238f/
• Green metal door - Freepoly (CC0) - https://www.blenderkit.com/asset-gallery-detail/a8af9102-614f-4a89-8390-fd35ffe4d500/
• Dirty blanket - Alexander Handjiev (CC0) - https://www.blenderkit.com/asset-gallery-detail/8c91156c-23c5-4087-b37e-bfb9af41ad94/
• Stair light - Jesus Snz (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/14109209-b0e7-461e-a088-e0ab0ea026bd/
• Hanging industrial lamp - Poly Haven (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/4a8af280-5806-45f6-9b09-afaa925c1fad/
• Medi-trolly - Yahku le Roux (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/b72d5b00-9cb6-405e-8c0f-582f7aa483f8/
• Old computer 02 - Freepoly (CC0) - https://www.blenderkit.com/asset-gallery-detail/73429166-ad82-4209-a4e5-079edcf80d21/
• Old crate - Klo Works (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/e68b326b-af1c-4b9e-b5a3-ba549c3cd04f/
• Old office desk - Freepoly (CC0) - https://www.blenderkit.com/asset-gallery-detail/7b5a53df-21c4-48c5-97e7-3e7a8f6062a0/
• Pirate wooden box - Stray Designer (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/e0ff1d2b-a166-4bfd-a2e5-fb3e38142c9e/
• Rust cabinet - Freepoly (CC0) - https://www.blenderkit.com/asset-gallery-detail/0caa07f9-ec69-4561-b1a7-a2b78fc79d2f/
• Sheet of pills 2 - Dovydas Alytas (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/b807857b-99b1-43df-98c9-2fb2ab00ead1/
• Whiteboard - Rex Hans (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/a1996f29-d7fe-44a6-8949-3d34ca15a089/
• Security camera 02 - Poly Haven (CC0) - https://www.blenderkit.com/asset-gallery-detail/b06e1272-8b7d-47fb-a603-3bf770fd815c/
• Sign - No Smoking - Nobody (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/d1b0c94b-2fe3-4f20-83b0-14ef77c0bb05/
• Rollerball pen - ibotpl (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/981f426a-18e8-4732-a8dd-141f2acde7a6/
• Green serum - Aditya C (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/a790f4de-3c18-41b8-9fad-254167885815/
• Knife - Rex Hans (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/2f9b5a2b-907a-4779-b7e9-2ae5f79586c4/
• Keypad - Spellkaze (CC Attribution) - https://skfb.ly/6FV6v
• Security card - NoTimeForAdventure (CC Attribution) - https://skfb.ly/o8CEP
• Science lab door (apocalyptic) - sgoldcreatives (CC Attribution) - https://skfb.ly/oBvwP
• Hospital bed - Ioxfear (CC Attribution) - https://skfb.ly/F8IC
• Door key - SusanKing (Sketchfab Free) - https://skfb.ly/6SNAw
• Old newspaper - anaxarts designs (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/c1da5889-61c2-41fd-b997-f76448969c8f/

Materials
• Old red painted wall - ydd 3D (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/a0c98938-0da6-4288-82a3-5cf1a692d21c/
• Broken tile - Steffen (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/d68e9a77-8c9a-46b9-8e68-a077b6bd1d93/
• Broken tile white with cracks - Textures Can (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/1e111092-a033-416d-9190-f1d3c1949131/
• PBR white & silver broken tiles - 3DAssets Kit (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/fc422d45-4b48-4a2a-87e6-2101eafe1f0a/
• Puddles broken tiles - Textures Can (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/900a852d-fdf5-43aa-b938-25fd9c2440ff/
• Small red tiles - ydd 3D (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/0e92c653-c68d-46fc-8d73-1562e4468e01/
• Animal fur - ydd 3D (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/a339cd60-3dd5-43c5-a642-e08ff8dab158/
• Metal old dark - James Middleton (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/5f12bed6-fb90-4e05-a81d-5a7789d87dd8/
• Red crystal glass - ydd 3D (Royalty Free) - https://www.blenderkit.com/asset-gallery-detail/2f3dc00d-09c4-4af1-9044-3e1d80633b78/

Tools
• three.js
• Blender
• Vite
• ESLint
• Prettier

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
    } else if (/^(group members|tools|special thanks|Mutation Detective|background imagery|sounds & music|videos|models|materials)$/i.test(line)) {
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
      position: absolute; inset: 64px 24px 64px 24px;
      display:flex; justify-content:center; align-items:stretch;
      overflow:hidden;
    }
    .credits-scroll-container {
      width: min(720px, 86%);
      max-height: 100%;
      overflow-y: auto;
      padding-right: 18px;
      margin-right: -6px;
      scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: rgba(148,255,236,.6) rgba(10,12,15,.6);
    }
    .credits-scroll-container::-webkit-scrollbar {
      width: 8px;
    }
    .credits-scroll-container::-webkit-scrollbar-track {
      background: rgba(10,12,15,.6);
    }
    .credits-scroll-container::-webkit-scrollbar-thumb {
      background: rgba(148,255,236,.6);
      border-radius: 12px;
    }
    .credits-scroll {
      width: 100%;
      text-align:center;
      filter: drop-shadow(0 2px 0 rgba(0,0,0,.75));
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
  const scrollContainer = document.createElement("div");
  scrollContainer.className = "credits-scroll-container";
  scrollContainer.tabIndex = 0;
  scrollContainer.setAttribute("role", "document");
  scrollContainer.setAttribute("aria-label", "Credits content");
  const scrollContent = buildCreditsContent(CREDIT_TEXT);
  scrollContainer.appendChild(scrollContent);
  innerWrap.appendChild(scrollContainer);

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
    let autoScrollRafId = null;
    let resumeTimer = null;
    let lastTimestamp = 0;
    let autoScrollFinished = false;
    let userInteracted = false;

    const maxScrollAmount = () => Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);

    const cancelAutoScroll = () => {
      if (autoScrollRafId !== null) {
        cancelAnimationFrame(autoScrollRafId);
        autoScrollRafId = null;
      }
    };

    const cancelResumeTimer = () => {
      if (resumeTimer) {
        window.clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    };

    const finalize = () => {
      if (finished) return;
      finished = true;
      if (closeTimer) window.clearTimeout(closeTimer);
      cancelResumeTimer();
      cancelAutoScroll();
      window.removeEventListener("keydown", handleKey);
      scrollContainer.removeEventListener("scroll", handleScroll);
      scrollContainer.removeEventListener("keydown", handleScrollKey);
      interactionEvents.forEach((evt) => scrollContainer.removeEventListener(evt, markInteraction));
      button.removeEventListener("click", finalize);
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
      try { onClose?.(); } catch (err) { console.warn("[credits] onClose handler error:", err); }
      if (restartOnFinish) window.dispatchEvent(new Event("credits:restart"));
      resolve();
    };

    const handleAutoScrollComplete = () => {
      if (autoScrollFinished || finished) return;
      autoScrollFinished = true;
      cancelResumeTimer();
      cancelAutoScroll();
      if (closeTimer) {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(finalize, 3000);
      } else if (autoCloseMs <= 0) {
        closeTimer = window.setTimeout(finalize, 3000);
      }
    };

    const autoScrollStep = (timestamp) => {
      if (finished || autoScrollFinished) return;
      const maxScroll = maxScrollAmount();
      if (maxScroll <= 0) {
        handleAutoScrollComplete();
        return;
      }
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const next = Math.min(
        scrollContainer.scrollTop + (AUTO_SCROLL_SPEED_PX_PER_SEC * delta) / 1000,
        maxScroll
      );
      scrollContainer.scrollTop = next;

      if (scrollContainer.scrollTop >= maxScroll - 1) {
        handleAutoScrollComplete();
      } else {
        autoScrollRafId = requestAnimationFrame(autoScrollStep);
      }
    };

    const startAutoScroll = () => {
      if (finished || autoScrollFinished) return;
      const maxScroll = maxScrollAmount();
      if (maxScroll <= 0) {
        handleAutoScrollComplete();
        return;
      }
      cancelAutoScroll();
      autoScrollRafId = requestAnimationFrame((ts) => {
        lastTimestamp = ts;
        autoScrollRafId = requestAnimationFrame(autoScrollStep);
      });
    };

    const scheduleAutoClose = () => {
      if (finished) return;
      if (autoCloseMs <= 0) return;
      const maxScroll = maxScrollAmount();
      const estimatedDuration = maxScroll > 0
        ? (maxScroll / AUTO_SCROLL_SPEED_PX_PER_SEC) * 1000
        : 0;
      const delay = Math.max(autoCloseMs, estimatedDuration + 4000);
      if (closeTimer) window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(finalize, delay);
    };

    const queueResume = () => {
      cancelResumeTimer();
      if (autoScrollFinished) return;
      resumeTimer = window.setTimeout(() => {
        userInteracted = false;
        startAutoScroll();
      }, 2000);
    };

    const markInteraction = () => {
      if (finished || autoScrollFinished) return;
      userInteracted = true;
      if (document.activeElement !== scrollContainer) {
        scrollContainer.focus({ preventScroll: true });
      }
      cancelAutoScroll();
      queueResume();
    };

    const handleScroll = () => {
      if (finished || autoScrollFinished) return;
      if (scrollContainer.scrollTop >= maxScrollAmount() - 1) {
        handleAutoScrollComplete();
      }
    };

    const handleScrollKey = (event) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.code)) {
        markInteraction();
      }
    };

    const handleKey = (event) => {
      if (event.code === "Escape" || event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        finalize();
      }
    };

    const interactionEvents = ["wheel", "touchstart", "mousedown"];

    interactionEvents.forEach((evt) => scrollContainer.addEventListener(evt, markInteraction, { passive: true }));
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    scrollContainer.addEventListener("keydown", handleScrollKey);
    button.addEventListener("click", finalize);
    window.addEventListener("keydown", handleKey);

    document.body.appendChild(overlay);
    overlay.focus();

    requestAnimationFrame(() => {
      scrollContainer.focus({ preventScroll: true });
      scheduleAutoClose();
      if (!userInteracted) startAutoScroll();
    });
  });
}
