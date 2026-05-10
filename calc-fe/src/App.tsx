import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

const SUBJECTS = ["math", "physics", "chemistry"];
const SWATCHES = ["#000000", "#000080", "#800000", "#008000", "#808000", "#808080"];

export default function App() {
  const [color, setColor] = useState(SWATCHES[0]);
  const [brush, setBrush] = useState(3);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [usage, setUsage] = useState({ total: 0, last: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef = useRef<number[][]>([]);
  const drawingRef = useRef(false);
  const snapshotRef = useRef<ImageData | null>(null);
  const [hasContent, setHasContent] = useState(false);

  // Initialize usage from local storage
  useEffect(() => {
    const saved = localStorage.getItem("aicalc_usage");
    if (saved) setUsage(prev => ({ ...prev, total: parseInt(saved) }));
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    initCanvas();
    const obs = new ResizeObserver(() => {
      const temp = canvas.toDataURL();
      initCanvas();
      const img = new Image();
      img.onload = () => ctxRef.current?.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      img.src = temp;
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [initCanvas]);

  const draw = () => {
    const ctx = ctxRef.current;
    if (!ctx || !pointsRef.current.length || !snapshotRef.current) return;
    ctx.putImageData(snapshotRef.current, 0, 0);

    let pts = pointsRef.current;
    if (pts.length > 3) {
      const smoothed = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const m1 = [(p1[0] * 0.75 + p2[0] * 0.25), (p1[1] * 0.75 + p2[1] * 0.25), p1[2]];
        const m2 = [(p1[0] * 0.25 + p2[0] * 0.75), (p1[1] * 0.25 + p2[1] * 0.75), p2[2]];
        smoothed.push(m1, m2);
      }
      smoothed.push(pts[pts.length - 1]);
      pts = smoothed;
    }

    const stroke = getStroke(pts, {
      size: brush * 2,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5
    });
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    stroke.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };

  const onPointer = (e: any, type: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const p = [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];
    if (type === "down") {
      drawingRef.current = true;
      pointsRef.current = [p];
      snapshotRef.current = ctxRef.current!.getImageData(0, 0, canvas.width, canvas.height);
      setHasContent(true);
    } else if (type === "move" && drawingRef.current) {
      pointsRef.current.push(p);
      draw();
    } else if (type === "up") {
      drawingRef.current = false;
      pointsRef.current = [];
    }
  };

  const solve = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    setError(null);
    try {
      // Downscale for API token optimization (max 768px)
      const maxDim = 768;
      const offscreen = document.createElement("canvas");
      const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
      offscreen.width = canvas.width * scale;
      offscreen.height = canvas.height * scale;
      const oCtx = offscreen.getContext("2d");
      if (oCtx) oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);

      const apiBase = import.meta.env.VITE_API_BASE || "";
      const endpoint = apiBase
        ? `${apiBase.replace(/\/$/, "")}/calculate`
        : "/api/calculate";

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: offscreen.toDataURL("image/png"),
          subject,
          dict_of_vars: {},
          include_steps: showSteps
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Server Error (${resp.status}): ${errorText.slice(0, 100)}`);
      }

      const contentType = resp.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await resp.text();
        throw new Error(`Unexpected response format: ${text.slice(0, 100)}`);
      }

      const data = await resp.json();
      setResults(data.data || []);

      if (data.usage) {
        const newTotal = usage.total + data.usage.total_tokens;
        setUsage({ total: newTotal, last: data.usage.total_tokens });
        localStorage.setItem("aicalc_usage", newTotal.toString());
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header>
        <div className="row" style={{ flex: 1 }}>
          <div style={{ marginRight: '6px' }}>🧮</div>
          <strong style={{ letterSpacing: '1px' }}>AI Calculator by Aryan Ranavat</strong>
        </div>
        <div className="row usage-info" style={{ fontSize: '11px', color: '#dfdfdf' }}>
          <span>TOKENS: {usage.total.toLocaleString()}</span>
        </div>
      </header>
      <div className="row" style={{ background: '#c0c0c0', padding: '2px 6px', borderBottom: '1px solid #808080' }}>
        <button onClick={solve} disabled={loading || !hasContent}>{loading ? "BUSY..." : "CALCULATE"}</button>
        <button onClick={() => {
          initCanvas();
          setHasContent(false);
          setResults([]);
        }}>CLEAR</button>
        <div style={{ flex: 1 }} />
        <div className="flex items-center gap-2 px-2 py-0.5 bg-white border-2 border-gray-400 inset-shadow">
          <span className="text-[10px] font-bold text-gray-600">
            {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}
          </span>
        </div>
      </div>

      <div className="canvas-wrap">
        <canvas ref={canvasRef}
          style={{ touchAction: "none" }}
          onPointerDown={e => onPointer(e, "down")}
          onPointerMove={e => onPointer(e, "move")}
          onPointerUp={e => onPointer(e, "up")}
          onPointerLeave={e => onPointer(e, "up")}
        />

        <div className="controls">
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              {SUBJECTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
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
              {SWATCHES.map(s => (
                <div key={s}
                  className={`swatch ${color === s ? "active" : ""}`}
                  style={{ background: s }}
                  onClick={() => setColor(s)}
                />
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

        {results.length > 0 && (
          <div className="results-area">
            {results.map((r, i) => (
              <div key={i} className="card">
                <div>
                  <InlineMath math={r.expr} /> = <strong><InlineMath math={r.result} /></strong>
                </div>
                {showSteps && r.steps?.map((s: any, j: number) => (
                  <div key={j} style={{ fontSize: '11px', marginTop: '6px', color: '#333', background: '#f9f9f9', padding: '4px', borderLeft: '2px solid #000080' }}>
                    <InlineMath math={s.explanation} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {error && <div className="results-area" style={{ color: '#f00', border: '1px solid #f00' }}>ERR: {error}</div>}
      </div>
    </div>
  );
}
