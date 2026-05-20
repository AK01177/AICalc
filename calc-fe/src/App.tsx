import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const SUBJECTS = ["math", "physics", "chemistry"];
const SWATCHES = ["#000080", "#000000", "#ff0000", "#008000", "#800080", "#808080"];

type CalculationStep = {
  explanation: string;
};

type CalculationResult = {
  expr: string;
  result: string;
  steps?: CalculationStep[];
};

type CalculateResponse = {
  data?: CalculationResult[];
  usage?: {
    total_tokens?: number;
  };
};

type TextBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

export default function App() {
  const [color, setColor] = useState(SWATCHES[0]);
  const [brush, setBrush] = useState(3);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [isTextMode, setIsTextMode] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [activeTextBoxId, setActiveTextBoxId] = useState<string | null>(null);

  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pointsRef = useRef<number[][]>([]);
  const drawingRef = useRef(false);
  const snapshotRef = useRef<ImageData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aicalc_total_tokens");
    if (saved) setTotalTokens(Number(saved));
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE || "";
    const healthEndpoint = apiBase ? `${apiBase.replace(/\/$/, "")}/healthz` : "/api/healthz";

    const warmupBackend = async () => {
      let retries = 0;
      const maxRetries = 5;
      
      const attemptWarmup = async () => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(healthEndpoint, {
            method: "GET",
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log("Backend is ready");
            return true;
          }
        } catch (e) {
        }
        
        if (retries < maxRetries) {
          retries++;
          const delay = Math.min(1000 * Math.pow(1.5, retries), 10000);
          setTimeout(attemptWarmup, delay);
        }
      };
      
      attemptWarmup();
    };
    
    warmupBackend();

    const keepAliveInterval = setInterval(() => {
      fetch(healthEndpoint, { method: "GET" }).catch(() => {});
    }, 14 * 60 * 1000);

    return () => clearInterval(keepAliveInterval);
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
    ctx.fillStyle = "#ffffff";
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
      img.onload = () => {
        ctxRef.current?.drawImage(
          img,
          0,
          0,
          canvas.width / (window.devicePixelRatio || 1),
          canvas.height / (window.devicePixelRatio || 1),
        );
      };
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
        const m1 = [p1[0] * 0.75 + p2[0] * 0.25, p1[1] * 0.75 + p2[1] * 0.25, p1[2]];
        const m2 = [p1[0] * 0.25 + p2[0] * 0.75, p1[1] * 0.25 + p2[1] * 0.75, p2[2]];
        smoothed.push(m1, m2);
      }
      smoothed.push(pts[pts.length - 1]);
      pts = smoothed;
    }

    const stroke = getStroke(pts, {
      size: brush * 2,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    });

    if (!stroke.length) return;

    ctx.fillStyle = isEraser ? "#ffffff" : color;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    stroke.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>, type: string) => {
    if (isTextMode) return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const p = [e.clientX - rect.left, e.clientY - rect.top, e.pressure || 0.5];

    if (type === "down") {
      drawingRef.current = true;
      pointsRef.current = [p];
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHasContent(true);
    } else if (type === "move" && drawingRef.current) {
      pointsRef.current.push(p);
      draw();
    } else if (type === "up") {
      drawingRef.current = false;
      pointsRef.current = [];
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isTextMode) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = `tb_${Date.now()}`;
    const newBox: TextBox = { id, x, y, width: 180, height: 60, text: "" };
    setTextBoxes((prev) => [...prev, newBox]);
    setActiveTextBoxId(id);
    setHasContent(true);
  };

  const deleteTextBox = (id: string) => {
    setTextBoxes((prev) => prev.filter((tb) => tb.id !== id));
    if (activeTextBoxId === id) setActiveTextBoxId(null);
  };

  const updateTextBoxText = (id: string, text: string) => {
    setTextBoxes((prev) => prev.map((tb) => (tb.id === id ? { ...tb, text } : tb)));
  };

  const onWrapPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setTextBoxes((prev) =>
        prev.map((tb) => (tb.id === d.id ? { ...tb, x: d.origX + dx, y: d.origY + dy } : tb))
      );
    }
    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      setTextBoxes((prev) =>
        prev.map((tb) =>
          tb.id === r.id
            ? { ...tb, width: Math.max(100, r.origW + dx), height: Math.max(40, r.origH + dy) }
            : tb
        )
      );
    }
  };

  const onWrapPointerUp = () => {
    dragRef.current = null;
    resizeRef.current = null;
  };

  const bakeTextBoxes = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const wrap = canvasWrapRef.current;
    if (!canvas || !ctx || !wrap) return;

    const dpr = window.devicePixelRatio || 1;

    textBoxes.forEach((tb) => {
      if (!tb.text.trim()) return;
      const fontSize = 14;
      ctx.save();
      ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
      ctx.fillStyle = "#000";
      ctx.textBaseline = "top";

      const textX = tb.x * dpr / dpr;
      const textY = (tb.y + 20) * dpr / dpr;
      const maxWidth = tb.width - 12;

      const words = tb.text.split(/\s+/);
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        const test = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = test;
        }
      }
      if (currentLine) lines.push(currentLine);

      lines.forEach((line, idx) => {
        ctx.fillText(line, textX + 6, textY + 4 + idx * (fontSize + 2));
      });
      ctx.restore();
    });
  };

  const solve = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    const ctx = ctxRef.current;
    let preSnapshot: ImageData | null = null;
    if (ctx && textBoxes.length > 0) {
      preSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      bakeTextBoxes();
    }

    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const maxDim = 768;
        const offscreen = document.createElement("canvas");
        const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
        offscreen.width = canvas.width * scale;
        offscreen.height = canvas.height * scale;

        const oCtx = offscreen.getContext("2d");
        if (oCtx) oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);

        const apiBase = import.meta.env.VITE_API_BASE || "";
        const endpoint = apiBase ? `${apiBase.replace(/\/$/, "")}/calculate` : "/api/calculate";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: offscreen.toDataURL("image/png"),
            subject,
            dict_of_vars: {},
            include_steps: showSteps,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!resp.ok) {
          const errorText = await resp.text();
          throw new Error(`Server Error (${resp.status}): ${errorText.slice(0, 100)}`);
        }

        const contentType = resp.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await resp.text();
          throw new Error(`Unexpected response format: ${text.slice(0, 100)}`);
        }

        const data = (await resp.json()) as CalculateResponse;
        setResults(data.data || []);

        const usedTokens = data.usage?.total_tokens || 0;
        if (usedTokens > 0) {
          setTotalTokens((currentTotal) => {
            const nextTotal = currentTotal + usedTokens;
            localStorage.setItem("aicalc_total_tokens", String(nextTotal));
            return nextTotal;
          });
        }
        
        if (preSnapshot && ctx) ctx.putImageData(preSnapshot, 0, 0);
        setLoading(false);
        return;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e : new Error("Unknown error");
        
        if (!(lastError.message.includes("Server Error") && lastError.message.includes("(4") || lastError.message.includes("(5")) && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        break;
      }
    }

    if (preSnapshot && ctx) ctx.putImageData(preSnapshot, 0, 0);

    const errorMsg = lastError?.message || "Something went wrong";
    const fullErrorMsg = errorMsg.includes("Server Error") 
      ? errorMsg 
      : "Backend is starting up. Please try again in a few seconds.";
    
    setError(fullErrorMsg);
    setLoading(false);
  };

  return (
    <div className="page">
      <header>
        <div className="row" style={{ flex: 1 }}>
          <strong style={{ letterSpacing: "1px" }}>AICalc by Aryan Ranavat</strong>
        </div>
      </header>

      <div className="row top-toolbar" style={{ background: "#c0c0c0", padding: "2px 6px", borderBottom: "1px solid #808080" }}>
        <button onClick={solve} disabled={loading || !hasContent}>
          {loading ? "BUSY..." : "CALCULATE"}
        </button>
        <button
          onClick={() => {
            initCanvas();
            setHasContent(false);
            setResults([]);
            setIsEraser(false);
            setIsTextMode(false);
            setTextBoxes([]);
            setActiveTextBoxId(null);
          }}
        >
          CLEAR
        </button>
        <button
          onClick={() => { setIsEraser(!isEraser); setIsTextMode(false); }}
          style={{
            background: isEraser ? "#808080" : "#c0c0c0",
            color: isEraser ? "#fff" : "#000",
            boxShadow: isEraser ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)",
          }}
        >
          {isEraser ? "ERASING" : "ERASER"}
        </button>
        <button
          onClick={() => { setIsTextMode(!isTextMode); setIsEraser(false); }}
          style={{
            background: isTextMode ? "#808080" : "#c0c0c0",
            color: isTextMode ? "#fff" : "#000",
            boxShadow: isTextMode ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)",
          }}
        >
          {isTextMode ? "TYPING" : "TEXT"}
        </button>
        <div className="toolbar-spacer" style={{ flex: 1 }} />
        <span className="toolbar-label">MODEL: {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}</span>
        <span className="toolbar-label">TOKENS: {totalTokens.toLocaleString()}</span>
      </div>

      <div
        className="canvas-wrap"
        ref={canvasWrapRef}
        onPointerMove={onWrapPointerMove}
        onPointerUp={onWrapPointerUp}
        onPointerLeave={onWrapPointerUp}
      >
        <canvas
          ref={canvasRef}
          style={{ touchAction: "none", cursor: isTextMode ? "text" : "crosshair" }}
          onPointerDown={(e) => onPointer(e, "down")}
          onPointerMove={(e) => onPointer(e, "move")}
          onPointerUp={(e) => onPointer(e, "up")}
          onPointerLeave={(e) => onPointer(e, "up")}
          onClick={handleCanvasClick}
        />

        {textBoxes.map((tb) => (
          <div
            key={tb.id}
            className={`text-box${activeTextBoxId === tb.id ? " focused" : ""}`}
            style={{ left: tb.x, top: tb.y, width: tb.width, height: tb.height }}
            onPointerDown={() => setActiveTextBoxId(tb.id)}
          >
            <div
              className="text-box-handle"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dragRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y };
              }}
            >
              <button
                className="text-box-close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); deleteTextBox(tb.id); }}
              >
                ✕
              </button>
            </div>
            <div
              className="text-box-content"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => updateTextBoxText(tb.id, (e.target as HTMLDivElement).innerText)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div
              className="text-box-resize"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                resizeRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origW: tb.width, origH: tb.height };
              }}
            />
          </div>
        ))}

        <div
          className={`controls-backdrop${mobileControlsOpen ? " visible" : ""}`}
          onClick={() => setMobileControlsOpen(false)}
        />

        <div className={`controls${mobileControlsOpen ? " mobile-open" : ""}`}>
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <div className="row justify-between">
              <span className="label">BRUSH SIZE</span>
              <span className="val">{brush}</span>
            </div>
            <input type="range" min="1" max="15" value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
          </div>

          <div className="control-group">
            <span className="label">COLORS</span>
            <div className="row wrap">
              {SWATCHES.map((s) => (
                <div
                  key={s}
                  className={`swatch ${color === s ? "active" : ""}`}
                  style={{ background: s }}
                  onClick={() => {
                    setColor(s);
                    setIsEraser(false);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} />
              <span>SHOW STEPS</span>
            </label>
          </div>
        </div>

        {isMobile && !mobileControlsOpen && results.length === 0 && (
          <button
            className="mobile-controls-toggle"
            onClick={() => setMobileControlsOpen(true)}
            aria-label="Open drawing tools"
          >
            ⚙
          </button>
        )}

        {results.length > 0 && (
          <div className="results-area">
            <button
              className="results-close-btn"
              onClick={() => setResults([])}
              style={{
                float: "right",
                background: "var(--panel)",
                border: "2px solid var(--border-light)",
                borderRightColor: "var(--border-dark)",
                borderBottomColor: "var(--border-dark)",
                padding: "2px 8px",
                fontFamily: "inherit",
                fontSize: "11px",
                cursor: "pointer",
                marginBottom: "4px",
              }}
            >
              ✕ CLOSE
            </button>
            {results.map((r, i) => (
              <div key={i} className="card">
                <div className="result-line">
                  <InlineMath math={r.expr} /> ={" "}
                  <strong>
                    <InlineMath math={r.result} />
                  </strong>
                </div>
                {showSteps &&
                  r.steps?.map((s, j) => (
                    <div
                      key={j}
                      style={{
                        fontSize: "11px",
                        marginTop: "6px",
                        color: "#333",
                        background: "#f9f9f9",
                        padding: "4px",
                        borderLeft: "2px solid #000080",
                      }}
                    >
                      {s.explanation}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="results-area" style={{ color: "#f00", border: "1px solid #f00" }}>
            ERR: {error}
          </div>
        )}
      </div>
    </div>
  );
}
