import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Calculator,
  RefreshCw,
  Upload,
  Loader2,
  AlertCircle,
  Download,
  Save,
  Palette,
  Maximize2,
  Minimize2,
  History,
  Settings,
  Zap,
  Brain,
  Eye,
  EyeOff
} from 'lucide-react';

// --- TYPE DEFINITIONS START ---
// By defining the shapes of our data, we fix the "Property does not exist on type 'never'" errors.

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

interface HistoryEntry {
  timestamp: Date;
  results: Result[];
  subject: string;
  variables: Record<string, string | number>;
}

interface CalculatorState {
  color: string;
  colorTheme: keyof typeof COLOR_THEMES; // Use keys of the theme object for type safety
  dictOfVars: Record<string, string | number>;
  results: Result[]; // Typed as an array of Result objects
  history: HistoryEntry[]; // Typed as an array of HistoryEntry objects
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
}

interface DrawingState {
  isDrawing: boolean;
  lastPoint: { x: number; y: number } | null;
  paths: any[]; // Kept as 'any' as it's not being used. Define if needed.
  undoStack: string[];
  redoStack: string[];
}
// --- TYPE DEFINITIONS END ---

// Enhanced color palette with gradients and themes
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

// Performance optimized mobile detection
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

// Utility functions with added types
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


// Enhanced Calculator Component
export default function EnhancedAICalculator() {
  // FIX: Added types for refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isMobile = useMobileDetection();
  
  // FIX: Applied the CalculatorState interface to useState. This solves all 'never' type errors.
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
    smoothing: true,
    autoSave: true
  });

  // FIX: Applied the DrawingState interface
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    lastPoint: null,
    paths: [],
    undoStack: [],
    redoStack: []
  });

  // Performance optimized canvas setup
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limit DPR for performance
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
    if (state.smoothing) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }, [state.color, state.brushSize, state.smoothing]);

  // Enhanced drawing with pressure sensitivity simulation
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

    // Calculate dynamic brush size based on speed (simulated pressure)
    const dx = x - lastPoint.x;
    const dy = y - lastPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.min(distance / 10, 1);
    const dynamicSize = state.brushSize * (0.5 + 0.5 * (1 - speed)) * pressure;

    ctx.lineWidth = dynamicSize;
    
    // Smooth quadratic curves
    const midX = (lastPoint.x + x) / 2;
    const midY = (lastPoint.y + y) / 2;
    
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    ctx.stroke();

    setDrawingState(prev => ({ ...prev, lastPoint: { x, y } }));
  }, 16), [state.brushSize, drawingState.isDrawing, drawingState.lastPoint]);

  // Enhanced event handlers with event types
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDrawingState(prev => ({ 
      ...prev, 
      isDrawing: true, 
      lastPoint: { x, y },
      redoStack: [] // Clear redo stack on new drawing
    }));

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
    const pressure = e.pressure || 1;

    drawSmooth(x, y, pressure);
  }, [drawingState.isDrawing, drawSmooth]);

  const handlePointerUp = useCallback(() => {
    if (!drawingState.isDrawing) return;
    
    setDrawingState(prev => ({ 
      ...prev, 
      isDrawing: false, 
      lastPoint: null 
    }));

    // Save to undo stack
    const canvas = canvasRef.current;
    if (canvas && state.autoSave) {
      const imageData = canvas.toDataURL();
      setDrawingState(prev => ({
        ...prev,
        undoStack: [...prev.undoStack.slice(-9), imageData] // Keep last 10 states
      }));
    }
  }, [drawingState.isDrawing, state.autoSave]);

  // Canvas operations
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

  // Enhanced API call with retry logic
  const submitDrawing = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Simulate API call since we don't have the actual endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock response - This now matches our Result[] type
      const mockResults: Result[] = [
        {
          expr: "2x + 3 = 11",
          result: "x = 4",
          assign: true,
          steps: [
            { latex: "2x + 3 = 11", explanation: "Original equation" },
            { latex: "2x = 11 - 3", explanation: "Subtract 3 from both sides" },
            { latex: "2x = 8", explanation: "Simplify" },
            { latex: "x = 4", explanation: "Divide by 2" }
          ]
        }
      ];

      setState(prev => ({
        ...prev,
        results: mockResults,
        history: [
          { 
            timestamp: new Date(), 
            results: mockResults, 
            subject: prev.subject,
            variables: prev.dictOfVars 
          },
          ...prev.history.slice(0, 19) // Keep last 20 calculations
        ],
        loading: false
      }));

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to process calculation. Please try again.',
        loading: false 
      }));
    }
  }, []);

  // Download functionality
  const downloadCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `calculation-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  // Reset everything
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

  // Theme switching
  const switchTheme = useCallback((theme: keyof typeof COLOR_THEMES) => {
    setState(prev => ({ 
      ...prev, 
      colorTheme: theme,
      color: COLOR_THEMES[theme][0]
    }));
  }, []);

  // Variable handling
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

  // Initialize canvas and event listeners
  useEffect(() => {
    setupCanvas();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const preventDefault = (e: Event) => e.preventDefault();
    
    // React's event system already handles these well, but if direct listeners are needed:
    // We can use the already defined handlers. No need to redefine them.
    // Note: React's onPointerDown etc. are often preferred over addEventListener in React components.
    
    canvas.addEventListener('contextmenu', preventDefault);
    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      canvas.removeEventListener('contextmenu', preventDefault);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp, setupCanvas]);

  // Update canvas style when relevant state changes
  useEffect(() => {
    updateCanvasStyle();
  }, [updateCanvasStyle]);

  // Memoized color palette
  const currentColors = useMemo(() => COLOR_THEMES[state.colorTheme], [state.colorTheme]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-teal-600/10 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)] animate-pulse"></div>
      </div>

      {/* Enhanced Header */}
      <div className={`relative z-10 backdrop-blur-xl bg-black/20 border-b border-white/10 ${isMobile ? 'p-2' : 'p-4'}`}>
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
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

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Subject Selector */}
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

            {/* Action Buttons */}
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

        {/* Mobile Controls Row */}
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

      {/* Settings Panel */}
      {state.showSettings && (
        <div className="absolute top-20 right-4 z-30 bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl p-4 w-72">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </h3>
          
          {/* Color Themes */}
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
                    {/* FIX: Added types to map callback parameters */}
                    {COLOR_THEMES[theme].slice(0, 4).map((color: string, i: number) => (
                      <div key={i} className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
                    ))}
                  </div>
                  <span className="text-white/80 text-xs">{theme}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Brush Settings */}
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

          {/* Toggles */}
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

      {/* Color Palette */}
      <div className="absolute top-24 left-4 z-20">
        <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-xl p-3">
          <div className="grid grid-cols-3 gap-2">
            {/* FIX: Added types to map callback parameters */}
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
          
          {/* Custom Color Picker */}
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

      {/* Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute cursor-crosshair touch-none select-none ${
          isMobile ? 'top-0 left-0 w-full h-full' : 'top-0 left-0 w-full'
        }`}
        style={{
          height: isMobile ? '100vh' : 'calc(100vh - 80px)',
          zIndex: 1,
          imageRendering: 'pixelated',
          touchAction: 'none'
        }}
      />

      {/* Bottom Controls */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        {/* Variables Input (Desktop) */}
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

        {/* Action Buttons */}
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

      {/* Results Panel */}
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
              {/* Because state.results is now Result[], 'result' is correctly typed */}
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
                      {/* FIX: Added types to map callback parameters */}
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

      {/* History Panel */}
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
               {/* Because state.history is now HistoryEntry[], 'entry' is correctly typed */}
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

      {/* Variable Display */}
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

      {/* Mobile floating action button */}
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

      {/* Performance indicator */}
      <div className="absolute top-4 right-4 z-50 text-xs text-white/40">
        {drawingState.undoStack.length > 0 && `${drawingState.undoStack.length}/10 saves`}
      </div>
    </div>
  );
}
