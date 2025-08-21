import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Calculator,
  RefreshCw,
  Loader2,
  AlertCircle,
  Download,
  Save,
  History,
  Settings,
  Zap,
  Brain,
  LineChart
} from 'lucide-react';

// --- TYPE DEFINITIONS ---
interface Step {
  latex: string;
  explanation: string;
}

interface Result {
  expr: string;
  result: string | number;
  assign: boolean;
  steps: Step[];
}

interface PlotData {
  x: number[];
  y: number[];
  latex?: string;
}

interface HistoryEntry {
  timestamp: Date;
  results: Result[];
  subject: string;
  variables: Record<string, string | number>;
}

interface CalculatorState {
  color: string;
  colorTheme: keyof typeof COLOR_THEMES;
  dictOfVars: Record<string, string | number>;
  results: Result[];
  history: HistoryEntry[];
  loading: boolean;
  error: string | null;
  subject: string;
  varInput: string;
  isFullscreen: boolean;
  showSettings: boolean;
  showHistory: boolean;
  brushSize: number;
  smoothing: boolean;
  autoSave: boolean;
  // Plot state
  plotExpr: string;
  plotData: PlotData | null;
  plotLoading: boolean;
  plotError: string | null;
  plotXMin: number;
  plotXMax: number;
  plotPoints: number;
}

interface DrawingState {
  isDrawing: boolean;
  lastPoint: { x: number; y: number } | null;
  paths: any[];
  undoStack: string[];
  redoStack: string[];
}

const COLOR_THEMES: Record<string, string[]> = {
  neon: ['#ff0080', '#00ff80', '#0080ff', '#ff8000', '#8000ff', '#ff0040'],
  pastel: ['#ffb3e6', '#b3ffe6', '#b3d9ff', '#ffe6b3', '#e6b3ff', '#ffccb3'],
  dark: ['#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
  rainbow: ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0000ff', '#8000ff']
};

const SUBJECTS = [
  { value: 'math', label: '🧮 Mathematics' },
  { value: 'physics', label: '⚛️ Physics' },
  { value: 'chemistry', label: '🧪 Chemistry' },
  { value: 'calculus', label: '📊 Calculus' },
  { value: 'algebra', label: '🔢 Algebra' },
  { value: 'geometry', label: '📐 Geometry' }
];

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    
    checkDevice();
    const debouncedResize = debounce(checkDevice, 100);
    
    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, []);

  return isMobile;
};

const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
  let timeout: ReturnType<typeof setTimeout>;
  return function executedFunction(...args: Parameters<F>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const throttle = <F extends (...args: any[]) => any>(func: F, limit: number) => {
  let inThrottle: boolean;
  return function(this: ThisParameterType<F>, ...args: Parameters<F>) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export default function EnhancedAICalculator() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isMobile = useMobileDetection();
  const activePointerTypeRef = useRef<'mouse' | 'touch' | 'pen' | null>(null);
  
  const [state, setState] = useState<CalculatorState>({
    color: '#00ff80',
    colorTheme: 'neon',
    dictOfVars: {},
    results: [],
    history: [],
    loading: false,
    error: null,
    subject: 'math',
    varInput: '',
    isFullscreen: false,
    showSettings: false,
    showHistory: false,
    brushSize: isMobile ? 4 : 3,
    smoothing: !isMobile,
    autoSave: true,
    plotExpr: 'x^2',
    plotData: null,
    plotLoading: false,
    plotError: null,
    plotXMin: -10,
    plotXMax: 10,
    plotPoints: 500
  });

  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    lastPoint: null,
    paths: [],
    undoStack: [],
    redoStack: []
  });

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    });
    
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    updateCanvasStyle(ctx);
    ctxRef.current = ctx;
  }, []);

  const updateCanvasStyle = useCallback((ctx = ctxRef.current) => {
    if (!ctx) return;
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.brushSize;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = !!state.smoothing;
    ctx.imageSmoothingQuality = state.smoothing ? 'high' : 'low';
  }, [state.color, state.brushSize, state.smoothing]);

  const drawSmooth = useCallback(throttle((x: number, y: number, pressure = 1) => {
    const ctx = ctxRef.current;
    if (!ctx || !drawingState.isDrawing) return;

    const { lastPoint } = drawingState;
    
    if (!lastPoint) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setDrawingState(prev => ({ ...prev, lastPoint: { x, y } }));
      return;
    }

    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.min(distance / 10, 1);
    const dynamicSize = state.brushSize * (0.5 + 0.5 * (1 - speed)) * pressure;

    ctx.lineWidth = dynamicSize;
    
    const midX = (lastPoint.x + x) / 2;
    const midY = (lastPoint.y + y) / 2;
    
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    ctx.stroke();

    setDrawingState(prev => ({ ...prev, lastPoint: { x, y } }));
  }, 16), [state.brushSize, drawingState.isDrawing, drawingState.lastPoint]);

  const drawRaw = useCallback(throttle((x: number, y: number) => {
    const ctx = ctxRef.current;
    if (!ctx || !drawingState.isDrawing) return;

    const { lastPoint } = drawingState;

    if (!lastPoint) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setDrawingState(prev => ({ ...prev, lastPoint: { x, y } }));
      return;
    }

    ctx.lineWidth = state.brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();

    setDrawingState(prev => ({ ...prev, lastPoint: { x, y } }));
  }, 0), [state.brushSize, drawingState.isDrawing, drawingState.lastPoint]);

  // FINAL FIX: Use the native 'PointerEvent' type for the event parameter 'e'.
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Use React pointer event, keep behavior identical to previous native handler
    e.preventDefault();
    activePointerTypeRef.current = (e.nativeEvent as PointerEvent).pointerType as 'mouse' | 'touch' | 'pen';
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDrawingState(prev => ({ 
      ...prev, 
      isDrawing: true, 
      lastPoint: { x, y },
      redoStack: []
    }));

    const canvas = canvasRef.current;
    try { canvas?.setPointerCapture(e.pointerId); } catch {}

    const ctx = ctxRef.current;
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!drawingState.isDrawing) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = (e.nativeEvent as PointerEvent).pressure || 1;

    const pointerType = activePointerTypeRef.current;
    if (pointerType === 'mouse') {
      drawSmooth(x, y, pressure);
    } else {
      // For touch and pen, draw raw lines without additional smoothing/curves
      drawRaw(x, y);
    }
  }, [drawingState.isDrawing, drawSmooth, drawRaw]);

  const handlePointerUp = useCallback((e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing) return;
    
    setDrawingState(prev => ({ 
      ...prev, 
      isDrawing: false, 
      lastPoint: null 
    }));

    const canvas = canvasRef.current;
    try { if (e && canvas) canvas.releasePointerCapture(e.pointerId); } catch {}

    if (canvas && state.autoSave) {
      const imageData = canvas.toDataURL();
      setDrawingState(prev => ({
        ...prev,
        undoStack: [...prev.undoStack.slice(-9), imageData]
      }));
    }
  }, [drawingState.isDrawing, state.autoSave]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, rect.width, rect.height);
    updateCanvasStyle();
  }, [updateCanvasStyle]);

  const undoLastAction = useCallback(() => {
    const { undoStack } = drawingState;
    if (undoStack.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const lastState = undoStack[undoStack.length - 1];
    const currentState = canvas.toDataURL();
    
    const img = new Image();
    img.onload = () => {
      clearCanvas();
      ctx.drawImage(img, 0, 0);
    };
    img.src = lastState;

    setDrawingState(prev => ({
      ...prev,
      undoStack: prev.undoStack.slice(0, -1),
      redoStack: [currentState, ...prev.redoStack.slice(0, 9)]
    }));
  }, [drawingState.undoStack, clearCanvas]);

  const submitDrawing = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Build endpoint: use Vite env VITE_API_BASE if provided, else dev proxy
      const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
      const apiBase = (envBase ? String(envBase) : '').replace(/\/$/, '');
      const primaryEndpoint = apiBase ? `${apiBase}/calculate` : '/api/calculate';
      const fallbackEndpoints = [primaryEndpoint, 'https://aicalc-nvif.onrender.com/calculate'];

      // Prepare JSON payload with base64 image and metadata
      const dataUrl = canvas.toDataURL('image/png');
      const payload = {
        image: dataUrl,
        dict_of_vars: state.dictOfVars,
        subject: state.subject
      };

      let json: any = null;
      let lastError: unknown = null;
      for (const ep of fallbackEndpoints) {
        try {
          console.info('Submitting to endpoint:', ep);
          const resp = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) {
            let serverMsg = '';
            try {
              const text = await resp.text();
              serverMsg = text?.slice(0, 200);
              console.warn('Server error body snippet:', serverMsg);
            } catch {}
            throw new Error(`Request failed (${resp.status} ${resp.statusText}) ${serverMsg ? '- ' + serverMsg : ''}`);
          }
          json = await resp.json();
          break;
        } catch (err) {
          lastError = err;
          console.warn('Endpoint failed, trying next if available:', ep, err);
        }
      }

      if (!json) {
        throw lastError || new Error('All endpoints failed');
      }
      const resultsFromServer: Result[] | null = Array.isArray(json)
        ? (json as Result[])
        : (Array.isArray(json?.data)
            ? (json.data as Result[])
            : (Array.isArray(json?.results) ? (json.results as Result[]) : null));

      if (!resultsFromServer) {
        throw new Error('Invalid response from server');
      }

      setState(prev => ({
        ...prev,
        results: resultsFromServer,
        history: [
          {
            timestamp: new Date(),
            results: resultsFromServer,
            subject: prev.subject,
            variables: prev.dictOfVars
          },
          ...prev.history.slice(0, 19)
        ],
        loading: false
      }));

    } catch (error) {
      console.warn('Failed to process calculation:', error);
      try {
        // Quick health check to help diagnose connectivity vs. payload issues
        const health = await fetch('/api/');
        console.info('Backend health check status:', health.status);
      } catch (e) {
        console.warn('Backend health check failed:', e);
      }
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to process calculation. Please check your backend and try again.',
        loading: false 
      }));
    }
  }, [state.dictOfVars, state.subject]);

  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `calculation-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  const handleReset = useCallback(() => {
    clearCanvas();
    setState(prev => ({ 
      ...prev, 
      results: [], 
      error: null, 
      dictOfVars: {}, 
      varInput: '' 
    }));
    setDrawingState(prev => ({ 
      ...prev, 
      undoStack: [], 
      redoStack: [], 
      paths: [] 
    }));
  }, [clearCanvas]);

  const switchTheme = useCallback((theme: keyof typeof COLOR_THEMES) => {
    setState(prev => ({ 
      ...prev, 
      colorTheme: theme,
      color: COLOR_THEMES[theme][0]
    }));
  }, []);

  
  const sanitizeExpression = useCallback((raw: string): string | null => {
    if (!raw) return null;
    let expr = raw.trim();
    expr = expr.replace(/^y\s*=\s*/i, '');
    expr = expr.replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '');
    expr = expr.replace(/\^/g, '**');
    // Map common functions to Math.
    const fnMap: Record<string, string> = {
      sin: 'Math.sin', cos: 'Math.cos', tan: 'Math.tan',
      asin: 'Math.asin', acos: 'Math.acos', atan: 'Math.atan',
      sqrt: 'Math.sqrt', abs: 'Math.abs', exp: 'Math.exp', log: 'Math.log', ln: 'Math.log',
      floor: 'Math.floor', ceil: 'Math.ceil', round: 'Math.round', pow: 'Math.pow',
      min: 'Math.min', max: 'Math.max'
    };
    expr = expr.replace(/([a-zA-Z]+)\s*\(/g, (m, p1) => (fnMap[p1] ? fnMap[p1] : p1) + '(');
    // Allow only safe characters
    const safe = /^[0-9xX+\-*/().,\s**Mathminaxcoelgrdptw]+$/;
    if (!safe.test(expr)) return null;
    // Normalize variable to lowercase x
    expr = expr.replace(/X/g, 'x');
    return expr;
  }, []);

  const tryBuildFunction = useCallback((expr: string): ((x: number) => number) | null => {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `return (${expr});`) as (x: number) => number;
      // quick sanity check
      // may throw; ignore
      void fn(0);
      return fn;
    } catch {
      return null;
    }
  }, []);

  const plotGraph = useCallback((expr: string) => {
    const canvas = graphCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    // Clear
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, height);

    const fnExpr = sanitizeExpression(expr);
    if (!fnExpr) {
      setGraphState(prev => ({ ...prev, error: 'Invalid expression' }));
      return;
    }
    const fn = tryBuildFunction(fnExpr);
    if (!fn) {
      setGraphState(prev => ({ ...prev, error: 'Could not parse function' }));
      return;
    }

    // Sample domain
    const xMin = -10, xMax = 10, samples = 600;
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const x = xMin + (i * (xMax - xMin)) / samples;
      let y = Number.NaN;
      try {
        y = fn(x);
      } catch {}
      if (Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
      } else {
        xs.push(x);
        ys.push(Number.NaN);
      }
    }

    // Determine y-range ignoring NaNs
    const validYs = ys.filter((v) => Number.isFinite(v));
    let yMin = -10, yMax = 10;
    if (validYs.length > 0) {
      yMin = Math.min(...validYs);
      yMax = Math.max(...validYs);
      if (yMin === yMax) { yMin -= 1; yMax += 1; }
      // Clamp extreme ranges
      const span = yMax - yMin;
      if (span > 1000) {
        yMin = -50; yMax = 50;
      }
    }

    // Transform helpers
    const toPxX = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
    const toPxY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;

    // Draw axes
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // y-axis
    const yAxisX = toPxX(0);
    ctx.moveTo(yAxisX, 0);
    ctx.lineTo(yAxisX, height);
    // x-axis
    const xAxisY = toPxY(0);
    ctx.moveTo(0, xAxisY);
    ctx.lineTo(width, xAxisY);
    ctx.stroke();

    // Plot curve
    ctx.strokeStyle = '#00e0a8';
    ctx.lineWidth = 2;
    let started = false;
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = ys[i];
      if (!Number.isFinite(y)) {
        started = false;
        continue;
      }
      const px = toPxX(x);
      const py = toPxY(y);
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }, [sanitizeExpression, tryBuildFunction]);

  const extractPlottableExpr = useCallback((results: Result[]): string | null => {
    if (!Array.isArray(results) || results.length === 0) return null;
    for (const r of results) {
      const exprRaw = (r?.expr ?? '').toString();
      const expr = exprRaw.replace(/\s+/g, '');
      // Accept y=..., f(x)=..., or expressions containing x
      if (/^y=/.test(expr) || /^f\(x\)=/.test(expr) || (/x/.test(expr) && !/=/.test(expr))) {
        return exprRaw;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (state.results.length === 0) return;
    const expr = extractPlottableExpr(state.results);
    if (expr) {
      setGraphState({ show: true, expr, error: null });
      // Plot on next paint to ensure canvas size is set
      requestAnimationFrame(() => {
        const canvas = graphCanvasRef.current;
        if (canvas) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(dpr, dpr);
          plotGraph(expr);
        }
      });
    }
  }, [state.results, extractPlottableExpr, plotGraph]);

  const updateVariable = useCallback((input: string) => {
    try {
      const pairs = input.split(',').map(pair => pair.trim());
      const newVars: Record<string, string | number> = {};
      
      pairs.forEach(pair => {
        if (pair.includes('=')) {
          const [key, value] = pair.split('=').map(s => s.trim());
          if (key && value) {
            const numValue = parseFloat(value);
            newVars[key] = isNaN(numValue) ? value : numValue;
          }
        }
      });
      
      setState(prev => ({ ...prev, dictOfVars: newVars }));
    } catch (err) {
      console.warn('Invalid variable input:', err);
    }
  }, []);

  const submitPlot = useCallback(async () => {
    if (!state.plotExpr.trim()) return;
    setState(prev => ({ ...prev, plotLoading: true, plotError: null }));
    try {
      const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
      const apiBase = (envBase ? String(envBase) : '').replace(/\/$/, '');
      const primaryEndpoint = apiBase ? `${apiBase}/calculate/plot` : '/api/calculate/plot';
      const fallbackEndpoints = [primaryEndpoint, 'https://aicalc-nvif.onrender.com/calculate/plot'];

      const payload = {
        expr: state.plotExpr,
        x_min: state.plotXMin,
        x_max: state.plotXMax,
        num_points: state.plotPoints
      };

      let json: any = null;
      let lastError: unknown = null;
      for (const ep of fallbackEndpoints) {
        try {
          const resp = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) throw new Error(`Plot request failed (${resp.status})`);
          json = await resp.json();
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!json || !Array.isArray(json.x) || !Array.isArray(json.y)) {
        throw lastError || new Error('Invalid plot response');
      }

      setState(prev => ({ ...prev, plotData: json as PlotData, plotLoading: false }));
    } catch (e) {
      setState(prev => ({ ...prev, plotLoading: false, plotError: e instanceof Error ? e.message : 'Failed to plot' }));
    }
  }, [state.plotExpr, state.plotXMin, state.plotXMax, state.plotPoints]);

  const plotSvgData = useMemo(() => {
    const data = state.plotData;
    if (!data || !data.x?.length || !data.y?.length) return null;
    const n = Math.min(data.x.length, data.y.length);
    const xs = data.x.slice(0, n);
    const ys = data.y.slice(0, n);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    if (minY === maxY) { minY -= 1; maxY += 1; }
    const width = 360;
    const height = 220;
    const m = 28;
    const sx = (x: number) => m + ((x - minX) / (maxX - minX)) * (width - 2 * m);
    const sy = (y: number) => height - (m + ((y - minY) / (maxY - minY)) * (height - 2 * m));
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x)},${sy(ys[i])}`).join(' ');
    const zeroY = (minY <= 0 && 0 <= maxY) ? sy(0) : null;
    const zeroX = (minX <= 0 && 0 <= maxX) ? sx(0) : null;
    return { path, width, height, m, minX, maxX, minY, maxY, zeroY, zeroX };
  }, [state.plotData]);

  useEffect(() => {
    // Initialize canvas size and context. Pointer handlers are attached via
    // React props on the <canvas> element to avoid ordering/overlay issues.
    setupCanvas();
    // nothing else to clean up here
  }, [setupCanvas]);

  useEffect(() => {
    updateCanvasStyle();
  }, [updateCanvasStyle]);

  // Keep canvas crisp and aligned across very large displays and orientation changes
  useEffect(() => {
    const onResize = debounce(() => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;

      // Save current bitmap
      const prev = canvas.toDataURL('image/png');

      // Re-setup canvas to new size
      setupCanvas();

      // Restore scaled bitmap to match new size
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = prev;
    }, 150);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize as any);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
    };
  }, [setupCanvas]);

  const currentColors = useMemo(() => COLOR_THEMES[state.colorTheme], [state.colorTheme]);

  const modelName = ((import.meta as any)?.env?.VITE_MODEL_NAME as string) || 'Gemini 2.5 Pro';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-teal-600/10 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)] animate-pulse"></div>
      </div>

      <div className={`relative z-10 backdrop-blur-xl bg-black/20 border-b border-white/10 ${isMobile ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            {!isMobile && (
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  AI Calculator Pro
                </h1>
                <p className="text-xs text-white/60">Advanced mathematical computation</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={state.subject}
              onChange={(e) => setState(prev => ({ ...prev, subject: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              {SUBJECTS.map(subject => (
                <option key={subject.value} value={subject.value} className="bg-slate-800">
                  {subject.label}
                </option>
              ))}
            </select>

            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-md border border-white/10 bg-white/5 text-white/70 text-xs">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
              {modelName}
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => setState(prev => ({ ...prev, showHistory: !prev.showHistory }))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 group"
                title="History"
              >
                <History className="w-4 h-4 text-white group-hover:text-cyan-400" />
              </button>
              
              <button
                onClick={downloadCanvas}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 group"
                title="Download"
              >
                <Download className="w-4 h-4 text-white group-hover:text-green-400" />
              </button>

              <button
                onClick={() => setState(prev => ({ ...prev, showSettings: !prev.showSettings }))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 group"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-white group-hover:text-purple-400" />
              </button>
            </div>
          </div>
        </div>

        {isMobile && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Variables: x=5, y=10"
              value={state.varInput}
              onChange={(e) => {
                const value = e.target.value;
                setState(prev => ({ ...prev, varInput: value }));
                updateVariable(value);
              }}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 text-sm transition-all duration-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>
        )}
      </div>

      {state.showSettings && (
        <div className="absolute top-20 right-4 z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 w-72">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </h3>
          
          <div className="mb-4">
            <label className="text-white/80 text-sm block mb-2">Color Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(COLOR_THEMES) as Array<keyof typeof COLOR_THEMES>).map(theme => (
                <button
                  key={theme}
                  onClick={() => switchTheme(theme)}
                  className={`p-2 rounded-lg border transition-all duration-200 capitalize ${
                    state.colorTheme === theme 
                      ? 'border-cyan-400 bg-cyan-400/20' 
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex gap-1 mb-1">
                    {COLOR_THEMES[theme].slice(0, 4).map((color: string, i: number) => (
                      <div key={i} className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
                    ))}
                  </div>
                  <span className="text-white/80 text-xs">{theme}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-white/80 text-sm block mb-2">Brush Size: {state.brushSize}px</label>
            <input
              type="range"
              min="1"
              max="20"
              value={state.brushSize}
              onChange={(e) => setState(prev => ({ ...prev, brushSize: Number(e.target.value) }))}
              className="w-full accent-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.smoothing}
                onChange={(e) => setState(prev => ({ ...prev, smoothing: e.target.checked }))}
                className="accent-cyan-400"
              />
              Smooth Drawing
            </label>
            <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={state.autoSave}
                onChange={(e) => setState(prev => ({ ...prev, autoSave: e.target.checked }))}
                className="accent-cyan-400"
              />
              Auto Save States
            </label>
          </div>
        </div>
      )}

      <div className="absolute top-24 left-4 z-20">
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2">
            {currentColors.map((color: string, index: number) => (
              <button
                key={index}
                onClick={() => setState(prev => ({ ...prev, color }))}
                className={`w-8 h-8 rounded-lg transition-all duration-200 ${
                  state.color === color 
                    ? 'ring-2 ring-white scale-110 shadow-lg' 
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          
          <div className="mt-2 pt-2 border-t border-white/20">
            <input
              type="color"
              value={state.color}
              onChange={(e) => setState(prev => ({ ...prev, color: e.target.value }))}
              className="w-full h-8 rounded cursor-pointer"
              title="Custom Color"
            />
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className={`absolute cursor-crosshair touch-none select-none ${
          isMobile ? 'top-0 left-0 w-full h-full' : 'top-0 left-0 w-full'
        }`}
        style={{
          height: isMobile ? '100vh' : 'calc(100vh - 80px)',
          zIndex: 1,
          imageRendering: 'pixelated',
          touchAction: 'none'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {!isMobile && (
          <input
            type="text"
            placeholder="Variables: x=5, y=10"
            value={state.varInput}
            onChange={(e) => {
              const value = e.target.value;
              setState(prev => ({ ...prev, varInput: value }));
              updateVariable(value);
            }}
            className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 w-64"
          />
        )}

        {!isMobile && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <LineChart className="w-4 h-4 text-cyan-300" />
            <input
              type="text"
              placeholder="Expression to plot (e.g., x^2)"
              value={state.plotExpr}
              onChange={(e) => setState(prev => ({ ...prev, plotExpr: e.target.value }))}
              className="bg-transparent outline-none text-white placeholder-white/50 w-40"
            />
            <input
              type="number"
              value={state.plotXMin}
              onChange={(e) => setState(prev => ({ ...prev, plotXMin: Number(e.target.value) }))}
              className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
              title="x min"
            />
            <span className="text-white/50 text-sm">to</span>
            <input
              type="number"
              value={state.plotXMax}
              onChange={(e) => setState(prev => ({ ...prev, plotXMax: Number(e.target.value) }))}
              className="w-16 bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
              title="x max"
            />
            <button
              onClick={submitPlot}
              disabled={state.plotLoading}
              className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 rounded text-cyan-300 text-sm disabled:opacity-50"
            >
              {state.plotLoading ? 'Plotting...' : 'Plot'}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={undoLastAction}
            disabled={drawingState.undoStack.length === 0}
            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 rounded-lg text-yellow-300 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <RefreshCw className="w-4 h-4" />
            {!isMobile && 'Undo'}
          </button>

          {!isMobile && (
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 rounded-lg text-red-300 transition-all duration-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          )}

          <button
            onClick={submitDrawing}
            disabled={state.loading}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-400/30 rounded-lg text-cyan-300 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 font-semibold"
          >
            {state.loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {state.loading ? 'Processing...' : 'Calculate'}
          </button>
        </div>
      </div>

      {(state.results.length > 0 || state.error) && (
        <div className={`absolute ${isMobile ? 'bottom-20 left-4 right-4' : 'top-32 right-4 w-96'} z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 max-h-64 overflow-y-auto`}>
          {state.error ? (
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white">
                <Calculator className="w-5 h-5" />
                <h3 className="font-semibold">Results</h3>
              </div>
              {state.results.map((result, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-mono text-cyan-300 mb-2">
                    {result.expr} = {String(result.result)}
                  </div>
                  {result.assign && (
                    <div className="text-sm text-green-300 mb-2 flex items-center gap-1">
                      <Save className="w-3 h-3" />
                      Variable saved
                    </div>
                  )}
                  {result.steps && result.steps.length > 0 && (
                    <div className="space-y-1 text-sm">
                      <div className="text-white/60 font-medium">Solution steps:</div>
                      {result.steps.map((step: Step, stepIndex: number) => (
                        <div key={stepIndex} className="bg-white/5 rounded p-2">
                          <div className="text-white/80 text-xs mb-1">{step.explanation}</div>
                          <div className="font-mono text-purple-300 text-xs">{step.latex}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.plotData && (
        <div
          className={`absolute right-4 z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 w-96`}
          style={{ top: (state.results.length > 0 || !!state.error) ? 420 : 130 }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-white">
              <LineChart className="w-5 h-5" />
              <h3 className="font-semibold">Plot</h3>
            </div>
            <button
              onClick={() => setState(prev => ({ ...prev, plotData: null }))}
              className="text-white/60 hover:text-white text-sm"
            >
              Close
            </button>
          </div>

          {state.plotError ? (
            <div className="flex items-center gap-2 text-red-300 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{state.plotError}</span>
            </div>
          ) : (
            <div className="bg-white/5 rounded-md p-2 border border-white/10">
              {plotSvgData && (
                <svg width={plotSvgData.width} height={plotSvgData.height}>
                  <rect x="0" y="0" width={plotSvgData.width} height={plotSvgData.height} fill="rgba(0,0,0,0.2)" />
                  {plotSvgData.zeroY !== null && (
                    <line x1="0" y1={plotSvgData.zeroY as number} x2={plotSvgData.width} y2={plotSvgData.zeroY as number} stroke="#ffffff22" />
                  )}
                  {plotSvgData.zeroX !== null && (
                    <line x1={plotSvgData.zeroX as number} y1="0" x2={plotSvgData.zeroX as number} y2={plotSvgData.height} stroke="#ffffff22" />
                  )}
                  <path d={plotSvgData.path} stroke="#22d3ee" strokeWidth="2" fill="none" />
                </svg>
              )}
              {!plotSvgData && (
                <div className="text-white/60 text-sm">No data</div>
              )}
            </div>
          )}
          {state.plotData?.latex && (
            <div className="mt-2 text-xs text-white/60 font-mono truncate">{state.plotData.latex}</div>
          )}
        </div>
      )}

      {state.showHistory && (
        <div className="absolute top-20 left-4 z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 w-80 max-h-96 overflow-y-auto">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <History className="w-4 h-4" />
            Calculation History
          </h3>
          {state.history.length === 0 ? (
            <p className="text-white/60 text-sm">No calculations yet</p>
          ) : (
            <div className="space-y-2">
              {state.history.map((entry, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">
                    {entry.timestamp.toLocaleString()} - {entry.subject}
                  </div>
                  <div className="text-sm text-cyan-300 font-mono">
                    {entry.results[0]?.expr} = {entry.results[0]?.result}
                  </div>
                  {Object.keys(entry.variables).length > 0 && (
                    <div className="text-xs text-white/50 mt-1">
                      Vars: {Object.entries(entry.variables).map(([k, v]) => `${k}=${v}`).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {Object.keys(state.dictOfVars).length > 0 && !isMobile && (
        <div className="absolute bottom-24 right-4 z-20 bg-black/40 backdrop-blur-xl border border-white/20 rounded-xl p-3 max-w-xs">
          <h4 className="text-white/80 text-sm font-medium mb-2 flex items-center gap-2">
            <Save className="w-3 h-3" />
            Active Variables
          </h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(state.dictOfVars).map(([key, value]) => (
              <span key={key} className="px-2 py-1 bg-white/10 rounded text-xs text-white border border-white/20">
                {key} = {String(value)}
              </span>
            ))}
          </div>
        </div>
      )}

      {isMobile && (
        <button
          onClick={submitDrawing}
          disabled={state.loading}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 disabled:opacity-50"
        >
          {state.loading ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : (
            <Zap className="w-8 h-8 text-white" />
          )}
        </button>
      )}

      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="sm:hidden inline-flex items-center gap-2 px-2 py-1 rounded-md border border-white/10 bg-white/5 text-white/70 text-xs">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
          {modelName}
        </div>
        <div className="text-xs text-white/40">
          {drawingState.undoStack.length > 0 && `${drawingState.undoStack.length}/10 saves`}
        </div>
      </div>
    </div>
  );
}
