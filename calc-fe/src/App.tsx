import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";

const SUBJECTS = ["math", "physics", "chemistry"];
const SWATCHES = ["#ffffff", "#888888"];

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
    ctx.fillStyle = "#000";
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

      const resp = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: offscreen.toDataURL("image/png"),
          subject,
          dict_of_vars: {},
          include_steps: showSteps
        })
      });
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
        <div className="column">
          <div className="row">
            <strong>AICALC_v1.0</strong>
            <span>[S]: {subject.toUpperCase()}</span>
          </div>
          <div className="row usage-info">
            <span>TOKENS: {usage.total.toLocaleString()} / 500K</span>
            <span style={{ opacity: 0.5 }}> (+{usage.last})</span>
          </div>
        </div>
        <div className="row">
          <button onClick={solve} disabled={loading || !hasContent}>{loading ? "WORKING" : "RUN"}</button>
          <button onClick={() => {
            initCanvas();
            setHasContent(false);
            setResults([]);
          }}>CLR</button>
        </div>
      </header>

      <div className="canvas-wrap">
        <canvas ref={canvasRef}
          onPointerDown={e => onPointer(e, "down")}
          onPointerMove={e => onPointer(e, "move")}
          onPointerUp={e => onPointer(e, "up")}
          onPointerLeave={e => onPointer(e, "up")}
        />

        <div className="controls">
          <select value={subject} onChange={e => setSubject(e.target.value)}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <div className="row">
            {SWATCHES.map(s => (
              <div key={s} className={`swatch ${color === s ? "active" : ""}`} style={{ background: s }} onClick={() => setColor(s)} />
            ))}
          </div>
          <input type="range" min="1" max="10" value={brush} onChange={e => setBrush(Number(e.target.value))} />
          <label style={{ fontSize: '10px' }}>
            <input type="checkbox" checked={showSteps} onChange={e => setShowSteps(e.target.checked)} /> STEPS
          </label>
        </div>

        {results.length > 0 && (
          <div className="results-area">
            {results.map((r, i) => (
              <div key={i} className="card">
                <div>{r.expr} = <strong>{r.result}</strong></div>
                {showSteps && r.steps?.map((s: any, j: number) => (
                  <div key={j} style={{ fontSize: '9px', marginTop: '5px', color: '#aaa' }}>
                    &gt; {s.explanation}
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
