import { useEffect, useRef, useState, PointerEvent, MouseEvent } from "react";
import { getStroke } from "perfect-freehand";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const SUBJECTS = ["math", "physics", "chemistry"];
const PEN_COLORS = ["#000080", "#000000", "#ff0000", "#008000", "#800080", "#808080"];
const API = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

type Step = { explanation: string };
type SolveResult = { expr: string; result: string; steps?: Step[] };
type GeminiResponse = { data?: SolveResult[]; usage?: { total_tokens?: number } };
type TextBox = { id: string; x: number; y: number; w: number; h: number; text: string };

export default function App() {
  const [ui, setUi] = useState({ pen: PEN_COLORS[0], size: 3, sub: SUBJECTS[0], steps: false, mode: "draw", tools: false, mobile: false });
  const [data, setData] = useState({ results: [] as SolveResult[], err: null as string | null, tokens: 0, solving: false, dirty: false });
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [resPos, setResPos] = useState({ x: 0, y: 0, w: 500, h: 400 });

  const refs = useRef({
    action: null as any, wrapper: null as HTMLDivElement | null, cv: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null, pts: [] as number[][], snap: null as ImageData | null
  });
  const boxTexts = useRef<Record<string, string>>({});

  useEffect(() => {
    const t = localStorage.getItem("aicalc_total_tokens");
    if (t) setData(d => ({ ...d, tokens: +t }));
    const chk = () => setUi(u => ({ ...u, mobile: window.innerWidth <= 768 }));
    chk(); window.addEventListener("resize", chk);

    fetch(`${API || "/api"}/healthz`).catch(() => { });
    const iv = setInterval(() => fetch(`${API || "/api"}/healthz`).catch(() => { }), 840000);
    return () => { window.removeEventListener("resize", chk); clearInterval(iv); };
  }, []);

  useEffect(() => {
    const r = () => {
      const w = refs.current.wrapper;
      if (w) setResPos(p => ({ ...p, x: Math.max(0, (w.clientWidth - p.w) / 2), y: Math.max(0, (w.clientHeight - p.h) / 2) }));
    };
    r(); window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  const resetCanvas = () => {
    const { cv } = refs.current;
    if (!cv) return;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = cv.getBoundingClientRect();
    cv.width = width * dpr; cv.height = height * dpr;
    ctx.scale(dpr, dpr); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height);
    refs.current.ctx = ctx;
  };

  useEffect(() => {
    resetCanvas();
    const obs = new ResizeObserver(() => {
      if (document.activeElement?.closest('.text-box')) return;
      const b = refs.current.cv?.toDataURL();
      resetCanvas();
      if (b) { const i = new Image(); i.onload = () => refs.current.ctx?.drawImage(i, 0, 0, refs.current.cv!.width / (window.devicePixelRatio || 1), refs.current.cv!.height / (window.devicePixelRatio || 1)); i.src = b; }
    });
    obs.observe(refs.current.cv!);
    return () => obs.disconnect();
  }, []);

  const redraw = () => {
    const { ctx, pts, snap } = refs.current;
    if (!ctx || !pts.length || !snap) return;
    ctx.putImageData(snap, 0, 0);
    let p = pts;
    if (p.length > 3) {
      const s = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const [a, b] = [p[i], p[i + 1]];
        s.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25, a[2]], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75, b[2]]);
      }
      p = [...s, p[p.length - 1]];
    }
    const outline = getStroke(p, { size: ui.size * 2, thinning: .5, smoothing: .5, streamline: .5 });
    if (!outline.length) return;
    ctx.fillStyle = ui.mode === "erase" ? "#fff" : ui.pen;
    ctx.beginPath();
    ctx.moveTo(outline[0][0], outline[0][1]);
    outline.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };

  const onPt = (e: PointerEvent, act: string) => {
    if (ui.mode === "text") return;
    const { cv, ctx } = refs.current;
    if (!cv || !ctx) return;
    const { left, top } = cv.getBoundingClientRect();
    const pt = [e.clientX - left, e.clientY - top, e.pressure || .5];
    if (act === "down") {
      refs.current.pts = [pt];
      refs.current.snap = ctx.getImageData(0, 0, cv.width, cv.height);
      setData(d => ({ ...d, dirty: true }));
    } else if (act === "move" && refs.current.pts.length) {
      refs.current.pts.push(pt); redraw();
    } else if (act === "up") refs.current.pts = [];
  };

  const addBox = (e: MouseEvent) => {
    if (ui.mode !== "text" || !refs.current.wrapper) return;
    const { left, top } = refs.current.wrapper.getBoundingClientRect();
    const id = `tb_${Date.now()}`;
    boxTexts.current[id] = "";
    setBoxes(b => [...b, { id, x: e.clientX - left, y: e.clientY - top, w: 180, h: 60, text: "" }]);
    setFocusId(id); setData(d => ({ ...d, dirty: true }));
  };

  const syncBoxText = (id: string) => {
    const text = boxTexts.current[id] ?? "";
    setBoxes(b => b.map(x => x.id === id ? { ...x, text } : x));
  };

  const onDrag = (e: PointerEvent) => {
    const a = refs.current.action;
    if (!a) return;
    const dx = e.clientX - a.sx, dy = e.clientY - a.sy;
    if (a.t === "mBox") setBoxes(b => b.map(x => x.id === a.id ? { ...x, x: a.ox + dx, y: a.oy + dy } : x));
    if (a.t === "sBox") setBoxes(b => b.map(x => x.id === a.id ? { ...x, w: Math.max(100, a.ow + dx), h: Math.max(40, a.oh + dy) } : x));
    if (a.t === "mRes") setResPos(p => ({ ...p, x: a.ox + dx, y: a.oy + dy }));
    if (a.t === "sRes") setResPos(p => ({ ...p, w: Math.max(300, a.ow + dx), h: Math.max(100, a.oh + dy) }));
  };

  const submit = async () => {
    const { cv, ctx } = refs.current;
    const liveBoxes = boxes.map(b => ({ ...b, text: boxTexts.current[b.id] ?? b.text }));
    if (!cv || !ctx || (!liveBoxes.some(b => b.text.trim()) && !data.dirty)) return setData(d => ({ ...d, err: "Draw something first" }));
    setData(d => ({ ...d, solving: true, err: null }));
    const pre = boxes.length ? ctx.getImageData(0, 0, cv.width, cv.height) : null;

    if (pre) {
      ctx.save(); ctx.font = "14px 'Share Tech Mono', monospace"; ctx.fillStyle = "#000"; ctx.textBaseline = "top";
      liveBoxes.forEach(b => {
        if (!b.text.trim()) return;
        const words = b.text.split(/\s+/);
        let line = "", y = b.y + 24;
        for (const w of words) {
          if (ctx.measureText(line + w).width > b.w - 12) { ctx.fillText(line, b.x + 6, y); y += 16; line = w + " "; }
          else line += w + " ";
        }
        ctx.fillText(line, b.x + 6, y);
      });
      ctx.restore();
    }

    try {
      const tmp = document.createElement("canvas");
      const sc = Math.min(1, 768 / Math.max(cv.width, cv.height));
      tmp.width = cv.width * sc; tmp.height = cv.height * sc;
      tmp.getContext("2d")?.drawImage(cv, 0, 0, tmp.width, tmp.height);
      const b64 = tmp.toDataURL("image/png");

      let r: Response | null = null;
      for (let i = 0; i < 3; i++) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 60000);
          r = await fetch(`${API || "/api"}/calculate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: b64, subject: ui.sub, dict_of_vars: {}, include_steps: ui.steps }),
            signal: ctrl.signal
          });
          clearTimeout(timer);
          if (r.ok) break;
          const body = await r.text();
          let msg = body.slice(0, 150);
          try { msg = JSON.parse(body).detail || msg; } catch (err) { }
          throw new Error(`HTTP ${r.status}: ${msg}`);
        } catch (e: any) {
          // Only retry on 5xx, 429 or network errors
          if (i === 2 || (!e.message.includes("HTTP 5") && !e.message.includes("HTTP 429") && e.name !== "TypeError")) throw e;
          await new Promise(res => setTimeout(res, 1500 * (i + 1)));
        }
      }

      const json = await r!.json() as GeminiResponse;
      const tk = json.usage?.total_tokens || 0;
      if (tk) localStorage.setItem("aicalc_total_tokens", String(data.tokens + tk));
      setData(d => ({ ...d, results: json.data || [], tokens: d.tokens + tk, solving: false }));
    } catch (e: any) {
      setData(d => ({ ...d, err: e.message || "Error", solving: false }));
    }
    if (pre) ctx.putImageData(pre, 0, 0);
  };

  const Floating = ({ title, onClose, isErr, children }: any) => {
    const isMobile = ui.mobile;
    const posStyle = isMobile ? {} : { left: resPos.x, top: resPos.y, width: resPos.w, height: resPos.h };
    return (
      <div className={`results-area ${isErr ? "error-results" : ""}`} style={posStyle}
        onPointerMove={!isMobile ? onDrag : undefined} onPointerUp={!isMobile ? () => refs.current.action = null : undefined} onPointerLeave={!isMobile ? () => refs.current.action = null : undefined}>
        <div className="results-area-header" onPointerDown={!isMobile ? (e => { e.preventDefault(); e.stopPropagation(); refs.current.action = { t: "mRes", sx: e.clientX, sy: e.clientY, ox: resPos.x, oy: resPos.y }; }) : undefined}>
          <span>{title}</span><button className="results-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="results-area-content">{children}</div>
        {!isMobile && <div className="results-area-resize" onPointerDown={e => { e.preventDefault(); e.stopPropagation(); refs.current.action = { t: "sRes", sx: e.clientX, sy: e.clientY, ow: resPos.w, oh: resPos.h }; }} />}
      </div>
    );
  };

  return (
    <div className="page" onPointerMove={onDrag} onPointerUp={() => refs.current.action = null} onPointerLeave={() => refs.current.action = null}>
      <header><div className="row" style={{ flex: 1 }}><strong style={{ letterSpacing: "1px" }}>AICalc by Aryan Ranavat</strong></div></header>
      <div className="row top-toolbar">
        <button onClick={submit} disabled={data.solving || !data.dirty}>{data.solving ? "BUSY..." : "CALCULATE"}</button>
        <button onClick={() => { resetCanvas(); setData(d => ({ ...d, dirty: false, results: [] })); setBoxes([]); setUi(u => ({ ...u, mode: "draw" })); }}>CLEAR</button>
        {["erase", "text"].map(m => (
          <button key={m} onClick={() => setUi(u => ({ ...u, mode: u.mode === m ? "draw" : m }))}
            style={ui.mode === m ? { background: "#808080", color: "#fff", boxShadow: "inset 2px 2px #000" } : {}}>
            {m === "erase" ? (ui.mode === "erase" ? "ERASING" : "ERASER") : (ui.mode === "text" ? "TYPING" : "TEXT")}
          </button>
        ))}
        <div className="toolbar-spacer" style={{ flex: 1 }} />
        <span className="toolbar-label">MODEL: {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}</span>
        <span className="toolbar-label">TOKENS: {data.tokens.toLocaleString()}</span>
      </div>

      <div className="canvas-wrap" ref={el => refs.current.wrapper = el}>
        <canvas ref={el => refs.current.cv = el} style={{ touchAction: "none", cursor: ui.mode === "text" ? "text" : "crosshair" }}
          onPointerDown={e => onPt(e, "down")} onPointerMove={e => onPt(e, "move")} onPointerUp={e => onPt(e, "up")} onPointerLeave={e => onPt(e, "up")} onClick={addBox} />

        {boxes.map(b => (
          <div key={b.id} className={`text-box ${focusId === b.id ? "focused" : ""}${ui.mobile ? " text-box-mobile" : ""}`}
            style={ui.mobile ? {} : { left: b.x, top: b.y, width: b.w, height: b.h }} onPointerDown={() => setFocusId(b.id)}>
            <div className="text-box-handle"
              onPointerDown={!ui.mobile ? (e => { e.preventDefault(); e.stopPropagation(); refs.current.action = { t: "mBox", id: b.id, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y }; }) : undefined}>
              <button className="text-box-close" onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); delete boxTexts.current[b.id]; setBoxes(x => x.filter(y => y.id !== b.id)); }}>✕</button>
            </div>
            <div className="text-box-content" contentEditable suppressContentEditableWarning
              onPointerDown={e => e.stopPropagation()}
              onInput={e => { const el = e.target as HTMLDivElement; if (el) boxTexts.current[b.id] = el.innerText || ""; }}
              onBlur={() => syncBoxText(b.id)} />
            <div className="text-box-resize" onPointerDown={!ui.mobile ? (e => { e.preventDefault(); e.stopPropagation(); refs.current.action = { t: "sBox", id: b.id, sx: e.clientX, sy: e.clientY, ow: b.w, oh: b.h }; }) : undefined} />
          </div>
        ))}

        <div className={`controls-backdrop${ui.tools ? " visible" : ""}`} onClick={() => setUi(u => ({ ...u, tools: false }))} />

        <div className={`controls${ui.tools ? " mobile-open" : ""}`}>
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={ui.sub} onChange={e => setUi(u => ({ ...u, sub: e.target.value }))}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="control-group">
            <div className="row justify-between"><span className="label">BRUSH SIZE</span><span className="val">{ui.size}</span></div>
            <input type="range" min="1" max="15" value={ui.size} onChange={e => setUi(u => ({ ...u, size: +e.target.value }))} />
          </div>
          <div className="control-group">
            <span className="label">COLORS</span>
            <div className="row wrap">{PEN_COLORS.map(c => <div key={c} className={`swatch ${ui.pen === c ? "active" : ""}`} style={{ background: c }} onClick={() => setUi(u => ({ ...u, pen: c, mode: "draw" }))} />)}</div>
          </div>
          <div className="control-group">
            <label className="checkbox-label"><input type="checkbox" checked={ui.steps} onChange={e => setUi(u => ({ ...u, steps: e.target.checked }))} /> <span>SHOW STEPS</span></label>
          </div>
        </div>

        {ui.mobile && !ui.tools && !data.results.length && <button className="mobile-controls-toggle" onClick={() => setUi(u => ({ ...u, tools: true }))}>⚙</button>}

        {data.results.length > 0 && (
          <Floating title="Results" onClose={() => setData(d => ({ ...d, results: [] }))}>
            {data.results.map((r, i) => (
              <div key={i} className="card">
                <div className="result-line"><InlineMath math={r.expr} /> = <strong><InlineMath math={r.result} /></strong></div>
                {ui.steps && r.steps?.map((s, j) => <div key={j} className="step-detail">{s.explanation}</div>)}
              </div>
            ))}
          </Floating>
        )}

        {data.err && <Floating title="Error" isErr onClose={() => setData(d => ({ ...d, err: null }))}>ERR: {data.err}</Floating>}
      </div>
    </div>
  );
}