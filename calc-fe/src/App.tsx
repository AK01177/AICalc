import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const REALMS = ["math", "physics", "chemistry"];
const INKS = ["#000080", "#000000", "#ff0000", "#008000", "#800080", "#808080"];

type StepBit = { explanation: string };
type SolveCard = { expr: string; result: string; steps?: StepBit[] };
type SolveReply = { data?: SolveCard[]; usage?: { total_tokens?: number } };
type StickyInk = { id: string; x: number; y: number; width: number; height: number; text: string };

const apiUrl = (path: string) => {
  const base = import.meta.env.VITE_API_BASE || "";
  return base ? `${base.replace(/\/$/, "")}/${path}` : `/api/${path}`;
};

export default function App() {
  const [color, setColor] = useState(INKS[0]);
  const [brush, setBrush] = useState(3);
  const [subject, setSubject] = useState(REALMS[0]);
  const [results, setResults] = useState<SolveCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepPeek, setStepPeek] = useState(false);
  const [scrubOn, setScrubOn] = useState(false);
  const [typeHat, setTypeHat] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [tokenPile, setTokenPile] = useState(0);
  const [toolTrayOpen, setToolTrayOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [stickies, setStickies] = useState<StickyInk[]>([]);
  const [hotStickyId, setHotStickyId] = useState<string | null>(null);

  const grabRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const stretchRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<CanvasRenderingContext2D | null>(null);
  const trailRef = useRef<number[][]>([]);
  const scribbleRef = useRef(false);
  const beforeInkRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aicalc_total_tokens");
    if (saved) setTokenPile(Number(saved));
  }, []);

  useEffect(() => {
    const sniff = () => setIsMobile(window.innerWidth <= 768);
    sniff();
    window.addEventListener("resize", sniff);
    return () => window.removeEventListener("resize", sniff);
  }, []);

  useEffect(() => {
    const ep = apiUrl("healthz");
    let retries = 0;
    const poke: () => void = () => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 10000);
      fetch(ep, { signal: ac.signal })
        .then(r => { clearTimeout(t); if (r.ok) console.log("Backend is ready"); else throw 0; })
        .catch(() => { clearTimeout(t); if (retries++ < 5) setTimeout(poke, Math.min(1000 * 1.5 ** retries, 10000)); });
    };
    poke();
    const iv = setInterval(() => fetch(ep).catch(() => {}), 14 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  const primePaper = useCallback(() => {
    const canvas = paperRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    inkRef.current = ctx;
  }, []);

  useEffect(() => {
    const canvas = paperRef.current;
    if (!canvas) return;
    primePaper();
    const obs = new ResizeObserver(() => {
      const temp = canvas.toDataURL();
      primePaper();
      const img = new Image();
      img.onload = () => inkRef.current?.drawImage(img, 0, 0,
        canvas.width / (window.devicePixelRatio || 1),
        canvas.height / (window.devicePixelRatio || 1));
      img.src = temp;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [primePaper]);

  const slingInk = () => {
    const ctx = inkRef.current;
    if (!ctx || !trailRef.current.length || !beforeInkRef.current) return;
    ctx.putImageData(beforeInkRef.current, 0, 0);

    let pts = trailRef.current;
    if (pts.length > 3) {
      const smoothed = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [p1, p2] = [pts[i], pts[i + 1]];
        smoothed.push(
          [p1[0] * 0.75 + p2[0] * 0.25, p1[1] * 0.75 + p2[1] * 0.25, p1[2]],
          [p1[0] * 0.25 + p2[0] * 0.75, p1[1] * 0.25 + p2[1] * 0.75, p2[2]]
        );
      }
      smoothed.push(pts[pts.length - 1]);
      pts = smoothed;
    }

    const stroke = getStroke(pts, { size: brush * 2, thinning: 0.5, smoothing: 0.5, streamline: 0.5 });
    if (!stroke.length) return;
    ctx.fillStyle = scrubOn ? "#ffffff" : color;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    stroke.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };

  const catchPen = (e: React.PointerEvent<HTMLCanvasElement>, type: string) => {
    if (typeHat) return;
    const canvas = paperRef.current, ctx = inkRef.current;
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const p = [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];

    if (type === "down") {
      scribbleRef.current = true;
      trailRef.current = [p];
      beforeInkRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHasInk(true);
    } else if (type === "move" && scribbleRef.current) {
      trailRef.current.push(p);
      slingInk();
    } else if (type === "up") {
      scribbleRef.current = false;
      trailRef.current = [];
    }
  };

  const plantSticky = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!typeHat || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const id = `tb_${Date.now()}`;
    setStickies(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top, width: 180, height: 60, text: "" }]);
    setHotStickyId(id);
    setHasInk(true);
  };

  const updateSticky = (id: string, patch: Partial<StickyInk>) =>
    setStickies(prev => prev.map(tb => tb.id === id ? { ...tb, ...patch } : tb));

  const moveSticky = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grabRef.current, s = stretchRef.current;
    if (g) {
      const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
      updateSticky(g.id, { x: g.origX + dx, y: g.origY + dy });
    }
    if (s) {
      const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
      updateSticky(s.id, { width: Math.max(100, s.origW + dx), height: Math.max(40, s.origH + dy) });
    }
  };

  const dropSticky = () => { grabRef.current = null; stretchRef.current = null; };

  const stampStickies = () => {
    const canvas = paperRef.current, ctx = inkRef.current;
    if (!canvas || !ctx) return;
    stickies.forEach(tb => {
      if (!tb.text.trim()) return;
      ctx.save();
      ctx.font = "14px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";
      const maxW = tb.width - 12;
      const words = tb.text.split(/\s+/);
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      lines.forEach((line, i) => ctx.fillText(line, tb.x + 6, tb.y + 24 + i * 16));
      ctx.restore();
    });
  };

  const crunch = async () => {
    const canvas = paperRef.current, ctx = inkRef.current;
    if (!canvas) return;
    setLoading(true);
    setError(null);

    let preSnapshot: ImageData | null = null;
    if (ctx && stickies.length > 0) {
      preSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      stampStickies();
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const maxDim = 768;
        const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
        const off = document.createElement("canvas");
        off.width = canvas.width * scale;
        off.height = canvas.height * scale;
        off.getContext("2d")?.drawImage(canvas, 0, 0, off.width, off.height);

        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 60000);
        const resp = await fetch(apiUrl("calculate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: off.toDataURL("image/png"), subject, dict_of_vars: {}, include_steps: stepPeek }),
          signal: ac.signal,
        });
        clearTimeout(t);

        if (!resp.ok) throw new Error(`Server Error (${resp.status}): ${(await resp.text()).slice(0, 100)}`);
        const ct = resp.headers.get("content-type");
        if (!ct?.includes("application/json")) throw new Error(`Unexpected response format: ${(await resp.text()).slice(0, 100)}`);

        const data = (await resp.json()) as SolveReply;
        setResults(data.data || []);
        const used = data.usage?.total_tokens || 0;
        if (used > 0) setTokenPile(prev => {
          const next = prev + used;
          localStorage.setItem("aicalc_total_tokens", String(next));
          return next;
        });

        if (preSnapshot && ctx) ctx.putImageData(preSnapshot, 0, 0);
        setLoading(false);
        return;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error("Unknown error");
        const msg = lastError.message;
        if (!(msg.includes("Server Error") && msg.includes("(4") || msg.includes("(5")) && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (preSnapshot && ctx) ctx.putImageData(preSnapshot, 0, 0);
    const msg = lastError?.message || "Something went wrong";
    setError(msg.includes("Server Error") ? msg : "Backend is starting up. Please try again in a few seconds.");
    setLoading(false);
  };

  const toggleStyle = (on: boolean) => ({
    background: on ? "#808080" : "#c0c0c0",
    color: on ? "#fff" : "#000",
    boxShadow: on ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)",
  });

  return (
    <div className="page">
      <header>
        <div className="row" style={{ flex: 1 }}>
          <strong style={{ letterSpacing: "1px" }}>AICalc by Aryan Ranavat</strong>
        </div>
      </header>

      <div className="row top-toolbar">
        <button onClick={crunch} disabled={loading || !hasInk}>{loading ? "BUSY..." : "CALCULATE"}</button>
        <button onClick={() => { primePaper(); setHasInk(false); setResults([]); setScrubOn(false); setTypeHat(false); setStickies([]); setHotStickyId(null); }}>CLEAR</button>
        <button onClick={() => { setScrubOn(!scrubOn); setTypeHat(false); }} style={toggleStyle(scrubOn)}>{scrubOn ? "ERASING" : "ERASER"}</button>
        <button onClick={() => { setTypeHat(!typeHat); setScrubOn(false); }} style={toggleStyle(typeHat)}>{typeHat ? "TYPING" : "TEXT"}</button>
        <div className="toolbar-spacer" style={{ flex: 1 }} />
        <span className="toolbar-label">MODEL: {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}</span>
        <span className="toolbar-label">TOKENS: {tokenPile.toLocaleString()}</span>
      </div>

      <div className="canvas-wrap" ref={stageRef} onPointerMove={moveSticky} onPointerUp={dropSticky} onPointerLeave={dropSticky}>
        <canvas
          ref={paperRef}
          style={{ touchAction: "none", cursor: typeHat ? "text" : "crosshair" }}
          onPointerDown={e => catchPen(e, "down")}
          onPointerMove={e => catchPen(e, "move")}
          onPointerUp={e => catchPen(e, "up")}
          onPointerLeave={e => catchPen(e, "up")}
          onClick={plantSticky}
        />

        {stickies.map(tb => (
          <div key={tb.id} className={`text-box${hotStickyId === tb.id ? " focused" : ""}`}
            style={{ left: tb.x, top: tb.y, width: tb.width, height: tb.height }}
            onPointerDown={() => setHotStickyId(tb.id)}>
            <div className="text-box-handle" onPointerDown={e => {
              e.preventDefault(); e.stopPropagation();
              grabRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y };
            }}>
              <button className="text-box-close" onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setStickies(prev => prev.filter(s => s.id !== tb.id)); if (hotStickyId === tb.id) setHotStickyId(null); }}>
                ✕
              </button>
            </div>
            <div className="text-box-content" contentEditable suppressContentEditableWarning
              onInput={e => updateSticky(tb.id, { text: (e.target as HTMLDivElement).innerText })}
              onPointerDown={e => e.stopPropagation()} />
            <div className="text-box-resize" onPointerDown={e => {
              e.preventDefault(); e.stopPropagation();
              stretchRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origW: tb.width, origH: tb.height };
            }} />
          </div>
        ))}

        <div className={`controls-backdrop${toolTrayOpen ? " visible" : ""}`} onClick={() => setToolTrayOpen(false)} />

        <div className={`controls${toolTrayOpen ? " mobile-open" : ""}`}>
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {REALMS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="control-group">
            <div className="row justify-between">
              <span className="label">BRUSH SIZE</span>
              <span className="val">{brush}</span>
            </div>
            <input type="range" min="1" max="15" value={brush} onChange={e => setBrush(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <span className="label">COLORS</span>
            <div className="row wrap">
              {INKS.map(s => (
                <div key={s} className={`swatch ${color === s ? "active" : ""}`} style={{ background: s }}
                  onClick={() => { setColor(s); setScrubOn(false); }} />
              ))}
            </div>
          </div>
          <div className="control-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={stepPeek} onChange={e => setStepPeek(e.target.checked)} />
              <span>SHOW STEPS</span>
            </label>
          </div>
        </div>

        {isMobile && !toolTrayOpen && results.length === 0 && (
          <button className="mobile-controls-toggle" onClick={() => setToolTrayOpen(true)} aria-label="Open drawing tools">⚙</button>
        )}

        {results.length > 0 && (
          <div className="results-area">
            <button className="results-close-btn" onClick={() => setResults([])}>✕ CLOSE</button>
            {results.map((r, i) => (
              <div key={i} className="card">
                <div className="result-line">
                  <InlineMath math={r.expr} /> = <strong><InlineMath math={r.result} /></strong>
                </div>
                {stepPeek && r.steps?.map((s, j) => <div key={j} className="step-detail">{s.explanation}</div>)}
              </div>
            ))}
          </div>
        )}

        {error && <div className="results-area error-results">ERR: {error}</div>}
      </div>
    </div>
  );
}
