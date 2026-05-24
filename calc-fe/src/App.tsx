import { useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const SUBJECTS = ["math", "physics", "chemistry"];
const PEN_COLORS = ["#000080", "#000000", "#ff0000", "#008000", "#800080", "#808080"];
const API = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type Step = { explanation: string };
type SolveResult = { expr: string; result: string; steps?: Step[] };
type GeminiResponse = { data?: SolveResult[]; usage?: { total_tokens?: number } };
type TextBox = { id: string; x: number; y: number; width: number; height: number; text: string };

export default function App() {
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [brushSize, setBrushSize] = useState(3);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [solveResults, setSolveResults] = useState<SolveResult[]>([]);
  const [solving, setSolving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [eraserOn, setEraserOn] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [canvasDirty, setCanvasDirty] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [onMobile, setOnMobile] = useState(false);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null);

  const dragState = useRef<{id: string; startX: number; startY: number; origX: number; origY: number} | null>(null);
  const resizeState = useRef<{id: string; startX: number; startY: number; origW: number; origH: number} | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctx2d = useRef<CanvasRenderingContext2D | null>(null);
  const strokePoints = useRef<number[][]>([]);
  const isDrawing = useRef(false);
  const preStrokeSnap = useRef<ImageData | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("aicalc_total_tokens");
    if (t) setTotalTokens(+t);
  }, []);

  useEffect(() => {
    const check = () => setOnMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // render.com free tier spins down after 15min idle,
  // cold starts take 30-50s so we wake it early and keep poking
  useEffect(() => {
    const url = API ? `${API}/healthz` : "/api/healthz";
    let n = 0;
    const wakeUp: () => void = () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      fetch(url, { signal: ctrl.signal })
        .then(r => { clearTimeout(t); if (r.ok) console.log("backend awake"); else throw 0; })
        .catch(() => {
          clearTimeout(t);
          if (n++ < 5) setTimeout(wakeUp, Math.min(1000 * 1.5 ** n, 10000));
        });
    };
    wakeUp();
    // 14min keeps render alive (its timeout is 15min)
    const iv = setInterval(() => fetch(url).catch(() => {}), 14 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  function resetCanvas() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = cv.getBoundingClientRect();
    cv.width = width * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx2d.current = ctx;
  }

  // preserve existing drawing across window resize
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    resetCanvas();
    const obs = new ResizeObserver(() => {
      const backup = cv.toDataURL();
      resetCanvas();
      const img = new Image();
      img.onload = () => ctx2d.current?.drawImage(img, 0, 0,
        cv.width / (window.devicePixelRatio || 1),
        cv.height / (window.devicePixelRatio || 1));
      img.src = backup;
    });
    obs.observe(cv);
    return () => obs.disconnect();
  }, []);

  // redraws full stroke from pre-stroke snapshot each frame so
  // perfect-freehand recalculates pressure curves properly
  function redrawStroke() {
    const ctx = ctx2d.current;
    if (!ctx || !strokePoints.current.length || !preStrokeSnap.current) return;
    ctx.putImageData(preStrokeSnap.current, 0, 0);

    let pts = strokePoints.current;
    if (pts.length > 3) {
      // cheap catmull-rom-ish interpolation, 2 midpoints per segment
      const smooth = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [a, b] = [pts[i], pts[i + 1]];
        smooth.push(
          [a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2]],
          [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, b[2]]
        );
      }
      smooth.push(pts[pts.length - 1]);
      pts = smooth;
    }

    const outline = getStroke(pts, { size: brushSize * 2, thinning: .5, smoothing: .5, streamline: .5 });
    if (!outline.length) return;
    ctx.fillStyle = eraserOn ? "#fff" : penColor;
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    outline.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  }

  function onCanvasPointer(e: React.PointerEvent<HTMLCanvasElement>, action: string) {
    if (textMode) return;
    const cv = canvasRef.current, ctx = ctx2d.current;
    if (!cv || !ctx) return;
    const { left, top } = cv.getBoundingClientRect();
    const pt = [e.clientX - left, e.clientY - top, e.pressure || .5];

    if (action === "down") {
      isDrawing.current = true;
      strokePoints.current = [pt];
      preStrokeSnap.current = ctx.getImageData(0, 0, cv.width, cv.height);
      setCanvasDirty(true);
    } else if (action === "move" && isDrawing.current) {
      strokePoints.current.push(pt);
      redrawStroke();
    } else if (action === "up") {
      isDrawing.current = false;
      strokePoints.current = [];
    }
  }

  function placeTextBox(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!textMode || !wrapperRef.current) return;
    const { left, top } = wrapperRef.current.getBoundingClientRect();
    const id = `tb_${Date.now()}`;
    setTextBoxes(prev => [...prev, { id, x: e.clientX - left, y: e.clientY - top, width: 180, height: 60, text: "" }]);
    setFocusedBoxId(id);
    setCanvasDirty(true);
  }

  function updateBox(id: string, changes: Partial<TextBox>) {
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, ...changes } : b));
  }

  function onBoxPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragState.current, r = resizeState.current;
    if (d) updateBox(d.id, { x: d.origX + e.clientX - d.startX, y: d.origY + e.clientY - d.startY });
    if (r) updateBox(r.id, { width: Math.max(100, r.origW + e.clientX - r.startX), height: Math.max(40, r.origH + e.clientY - r.startY) });
  }

  // samples every 40th pixel to check if canvas is basically blank
  function hasVisibleInk() {
    const cv = canvasRef.current, ctx = ctx2d.current;
    if (!cv || !ctx) return false;
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 160) { // r channel every 40th pixel (40*4)
      if (px[i] < 250 || px[i+1] < 250 || px[i+2] < 250) ink++;
    }
    return ink >= 15; // ~15 colored samples means user drew something real
  }

  // gemini only sees rasterized canvas, not DOM overlays,
  // so we burn text box content into the canvas pixels before sending
  function flattenTextBoxes() {
    const ctx = ctx2d.current;
    if (!ctx) return;
    for (const box of textBoxes) {
      if (!box.text.trim()) continue;
      ctx.save();
      ctx.font = "14px 'Share Tech Mono', monospace";
      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";
      const maxW = box.width - 12;
      const words = box.text.split(/\s+/);
      let lines: string[] = [], line = "";
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      }
      if (line) lines.push(line);
      lines.forEach((l, i) => ctx.fillText(l, box.x + 6, box.y + 24 + i * 16));
      ctx.restore();
    }
  }

  async function sendToGemini() {
    const cv = canvasRef.current, ctx = ctx2d.current;
    if (!cv) return;

    // don't burn an API call on a blank canvas
    const hasText = textBoxes.some(b => b.text.trim());
    if (!hasVisibleInk() && !hasText) {
      setErrMsg("Draw or type something first");
      return;
    }

    setSolving(true);
    setErrMsg(null);

    // snapshot before text flatten so we can restore canvas after
    let preFlatten: ImageData | null = null;
    if (ctx && textBoxes.length) {
      preFlatten = ctx.getImageData(0, 0, cv.width, cv.height);
      flattenTextBoxes();
    }

    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        // scale down to 768px max — bigger just wastes gemini tokens
        const scale = Math.min(1, 768 / Math.max(cv.width, cv.height));
        const tmp = document.createElement("canvas");
        tmp.width = cv.width * scale;
        tmp.height = cv.height * scale;
        tmp.getContext("2d")?.drawImage(cv, 0, 0, tmp.width, tmp.height);

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 60000);
        const resp = await fetch(API ? `${API}/calculate` : "/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: tmp.toDataURL("image/png"), subject, dict_of_vars: {}, include_steps: showSteps }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (!resp.ok) {
          const body = (await resp.text()).slice(0, 200);
          if (resp.status === 429) throw new Error("Rate limited by Gemini — wait a minute");
          if (resp.status === 400 && body.includes("SAFETY"))
            throw new Error("Gemini flagged this as unsafe — try redrawing clearer");
          if (resp.status === 503) throw new Error("Backend still cold starting — hang on ~30s");
          throw new Error(`Server ${resp.status}: ${body.slice(0, 100)}`);
        }

        const ct = resp.headers.get("content-type");
        if (!ct?.includes("application/json")) throw new Error(`Bad response: ${(await resp.text()).slice(0, 100)}`);

        const json = (await resp.json()) as GeminiResponse;
        setSolveResults(json.data || []);
        const used = json.usage?.total_tokens || 0;
        if (used > 0) setTotalTokens(prev => {
          const next = prev + used;
          localStorage.setItem("aicalc_total_tokens", String(next));
          return next;
        });

        if (preFlatten && ctx) ctx.putImageData(preFlatten, 0, 0);
        setSolving(false);
        return;
      } catch (e: unknown) {
        lastErr = e instanceof Error ? e : new Error("Unknown error");
        const m = lastErr.message;
        if (m.includes("Rate limited") || m.includes("unsafe")) break; // won't fix on retry
        if (m.includes("cold starting")) break; // just needs time, not retries
        // only retry on network/timeout errors, not server rejections
        if (!m.includes("Server") && attempt < 2) {
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        break;
      }
    }

    if (preFlatten && ctx) ctx.putImageData(preFlatten, 0, 0);
    const m = lastErr?.message || "Something went wrong";
    setErrMsg(m.includes("Server") || m.includes("Gemini") || m.includes("cold")
      ? m : "Backend is waking up — try again in ~30s");
    setSolving(false);
  }

  return (
    <div className="page">
      <header>
        <div className="row" style={{ flex: 1 }}>
          <strong style={{ letterSpacing: "1px" }}>AICalc by Aryan Ranavat</strong>
        </div>
      </header>

      <div className="row top-toolbar">
        <button onClick={sendToGemini} disabled={solving || !canvasDirty}>{solving ? "BUSY..." : "CALCULATE"}</button>
        <button onClick={() => { resetCanvas(); setCanvasDirty(false); setSolveResults([]); setEraserOn(false); setTextMode(false); setTextBoxes([]); setFocusedBoxId(null); }}>CLEAR</button>
        <button onClick={() => { setEraserOn(!eraserOn); setTextMode(false); }}
          style={{ background: eraserOn ? "#808080" : "#c0c0c0", color: eraserOn ? "#fff" : "#000",
            boxShadow: eraserOn ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)" }}>
          {eraserOn ? "ERASING" : "ERASER"}
        </button>
        <button onClick={() => { setTextMode(!textMode); setEraserOn(false); }}
          style={{ background: textMode ? "#808080" : "#c0c0c0", color: textMode ? "#fff" : "#000",
            boxShadow: textMode ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)" }}>
          {textMode ? "TYPING" : "TEXT"}
        </button>
        <div className="toolbar-spacer" style={{ flex: 1 }} />
        <span className="toolbar-label">MODEL: {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}</span>
        <span className="toolbar-label">TOKENS: {totalTokens.toLocaleString()}</span>
      </div>

      <div className="canvas-wrap" ref={wrapperRef} onPointerMove={onBoxPointerMove}
        onPointerUp={() => { dragState.current = null; resizeState.current = null; }}
        onPointerLeave={() => { dragState.current = null; resizeState.current = null; }}>
        <canvas
          ref={canvasRef}
          style={{ touchAction: "none", cursor: textMode ? "text" : "crosshair" }}
          onPointerDown={e => onCanvasPointer(e, "down")}
          onPointerMove={e => onCanvasPointer(e, "move")}
          onPointerUp={e => onCanvasPointer(e, "up")}
          onPointerLeave={e => onCanvasPointer(e, "up")}
          onClick={placeTextBox}
        />

        {textBoxes.map(box => (
          <div key={box.id} className={`text-box${focusedBoxId === box.id ? " focused" : ""}`}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            onPointerDown={() => setFocusedBoxId(box.id)}>
            <div className="text-box-handle" onPointerDown={e => {
              e.preventDefault(); e.stopPropagation();
              dragState.current = { id: box.id, startX: e.clientX, startY: e.clientY, origX: box.x, origY: box.y };
            }}>
              <button className="text-box-close" onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setTextBoxes(p => p.filter(b => b.id !== box.id)); if (focusedBoxId === box.id) setFocusedBoxId(null); }}>
                ✕
              </button>
            </div>
            <div className="text-box-content" contentEditable suppressContentEditableWarning
              onInput={e => updateBox(box.id, { text: (e.target as HTMLDivElement).innerText })}
              onPointerDown={e => e.stopPropagation()} />
            <div className="text-box-resize" onPointerDown={e => {
              e.preventDefault(); e.stopPropagation();
              resizeState.current = { id: box.id, startX: e.clientX, startY: e.clientY, origW: box.width, origH: box.height };
            }} />
          </div>
        ))}

        <div className={`controls-backdrop${toolsOpen ? " visible" : ""}`} onClick={() => setToolsOpen(false)} />

        <div className={`controls${toolsOpen ? " mobile-open" : ""}`}>
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="control-group">
            <div className="row justify-between">
              <span className="label">BRUSH SIZE</span>
              <span className="val">{brushSize}</span>
            </div>
            <input type="range" min="1" max="15" value={brushSize} onChange={e => setBrushSize(+e.target.value)} />
          </div>
          <div className="control-group">
            <span className="label">COLORS</span>
            <div className="row wrap">
              {PEN_COLORS.map(c => (
                <div key={c} className={`swatch ${penColor === c ? "active" : ""}`} style={{ background: c }}
                  onClick={() => { setPenColor(c); setEraserOn(false); }} />
              ))}
            </div>
          </div>
          <div className="control-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={showSteps} onChange={e => setShowSteps(e.target.checked)} />
              <span>SHOW STEPS</span>
            </label>
          </div>
        </div>

        {onMobile && !toolsOpen && solveResults.length === 0 && (
          <button className="mobile-controls-toggle" onClick={() => setToolsOpen(true)} aria-label="Open drawing tools">⚙</button>
        )}

        {solveResults.length > 0 && (
          <div className="results-area">
            <button className="results-close-btn" onClick={() => setSolveResults([])}>✕ CLOSE</button>
            {solveResults.map((r, i) => (
              <div key={i} className="card">
                <div className="result-line">
                  <InlineMath math={r.expr} /> = <strong><InlineMath math={r.result} /></strong>
                </div>
                {showSteps && r.steps?.map((s, j) => <div key={j} className="step-detail">{s.explanation}</div>)}
              </div>
            ))}
          </div>
        )}

        {errMsg && <div className="results-area error-results">ERR: {errMsg}</div>}
      </div>
    </div>
  );
}