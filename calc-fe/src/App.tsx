import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const REALMS = ["math", "physics", "chemistry"];
const INKS = ["#000080", "#000000", "#ff0000", "#008000", "#800080", "#808080"];

type StepBit = {
  explanation: string;
};

type SolveCard = {
  expr: string;
  result: string;
  steps?: StepBit[];
};

type SolveReply = {
  data?: SolveCard[];
  usage?: {
    total_tokens?: number;
  };
};

type StickyInk = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
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
    const sniffPocket = () => setIsMobile(window.innerWidth <= 768);
    sniffPocket();
    window.addEventListener("resize", sniffPocket);
    return () => window.removeEventListener("resize", sniffPocket);
  }, []);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE || "";
    const healthEndpoint = apiBase ? `${apiBase.replace(/\/$/, "")}/healthz` : "/api/healthz";

    const wakeServer = async () => {
      let retries = 0;
      const maxRetries = 5;
      
      const pokeServer = async () => {
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
        } catch {
          console.debug("Backend warmup still waiting");
        }
        
        if (retries < maxRetries) {
          retries++;
          const delay = Math.min(1000 * Math.pow(1.5, retries), 10000);
          setTimeout(pokeServer, delay);
        }
      };
      
      pokeServer();
    };
    
    wakeServer();

    const keepAliveInterval = setInterval(() => {
      fetch(healthEndpoint, { method: "GET" }).catch(() => {});
    }, 14 * 60 * 1000);

    return () => clearInterval(keepAliveInterval);
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
      img.onload = () => {
        inkRef.current?.drawImage(
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
  }, [primePaper]);

  const slingInk = () => {
    const ctx = inkRef.current;
    if (!ctx || !trailRef.current.length || !beforeInkRef.current) return;

    ctx.putImageData(beforeInkRef.current, 0, 0);

    let pts = trailRef.current;
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

    ctx.fillStyle = scrubOn ? "#ffffff" : color;
    ctx.beginPath();
    ctx.moveTo(stroke[0][0], stroke[0][1]);
    stroke.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };

  const catchPen = (e: React.PointerEvent<HTMLCanvasElement>, type: string) => {
    if (typeHat) return;
    const canvas = paperRef.current;
    const ctx = inkRef.current;
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
    if (!typeHat) return;
    const wrap = stageRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = `tb_${Date.now()}`;
    const newBox: StickyInk = { id, x, y, width: 180, height: 60, text: "" };
    setStickies((prev) => [...prev, newBox]);
    setHotStickyId(id);
    setHasInk(true);
  };

  const ditchSticky = (id: string) => {
    setStickies((prev) => prev.filter((tb) => tb.id !== id));
    if (hotStickyId === id) setHotStickyId(null);
  };

  const editSticky = (id: string, text: string) => {
    setStickies((prev) => prev.map((tb) => (tb.id === id ? { ...tb, text } : tb)));
  };

  const moveSticky = (e: React.PointerEvent<HTMLDivElement>) => {
    if (grabRef.current) {
      const d = grabRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      setStickies((prev) =>
        prev.map((tb) => (tb.id === d.id ? { ...tb, x: d.origX + dx, y: d.origY + dy } : tb))
      );
    }
    if (stretchRef.current) {
      const r = stretchRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      setStickies((prev) =>
        prev.map((tb) =>
          tb.id === r.id
            ? { ...tb, width: Math.max(100, r.origW + dx), height: Math.max(40, r.origH + dy) }
            : tb
        )
      );
    }
  };

  const dropSticky = () => {
    grabRef.current = null;
    stretchRef.current = null;
  };

  const stampStickies = () => {
    const canvas = paperRef.current;
    const ctx = inkRef.current;
    const wrap = stageRef.current;
    if (!canvas || !ctx || !wrap) return;

    const dpr = window.devicePixelRatio || 1;

    stickies.forEach((tb) => {
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

  const crunch = async () => {
    const canvas = paperRef.current;
    if (!canvas) return;

    setLoading(true);
    setError(null);

    const ctx = inkRef.current;
    let preSnapshot: ImageData | null = null;
    if (ctx && stickies.length > 0) {
      preSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      stampStickies();
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
            include_steps: stepPeek,
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

        const data = (await resp.json()) as SolveReply;
        setResults(data.data || []);

        const usedTokens = data.usage?.total_tokens || 0;
        if (usedTokens > 0) {
          setTokenPile((currentTotal) => {
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
        <button onClick={crunch} disabled={loading || !hasInk}>
          {loading ? "BUSY..." : "CALCULATE"}
        </button>
        <button
          onClick={() => {
            primePaper();
            setHasInk(false);
            setResults([]);
            setScrubOn(false);
            setTypeHat(false);
            setStickies([]);
            setHotStickyId(null);
          }}
        >
          CLEAR
        </button>
        <button
          onClick={() => { setScrubOn(!scrubOn); setTypeHat(false); }}
          style={{
            background: scrubOn ? "#808080" : "#c0c0c0",
            color: scrubOn ? "#fff" : "#000",
            boxShadow: scrubOn ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)",
          }}
        >
          {scrubOn ? "ERASING" : "ERASER"}
        </button>
        <button
          onClick={() => { setTypeHat(!typeHat); setScrubOn(false); }}
          style={{
            background: typeHat ? "#808080" : "#c0c0c0",
            color: typeHat ? "#fff" : "#000",
            boxShadow: typeHat ? "inset 2px 2px #000" : "1px 1px 0 0 var(--border-black)",
          }}
        >
          {typeHat ? "TYPING" : "TEXT"}
        </button>
        <div className="toolbar-spacer" style={{ flex: 1 }} />
        <span className="toolbar-label">MODEL: {import.meta.env.VITE_MODEL_NAME || "GEMINI 2.5 FLASH"}</span>
        <span className="toolbar-label">TOKENS: {tokenPile.toLocaleString()}</span>
      </div>

      <div
        className="canvas-wrap"
        ref={stageRef}
        onPointerMove={moveSticky}
        onPointerUp={dropSticky}
        onPointerLeave={dropSticky}
      >
        <canvas
          ref={paperRef}
          style={{ touchAction: "none", cursor: typeHat ? "text" : "crosshair" }}
          onPointerDown={(e) => catchPen(e, "down")}
          onPointerMove={(e) => catchPen(e, "move")}
          onPointerUp={(e) => catchPen(e, "up")}
          onPointerLeave={(e) => catchPen(e, "up")}
          onClick={plantSticky}
        />

        {stickies.map((tb) => (
          <div
            key={tb.id}
            className={`text-box${hotStickyId === tb.id ? " focused" : ""}`}
            style={{ left: tb.x, top: tb.y, width: tb.width, height: tb.height }}
            onPointerDown={() => setHotStickyId(tb.id)}
          >
            <div
              className="text-box-handle"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                grabRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y };
              }}
            >
              <button
                className="text-box-close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); ditchSticky(tb.id); }}
              >
                ✕
              </button>
            </div>
            <div
              className="text-box-content"
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => editSticky(tb.id, (e.target as HTMLDivElement).innerText)}
              onPointerDown={(e) => e.stopPropagation()}
            />
            <div
              className="text-box-resize"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                stretchRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origW: tb.width, origH: tb.height };
              }}
            />
          </div>
        ))}

        <div
          className={`controls-backdrop${toolTrayOpen ? " visible" : ""}`}
          onClick={() => setToolTrayOpen(false)}
        />

        <div className={`controls${toolTrayOpen ? " mobile-open" : ""}`}>
          <div className="control-group">
            <span className="label">SUBJECT</span>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              {REALMS.map((s) => (
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
              {INKS.map((s) => (
                <div
                  key={s}
                  className={`swatch ${color === s ? "active" : ""}`}
                  style={{ background: s }}
                  onClick={() => {
                    setColor(s);
                    setScrubOn(false);
                  }}
                />
              ))}
            </div>
          </div>

          <div className="control-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={stepPeek} onChange={(e) => setStepPeek(e.target.checked)} />
              <span>SHOW STEPS</span>
            </label>
          </div>
        </div>

        {isMobile && !toolTrayOpen && results.length === 0 && (
          <button
            className="mobile-controls-toggle"
            onClick={() => setToolTrayOpen(true)}
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
                {stepPeek &&
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
