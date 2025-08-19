import { ColorSwatch, Group, Select } from '@mantine/core';
import { Button } from '@/components/ui/button';
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import Draggable from 'react-draggable';
import { SWATCHES, SUBJECTS } from '@/constants';
import { AlertCircle, Calculator, Loader2, RefreshCw, Upload } from 'lucide-react';

interface Step {
    latex: string;
    explanation: string;
}

interface Response {
    expr: string;
    result: string | number | object;
    assign?: boolean;
    steps?: Step[];
}

interface ApiResponse {
    message: string;
    data: Response[];
    status: 'success' | 'error' | 'warning';
}

// Custom hook for mobile detection
const useMobileDetection = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const checkDevice = () => {
            const mobile = window.innerWidth <= 768;
            const portrait = window.innerHeight > window.innerWidth;
            setIsMobile(mobile);
            setIsPortrait(portrait);
        };
        
        checkDevice();
        window.addEventListener('resize', checkDevice);
        window.addEventListener('orientationchange', checkDevice);
        
        return () => {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('orientationchange', checkDevice);
        };
    }, []);

    return { isMobile, isPortrait };
};

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isMobile, isPortrait } = useMobileDetection();

    const [color, setColor] = useState('rgb(255, 255, 255)');
    const colorRef = useRef<string>('rgb(255, 255, 255)');
    const [dictOfVars, setDictOfVars] = useState<Record<string, number | string>>({});
    const [results, setResults] = useState<Response[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subject, setSubject] = useState('math');
    const [varInput, setVarInput] = useState('');
    const [latexPosition] = useState({ x: 10, y: 200 });
    const [, setMathJaxLoaded] = useState(false);

    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef(false);
    const rectRef = useRef<DOMRect | null>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const pathRef = useRef<Path2D | null>(null);

    // Prevent scrolling and zooming when drawing on mobile
    useEffect(() => {
        const preventDefault = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                // Allow multi-touch gestures when not drawing
                if (!isDrawingRef.current) return;
            }
            e.preventDefault();
        };

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Prevent touch behaviors on canvas
        canvas.addEventListener('touchstart', preventDefault, { passive: false });
        canvas.addEventListener('touchmove', preventDefault, { passive: false });
        canvas.addEventListener('touchend', preventDefault, { passive: false });
        
        // Prevent context menu on long press
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        return () => {
            if (canvas) {
                canvas.removeEventListener('touchstart', preventDefault);
                canvas.removeEventListener('touchmove', preventDefault);
                canvas.removeEventListener('touchend', preventDefault);
                canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
            }
        };
    }, []);

    // Initialize canvas once with proper DPR scaling and context
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true, // Better performance on mobile
            willReadFrequently: false
        });
        
        if (!ctx) return;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.lineWidth = isMobile ? 4 : 3; // Thicker for mobile
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = colorRef.current;

        // Initialize with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctxRef.current = ctx;
    }, [isMobile]);

    // Keep stroke color in sync without reinitializing the canvas
    useEffect(() => {
        colorRef.current = color;
        if (ctxRef.current) {
            ctxRef.current.strokeStyle = color;
        }
    }, [color]);

    // Handle window resize and orientation change for mobile with DPR
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = ctxRef.current || canvas.getContext('2d');
                if (ctx) {
                    const dpr = window.devicePixelRatio || 1;
                    const rect = canvas.getBoundingClientRect();
                    canvas.width = Math.floor(rect.width * dpr);
                    canvas.height = Math.floor(rect.height * dpr);
                    canvas.style.width = `${rect.width}px`;
                    canvas.style.height = `${rect.height}px`;

                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(dpr, dpr);

                    // Redraw black background (content not preserved on resize)
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, rect.width, rect.height);

                    ctx.lineWidth = isMobile ? 4 : 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = colorRef.current;

                    ctxRef.current = ctx;
                }
            }
        };

        let resizeTimeout: NodeJS.Timeout;
        const debouncedResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(handleResize, 100);
        };

        window.addEventListener('resize', debouncedResize);
        window.addEventListener('orientationchange', debouncedResize);
        
        return () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', debouncedResize);
            window.removeEventListener('orientationchange', debouncedResize);
        };
    }, [isMobile]);

    // Canvas functions
    const resetCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = ctxRef.current || canvas.getContext('2d');
            if (!ctx) return;
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, rect.width, rect.height);
        }
    }, []);

    // Optimized drawing with smooth curves
    const smoothLine = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
        const lastPoint = lastPointRef.current;
        
        if (!lastPoint) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            lastPointRef.current = { x, y };
            return;
        }

        // Calculate distance to determine if we should draw
        const dx = x - lastPoint.x;
        const dy = y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Skip very small movements to reduce jitter
        if (distance < 2) return;

        // Use quadratic curves for smoother lines
        const midX = (lastPoint.x + x) / 2;
        const midY = (lastPoint.y + y) / 2;

        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
        ctx.stroke();

        lastPointRef.current = { x, y };
    }, []);

    // Optimized pointer-based drawing with better mobile support
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getPos = (clientX: number, clientY: number) => {
            const rect = rectRef.current || canvas.getBoundingClientRect();
            return { 
                x: (clientX - rect.left), 
                y: (clientY - rect.top) 
            };
        };

        const startDrawing = (x: number, y: number) => {
            const ctx = ctxRef.current;
            if (!ctx) return;

            isDrawingRef.current = true;
            rectRef.current = canvas.getBoundingClientRect();
            
            ctx.strokeStyle = colorRef.current;
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(x, y);
            
            lastPointRef.current = { x, y };
            pathRef.current = new Path2D();
            pathRef.current.moveTo(x, y);
        };

        const continueDrawing = (x: number, y: number) => {
            if (!isDrawingRef.current) return;
            const ctx = ctxRef.current;
            if (!ctx) return;

            smoothLine(ctx, x, y);
        };

        const stopDrawing = () => {
            if (!isDrawingRef.current) return;
            
            isDrawingRef.current = false;
            lastPointRef.current = null;
            pathRef.current = null;
            rectRef.current = null;
            
            const ctx = ctxRef.current;
            if (ctx) {
                ctx.closePath();
            }
        };

        // Mouse events
        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            const pos = getPos(e.clientX, e.clientY);
            startDrawing(pos.x, pos.y);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDrawingRef.current) return;
            e.preventDefault();
            const pos = getPos(e.clientX, e.clientY);
            continueDrawing(pos.x, pos.y);
        };

        const handleMouseUp = (e: MouseEvent) => {
            e.preventDefault();
            stopDrawing();
        };

        // Touch events with better handling
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const pos = getPos(touch.clientX, touch.clientY);
                startDrawing(pos.x, pos.y);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDrawingRef.current || e.touches.length !== 1) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const pos = getPos(touch.clientX, touch.clientY);
            continueDrawing(pos.x, pos.y);
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            stopDrawing();
        };

        // Add mouse event listeners
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', stopDrawing);

        // Add touch event listeners
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', stopDrawing);
            
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchcancel', stopDrawing);
        };
    }, [smoothLine]);

    // API call
    const submitDrawing = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const response = await axios.post<ApiResponse>(
                `${import.meta.env.VITE_API_URL}/calculate`,
                {
                    image: canvas.toDataURL('image/png'),
                    dict_of_vars: dictOfVars,
                    subject: subject
                }
            );

            const { data, status, message } = response.data;
            
            if (status === 'success') {
                setResults(data);
                
                // Update variables if any assignments were made
                data.forEach((result) => {
                    if (result.assign === true) {
                        // Only store string or number values in dictOfVars
                        if (typeof result.result === 'string' || typeof result.result === 'number') {
                            const validResult = result.result as string | number;
                            setDictOfVars(prev => ({
                                ...prev,
                                [result.expr]: validResult
                            }));
                        }
                    }
                });
            } else {
                setError(message || 'Unknown error occurred');
            }
        } catch (err) {
            console.error('API Error:', err);
            setError('Failed to process image. Please check if the backend is running.');
        } finally {
            setLoading(false);
        }
    }, [dictOfVars, subject]);

    // Variable input handling
    const handleVariableInput = useCallback((input: string) => {
        try {
            const pairs = input.split(',').map(pair => pair.trim());
            const newVars: Record<string, number | string> = {};
            
            pairs.forEach(pair => {
                if (pair.includes('=')) {
                    const [key, value] = pair.split('=').map(s => s.trim());
                    if (key && value) {
                        // Try to parse as number, otherwise keep as string
                        const numValue = parseFloat(value);
                        newVars[key] = isNaN(numValue) ? value : numValue;
                    }
                }
            });
            
            setDictOfVars(newVars);
        } catch (err) {
            console.warn('Invalid variable input:', err);
        }
    }, []);

    // MathJax integration
    const loadMathJax = useCallback(() => {
        if (window.MathJax) {
            setMathJaxLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-mml-chtml.js';
        script.async = true;
        
        script.onload = () => {
            if (window.MathJax) {
                window.MathJax.startup?.defaultReady?.();
                setMathJaxLoaded(true);
            }
        };
        
        script.onerror = () => {
            console.warn('Failed to load MathJax');
        };
        
        document.head.appendChild(script);

        return () => {
            if (document.head.contains(script)) {
                document.head.removeChild(script);
            }
        };
    }, []);

    // Initialize MathJax
    useEffect(() => {
        // Load MathJax
        const cleanup = loadMathJax();
        
        return () => {
            if (cleanup) cleanup();
        };
    }, [loadMathJax]);

    // Reset function
    const handleReset = useCallback(() => {
        resetCanvas();
        setResults([]);
        setError(null);
        setDictOfVars({});
        setVarInput('');
    }, [resetCanvas]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27 width=%2732%27 height=%2732%27 fill=%27none%27 stroke=%27rgb(148 163 184 / 0.05)%27%3e%3cpath d=%27m0 .5 32 32M32 .5 0 32%27/%3e%3c/svg%3e')] opacity-20"></div>
            
            {/* Header Controls */}
            <div className={`relative z-10 p-4 glass-panel mx-4 mt-4 mb-2 ${isMobile ? 'mb-4' : 'mb-2'}`}>
                <div className={`flex flex-wrap items-center gap-4 justify-between ${isMobile ? 'flex-col items-stretch' : ''}`}>
                    <div className="flex items-center gap-4 justify-center">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            A
                        </div>
                        <h1 className={`font-bold text-white ${isMobile ? 'text-lg' : 'text-xl'}`}>Aryan's AI Calculator</h1>
                    </div>
                    
                    <div className={`flex flex-wrap items-center gap-4 ${isMobile ? 'flex-col items-stretch justify-center' : ''}`}>
                        {/* Subject Selection */}
                        <Select
                            data={SUBJECTS.map(s => ({ value: s.value, label: s.label }))}
                            value={subject}
                            onChange={(value) => setSubject(value || 'math')}
                            className={isMobile ? 'w-full' : 'w-40'}
                            styles={{
                                input: {
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                },
                                dropdown: {
                                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                    backdropFilter: 'blur(10px)',
                                }
                            }}
                        />
                        
                        {/* Variable Input */}
                        <input
                            type="text"
                            placeholder="Variables: x=5, y=10"
                            value={varInput}
                            onChange={(e) => {
                                setVarInput(e.target.value);
                                handleVariableInput(e.target.value);
                            }}
                            className={`glass-input ${isMobile ? 'w-full' : 'w-48'}`}
                        />
                        
                        {/* Color Palette */}
                        <Group className={`flex-wrap ${isMobile ? 'justify-center' : ''}`}>
                            {SWATCHES.map((swatch) => (
                                <ColorSwatch
                                    key={swatch}
                                    color={swatch}
                                    onClick={() => setColor(swatch)}
                                    className={`cursor-pointer transition-all duration-200 ${
                                        color === swatch ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                                    }`}
                                    size={isMobile ? 28 : 24}
                                />
                            ))}
                        </Group>
                        
                        {/* Action Buttons */}
                        <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                className="glass-button border-red-400/30 hover:border-red-400/50 text-red-300"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Reset
                            </Button>
                            
                            <Button
                                onClick={submitDrawing}
                                disabled={loading}
                                className="glass-button bg-green-600/20 hover:bg-green-600/30 border-green-400/30"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Upload className="w-4 h-4 mr-2" />
                                )}
                                {loading ? 'Processing...' : 'Calculate'}
                            </Button>
                        </div>
                    </div>
                </div>
                
                {/* Variables Display */}
                {Object.keys(dictOfVars).length > 0 && (
                    <div className="mt-4 p-3 bg-black/20 rounded-lg">
                        <h3 className="text-sm font-semibold text-white/80 mb-2">Variables:</h3>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(dictOfVars).map(([key, value]) => (
                                <span key={key} className="px-2 py-1 bg-white/10 rounded text-sm text-white">
                                    {key} = {String(value)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Canvas - Mobile responsive positioning */}
            <canvas
                ref={canvasRef}
                className={`absolute cursor-crosshair touch-none select-none ${
                    isMobile 
                        ? 'top-0 left-0 w-full h-full' 
                        : 'top-20 left-0 w-full'
                }`}
                style={{ 
                    height: isMobile ? '100vh' : 'calc(100vh - 100px)',
                    imageRendering: 'pixelated',
                    touchAction: 'none',
                    zIndex: isMobile ? 1 : 'auto'
                }}
            />

            {/* Results Panel - Mobile responsive */}
            {(results.length > 0 || error) && (
                <Draggable 
                    defaultPosition={latexPosition}
                    disabled={isMobile} // Disable dragging on mobile
                    bounds={isMobile ? "parent" : undefined} // Constrain to parent on mobile
                >
                    <div className={`absolute glass-panel p-6 overflow-y-auto ${
                        isMobile 
                            ? 'bottom-4 left-4 right-4 max-h-64 z-20' 
                            : 'max-w-md max-h-96'
                    }`}>
                        {error ? (
                            <div className="flex items-center gap-2 text-red-300">
                                <AlertCircle className="w-5 h-5" />
                                <span>{error}</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-white">
                                    <Calculator className="w-5 h-5" />
                                    <h3 className="font-semibold">Results</h3>
                                </div>
                                {results.map((result, index) => (
                                    <div key={index} className="solution-step">
                                        <div className="text-lg font-mono text-white">
                                            {result.expr} = {String(result.result)}
                                        </div>
                                        {result.assign && (
                                            <div className="text-sm text-green-300 mt-1">
                                                Variable assigned
                                            </div>
                                        )}
                                        {result.steps && result.steps.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {result.steps.map((step, stepIndex) => (
                                                    <div key={stepIndex} className="text-sm text-white/80">
                                                        <div className="font-medium">{step.explanation}</div>
                                                        <div className="font-mono text-white/60">{step.latex}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Draggable>
            )}

            {/* Mobile Drawing Instructions */}
            {isMobile && (
                <div className="absolute top-4 right-4 z-30 glass-panel p-3 text-xs text-white/80 max-w-32">
                    <div className="text-center">
                        <div className="font-semibold mb-1">Draw here</div>
                        <div className="text-white/60">Use your finger to draw mathematical expressions</div>
                    </div>
                </div>
            )}
        </div>
    );
}
