// ZipOverlay: small standalone overlay for the "zip" node-connecting mini-game
export class ZipOverlay {
  static _instance;

  /** Create or get singleton */
  static get() {
    if (!ZipOverlay._instance) ZipOverlay._instance = new ZipOverlay();
    return ZipOverlay._instance;
  }

  constructor() {
    this.root = null;
    this.canvas = null;
    this.ctx = null;
    this.level = null; // { nodes: [{x:0..1,y:0..1,label:'1'}], allowCross:false }
    this._sortedNodeIndices = null; // indices sorted by target numeric value
    this.onWin = () => {};
    this.onFail = () => {};
    this.state = {
      orderIndex: 0,
      path: [], // indices of nodes in order
      dragging: false,
      hoverNode: -1,
      wrongFlashUntil: 0
    };
    this._raf = null;
    this._bounds = { x: 0, y: 0, w: 0, h: 0 };
    this._pointer = { x: 0, y: 0 };
    this._pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this._injectStyle();
  }

  /** Public: Open overlay with a level + callbacks */
  open({ level, onWin, onFail } = {}) {
    if (!level || !Array.isArray(level.nodes) || level.nodes.length < 2) {
      throw new Error("ZipOverlay.open: level.nodes (>=2) required");
    }
    this.level = {
      allowCross: false,
      ...level
    };
    // Optionally randomize node positions for a fresh layout each open.
    // Default behavior: randomize unless caller explicitly sets level.randomizePositions === false
    if (this.level.randomizePositions !== false) {
      // simple random layout with minimal separation in normalized coordinates
      const placed = [];
      const minSep = 0.12; // normalized units (approx)
      const margin = 0.06; // keep nodes away from edges
      const attemptsPerNode = 200;
      for (let i = 0; i < this.level.nodes.length; i++) {
        let x, y, ok = false;
        let attempts = 0;
        while (!ok && attempts < attemptsPerNode) {
          x = margin + Math.random() * (1 - margin * 2);
          y = margin + Math.random() * (1 - margin * 2);
          ok = true;
          for (let j = 0; j < placed.length; j++) {
            const dx = x - placed[j].x;
            const dy = y - placed[j].y;
            if (Math.hypot(dx, dy) < minSep) { ok = false; break; }
          }
          attempts++;
        }
        // fallback: if we couldn't find a separated position, allow placing anyway
        placed.push({ x: x ?? (margin + Math.random() * (1 - margin * 2)), y: y ?? (margin + Math.random() * (1 - margin * 2)) });
      }
      // write positions back into nodes
      this.level.nodes.forEach((n, idx) => {
        n.x = placed[idx].x;
        n.y = placed[idx].y;
      });
    }
    // If nodes contain math expressions (in `expr` or `label`), evaluate them
    // and compute an ordering from smallest to largest value. Each node keeps
    // its provided position; ordering is enforced via _sortedNodeIndices.
    try {
      const evals = this.level.nodes.map((n, idx) => {
        const source = (n.expr ?? n.label ?? String(idx));
        let value = Number(idx);
        try {
          value = Number(this._evaluateExpr(String(source)));
          if (!Number.isFinite(value)) throw new Error('non-finite');
        } catch (e) {
          console.warn('[ZipOverlay] expression parse failed for', source, e);
          // fallback: if it's not an expression, try parseFloat of label
          const attempt = parseFloat(String(source).replace(/[^0-9+\-.\deE]/g, ''));
          value = Number.isFinite(attempt) ? attempt : idx;
        }
        return { idx, value };
      });
  // sort DESCENDING by computed numeric value (HIGH_TO_LOW priority)
  this._sortedNodeIndices = evals.slice().sort((a,b) => b.value - a.value).map(x => x.idx);
    } catch (e) {
      console.warn('[ZipOverlay] failed to compute node ordering, falling back', e);
      // if anything goes wrong, fall back to natural index order
      this._sortedNodeIndices = this.level.nodes.map((_, i) => i);
    }
    this.onWin = typeof onWin === "function" ? onWin : () => {};
    this.onFail = typeof onFail === "function" ? onFail : () => {};

    if (!this.root) this._buildDOM();
    this.root.style.display = "grid";
    this.root.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    this._resetState();
    this._resize();
    this._loop();
    window.dispatchEvent(new CustomEvent('zip:opened'));
  }

  // Evaluate a simple arithmetic expression with operators + - * / ^ and parentheses.
  // This uses a controlled transform (caret -> **), a whitelist of allowed chars,
  // and the Function constructor to evaluate. Keep expressions simple and local.
  _evaluateExpr(expr) {
    // normalize and replace caret with exponent operator
    const normalized = String(expr).replace(/\^/g, '**').trim();
    // allow digits, whitespace, parentheses, decimal point and basic operators
    if (!/^[0-9+\-*/().\s*]+$/.test(normalized)) {
      throw new Error('unsafe expression');
    }
    // Evaluate in a strict function scope
    return Function('"use strict"; return (' + normalized + ');')();
  }

  /** Public: Close overlay */
  close() {
    if (!this.root) return;
    this.root.style.display = "none";
    this.root.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    cancelAnimationFrame(this._raf);
    this._raf = null;
    window.dispatchEvent(new CustomEvent('zip:closed'));
  }

  /** Public: Convenience singleton helpers */
  static open(opts) { ZipOverlay.get().open(opts); }
  static close() { ZipOverlay.get().close(); }

  /* ---------------- internal ---------------- */

  _injectStyle() {
    if (document.getElementById("zip-overlay-style")) return;
    const css = `
    .zip-overlay {
      position: fixed; inset: 0;
      z-index: 9999;
      display: none;
      place-items: center;
      background: rgba(0,0,0,0.72);
      backdrop-filter: blur(2px);
      font-family: 'VT323', system-ui, monospace;
    }
    .zip-panel {
      position: relative;
      /* make the UI extremely large - take most of the viewport */
      width: min(100vw, 1800px);
      height: min(92vh, 1000px);
      background: radial-gradient(ellipse at center, #0b0f10 0%, #040607 70%, #000 100%);
      border: 8px solid #1a2226;
      border-radius: 14px;
      box-shadow: 0 30px 120px rgba(0,0,0,1), inset 0 0 140px rgba(0,255,200,0.08);
      overflow: hidden;
      padding: 18px;
    }
    /* CRT scanlines */
    .zip-panel::after {
      content: "";
      position: absolute; inset: 0;
      background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.06) 1px, transparent 2px, transparent 3px);
      mix-blend-mode: overlay;
      pointer-events: none;
      opacity: .25;
      animation: zip-flicker 2.1s infinite steps(60);
    }
    @keyframes zip-flicker { 50% { opacity: .18; } }

    .zip-topbar {
      position: absolute; top: 0; left: 0; right: 0;
      height: 72px; display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; color: #9ee7d7;
      text-shadow: 0 0 12px rgba(0,255,200,0.7);
      letter-spacing: 1px; user-select: none;
      font-size: 20px;
    }
    .zip-btn {
      cursor: pointer; color: #9ee7d7; background: #0d1719; border: 1px solid #1d2c30;
      padding: 10px 16px; border-radius: 10px;
      box-shadow: 0 0 22px rgba(0,255,200,0.18) inset;
      transition: transform .05s ease, box-shadow .2s ease;
      font-size: 18px;
    }
    .zip-btn:hover { box-shadow: 0 0 18px rgba(0,255,200,0.2) inset; }
    .zip-btn:active { transform: translateY(1px); }

    .zip-instructions {
      position: absolute; left: 18px; bottom: 14px; right: 18px;
      color: #7fd2c1; font-size: 20px; opacity: .95;
      text-shadow: 0 0 8px rgba(0,255,200,.35);
      user-select: none;
      line-height: 1.2;
    }

    canvas.zip-canvas { display: block; width: 100%; height: 100%; }

    .zip-hudchip {
      position: absolute; top: 84px; right: 28px;
      color: #9ee7d7; font-size: 16px; opacity: .99;
      padding: 10px 14px; border: 1px solid #1d2c30; border-radius: 10px;
      background: rgba(4,14,16,0.75);
      box-shadow: 0 0 24px rgba(0,255,200,0.18) inset;
      user-select: none;
      max-width: 520px;
      text-align: left;
      white-space: normal;
    }

    @media (max-width: 520px) {
      .zip-topbar { height: 44px; }
      .zip-btn { font-size: 12px; padding: 6px 8px; }
      .zip-instructions { font-size: 13px; }
      .zip-hudchip { display:block; max-width: 80vw; }
      .zip-panel { width: 92vw; height: 68vh; }
    }
    `;
    const style = document.createElement("style");
    style.id = "zip-overlay-style";
    style.textContent = css;
    document.head.appendChild(style);

    // Optional arcade font
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=VT323&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }

  _buildDOM() {
    this.root = document.createElement("div");
    this.root.className = "zip-overlay";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Arcade Link Panel");

    const panel = document.createElement("div");
    panel.className = "zip-panel";

    const top = document.createElement("div");
    top.className = "zip-topbar";
    top.innerHTML = `
      <div>ARCADE LINK &nbsp;•&nbsp; BIO-FACILITY LOCKDOWN BYPASS</div>
      <div>
        <button class="zip-btn" data-act="reset">RESET</button>
        <button class="zip-btn" data-act="close">EXIT</button>
      </div>
    `;

    const chip = document.createElement("div");
    chip.className = "zip-hudchip";
    // show the RUN hint only (HIGH_TO_LOW priority)
    chip.innerHTML = `<div style="font-family: monospace;">&gt; RUN: PURGE.PROTOCOL --priority HIGH_TO_LOW</div>`;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "zip-canvas";
    this.ctx = this.canvas.getContext("2d");

    panel.appendChild(top);
    panel.appendChild(chip);
    panel.appendChild(this.canvas);
    // (instruction text removed per request)
    this.root.appendChild(panel);
    document.body.appendChild(this.root);

    this._bindUI(top);
    this._bindInput();
    window.addEventListener("resize", () => this._resize());
    window.addEventListener("orientationchange", () => this._resize());
  }

  _bindUI(topbar) {
    topbar.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      if (act === "close") this.close();
      if (act === "reset") this._resetState();
    });
  }

  _bindInput() {
    const c = this.canvas;
    const setPointer = (clientX, clientY) => {
      const rect = c.getBoundingClientRect();
      this._pointer.x = (clientX - rect.left) / rect.width;
      this._pointer.y = (clientY - rect.top) / rect.height;
      this.state.hoverNode = this._hitNode(this._pointer.x, this._pointer.y);
    };

    c.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      setPointer(e.clientX, e.clientY);
      const nodeIdx = this.state.hoverNode;
      // Allow starting from any node (difficult mode). Only accept if hovering a node
      if (nodeIdx >= 0) {
        // ignore duplicates
        if (!this.state.path.includes(nodeIdx)) {
          this.state.path.push(nodeIdx);
        }
        this.state.dragging = true;
        // If we've connected all nodes, evaluate the sequence
        if (this.state.path.length === this.level.nodes.length) {
          this._evaluateSequenceAndFinish();
        }
      } else {
        this._wrongFlash();
      }
    });

    c.addEventListener("pointermove", (e) => {
      if (!this.root || this.root.style.display === "none") return;
      setPointer(e.clientX, e.clientY);
      if (!this.state.dragging) return;

      // If over next expected node, lock it in
      const nodeIdx = this.state.hoverNode;
      if (nodeIdx >= 0 && !this.state.path.includes(nodeIdx)) {
        this.state.path.push(nodeIdx);
        // If we've connected all nodes, evaluate the sequence
        if (this.state.path.length === this.level.nodes.length) {
          this._evaluateSequenceAndFinish();
        }
      }
    });

    const end = (e) => {
      if (this.state.dragging) {
        // If they released before reaching next node, consider that fine — they can resume.
      }
      this.state.dragging = false;
      c.releasePointerCapture?.(e.pointerId);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
    c.addEventListener("pointerleave", end);

    // Keyboard (accessibility): arrows move a virtual cursor, Enter to “snap”
    window.addEventListener("keydown", (e) => {
      if (!this.root || this.root.style.display === "none") return;
      const step = 0.02;
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowUp") this._pointer.y = Math.max(0, this._pointer.y - step);
      if (e.key === "ArrowDown") this._pointer.y = Math.min(1, this._pointer.y + step);
      if (e.key === "ArrowLeft") this._pointer.x = Math.max(0, this._pointer.x - step);
      if (e.key === "ArrowRight") this._pointer.x = Math.min(1, this._pointer.x + step);
      this.state.hoverNode = this._hitNode(this._pointer.x, this._pointer.y);
      if (e.key === "Enter" || e.key === " ") {
        const nodeIdx = this.state.hoverNode;
        if (nodeIdx >= 0 && !this.state.path.includes(nodeIdx)) {
          this.state.path.push(nodeIdx);
          if (this.state.path.length === this.level.nodes.length) {
            this._evaluateSequenceAndFinish();
          }
        } else {
          this._wrongFlash();
        }
      }
    });
  }

  _resetState() {
    this.state.orderIndex = 0;
    this.state.path = [];
    this.state.dragging = false;
    this.state.hoverNode = -1;
    this.state.wrongFlashUntil = 0;
  }

  _resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this._pixelRatio;
    this.canvas.width = Math.max(2, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(2, Math.floor(rect.height * dpr));
    this._bounds = { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height, dpr };
  }

  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    this._draw();
  }

  _draw() {
    const { ctx } = this;
    const { w, h } = this._bounds;
    ctx.clearRect(0, 0, w, h);

    // Grid
    this._drawGrid();

    // Existing path lines
    this._drawLines();

    // Active drag line
    this._drawDragLine();

    // Nodes
    this._drawNodes();

    // Wrong flash overlay
    if (performance.now() < this.state.wrongFlashUntil) {
      ctx.fillStyle = "rgba(255,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawGrid() {
    const { ctx } = this;
    const { w, h } = this._bounds;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#0b2b2c";
    ctx.lineWidth = 1 * this._bounds.dpr;
    const step = 40 * this._bounds.dpr;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();
  }

  _nodePx(node) {
    const { w, h } = this._bounds;
    return { x: node.x * w, y: node.y * h };
  }

  _drawNodes() {
    const { ctx } = this;
    // increase node radius to make nodes more prominent
    const r = Math.max(14, Math.min(40, this._bounds.w / 35));
    const glow = 14 * this._bounds.dpr;
    for (let i = 0; i < this.level.nodes.length; i++) {
      const n = this.level.nodes[i];
      const p = this._nodePx(n);
      const isDone = this.state.path.includes(i);
      const isNext = i === this.state.orderIndex || i === this.state.orderIndex + 1;
      const isHover = i === this.state.hoverNode;

      // Glow
      ctx.save();
      ctx.shadowBlur = glow;
      ctx.shadowColor = isDone ? "#3dffcf" : isNext ? "#8fffe6" : "#0a9383";
      ctx.fillStyle = "#052d2b";
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Outer ring
      ctx.lineWidth = 2 * this._bounds.dpr;
      ctx.strokeStyle = isDone ? "#3dffcf" : isNext ? "#8fffe6" : "#1c5850";
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();

      // Label (display '*' as 'x' for multiplication)
      const rawLabel = n.label ?? String(i+1);
      const displayLabel = String(rawLabel).replace(/\*/g, 'x');
      ctx.fillStyle = isHover ? "#eafffb" : "#9ee7d7";
      ctx.font = `${Math.round(r*1.3)}px VT323, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(displayLabel, p.x, p.y);
    }
  }

  _drawLines() {
    if (this.state.path.length < 2) return;
    const { ctx } = this;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4 * this._bounds.dpr;
    ctx.strokeStyle = "#39f5cc";
    ctx.shadowBlur = 10 * this._bounds.dpr;
    ctx.shadowColor = "rgba(0,255,220,0.6)";

    ctx.beginPath();
    for (let i = 0; i < this.state.path.length; i++) {
      const idx = this.state.path[i];
      const p = this._nodePx(this.level.nodes[idx]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // small "running current" dots
    const t = performance.now() * 0.004;
    for (let i = 1; i < this.state.path.length; i++) {
      const a = this._nodePx(this.level.nodes[this.state.path[i-1]]);
      const b = this._nodePx(this.level.nodes[this.state.path[i]]);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const count = Math.max(2, Math.floor(d / 60));
      for (let k = 0; k < count; k++) {
        const u = ((k / count) + (t % 1)) % 1;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y + (b.y - a.y) * u;
        this._dot(x, y, 2.2 * this._bounds.dpr);
      }
    }
  }

  _drawDragLine() {
    if (!this.state.dragging || this.state.path.length === 0) return;
    const lastIdx = this.state.path[this.state.path.length - 1];
    const a = this._nodePx(this.level.nodes[lastIdx]);
    const { ctx } = this;
    const bx = this._pointer.x * this._bounds.w;
    const by = this._pointer.y * this._bounds.h;

    ctx.save();
    ctx.lineWidth = 3.5 * this._bounds.dpr;
    ctx.strokeStyle = "#8fffe6";
    ctx.setLineDash([8 * this._bounds.dpr, 8 * this._bounds.dpr]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bx, by); ctx.stroke();
    ctx.restore();
  }

  _dot(x, y, r) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = "#e6fff9";
    ctx.shadowBlur = 8 * this._bounds.dpr;
    ctx.shadowColor = "rgba(0,255,200,0.7)";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _hitNode(nx, ny) {
    // hit test in normalized space
    const px = nx * this._bounds.w, py = ny * this._bounds.h;
    // increase hit radius to match larger node visuals
    const r = Math.max(20, Math.min(48, this._bounds.w / 30));
    for (let i = 0; i < this.level.nodes.length; i++) {
      const p = this._nodePx(this.level.nodes[i]);
      if ((px - p.x)**2 + (py - p.y)**2 <= r*r) return i;
    }
    return -1;
  }

  _wrongFlash() {
    this.state.wrongFlashUntil = performance.now() + 180;
    // optional: notify fail without closing
    this.onFail?.("out_of_order");
  }

  // Evaluate the player's picked sequence against the computed correct ordering
  _evaluateSequenceAndFinish() {
    // Normalize arrays: compare path (sequence of original indices) to sorted order
    const correct = Array.isArray(this._sortedNodeIndices) ? this._sortedNodeIndices : this.level.nodes.map((_,i)=>i);
    const picked = this.state.path.slice();
    const match = picked.length === correct.length && picked.every((v,i) => v === correct[i]);
    if (match) {
      this._celebrate();
      setTimeout(() => this.onWin?.(), 120);
    } else {
      // wrong sequence: flash and call fail handler
      this._wrongFlash();
      try { this.onFail?.('incorrect_sequence'); } catch (err) { console.warn('[ZipOverlay] onFail handler error', err); }
      // reset after a short delay so player can retry
      setTimeout(() => this._resetState(), 700);
    }
    // stop dragging and ensure input is released
    this.state.dragging = false;
  }

  _celebrate() {
    // brief green wash
    const endAt = performance.now() + 220;
    const tick = () => {
      if (!this.ctx) return;
      if (performance.now() < endAt) requestAnimationFrame(tick);
      const { ctx } = this;
      const { w, h } = this._bounds;
      ctx.save();
      ctx.fillStyle = "rgba(0,255,200,0.14)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };
    tick();
  }
}

export default ZipOverlay;
