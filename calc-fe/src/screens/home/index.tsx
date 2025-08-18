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

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const pendingPointsRef = useRef<{ x: number; y: number }[]>([]);

    // Disable all touch behaviors that could interfere
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Comprehensive touch prevention
        const preventAll = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        };

        // CSS-based prevention
        canvas.style.touchAction = 'none';
        canvas.style.userSelect = 'none';
        canvas.style.webkitUserSelect = 'none';
        canvas.style.webkitTouchCallout = 'none';
        canvas.style.webkitTapHighlightColor = 'transparent';

        // Event-based prevention
        canvas.addEventListener('touchstart', preventAll, { passive: false });
        canvas.addEventListener('touchmove', preventAll, { passive: false });
        canvas.addEventListener('touchend', preventAll, { passive: false });
        canvas.addEventListener('contextmenu', preventAll);
        canvas.addEventListener('selectstart', preventAll);
        canvas.addEventListener('dragstart', preventAll);

        return () => {
            canvas.removeEventListener('touchstart', preventAll);
            canvas.removeEventListener('touchmove', preventAll);
            canvas.removeEventListener('touchend', preventAll);
            canvas.removeEventListener('contextmenu', preventAll);
            canvas.removeEventListener('selectstart', preventAll);
            canvas.removeEventListener('dragstart', preventAll);
        };
    }, []);

    // Initialize canvas with maximum performance settings
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limit DPR for performance
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false,
            powerPreference: 'high-performance'
        });
        
        if (!ctx) return;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = colorRef.current;
        ctx.imageSmoothingEnabled = false; // Disable for performance

        // Initialize with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctxRef.current = ctx;
    }, []);

    // Keep stroke color in sync
    useEffect(() => {
        colorRef.current = color;
        if (ctxRef.current) {
            ctxRef.current.strokeStyle = color;
        }
    }, [color]);

    // Optimized resize handler
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = ctxRef.current || canvas.getContext('2d');
                if (ctx) {
                    const dpr = Math.min(window.devicePixelRatio || 1, 2);
                    const rect = canvas.getBoundingClientRect();
                    canvas.width = Math.floor(rect.width * dpr);
                    canvas.height = Math.floor(rect.height * dpr);
                    canvas.style.width = `${rect.width}px`;
                    canvas.style.height = `${rect.height}px`;

                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(dpr, dpr);

                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, rect.width, rect.height);

                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = colorRef.current;
                    ctx.imageSmoothingEnabled = false;

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
    }, []);

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

    // Ultra-fast drawing function using requestAnimationFrame batching
    const batchDraw = useCallback(() => {
        const ctx = ctxRef.current;
        const points = pendingPointsRef.current;
        
        if (!ctx || points.length === 0) {
            animationFrameRef.current = null;
            return;
        }

        ctx.strokeStyle = colorRef.current;

        // Process all pending points in one frame
        if (points.length === 1) {
            // First point - start new path
            const point = points[0];
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            lastPointRef.current = point;
        } else {
            // Draw lines to all points
            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                const lastPoint = lastPointRef.current;
                
                if (lastPoint) {
                    // Simple line for maximum performance
                    ctx.lineTo(point.x, point.y);
                }
                
                lastPointRef.current = point;
            }
            ctx.stroke();
        }

        // Clear processed points
        pendingPointsRef.current = [];
        animationFrameRef.current = null;
    }, []);

    // Queue point for drawing
    const queuePoint = useCallback((x: number, y: number) => {
        pendingPointsRef.current.push({ x, y });
        
        // Schedule drawing if not already scheduled
        if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(batchDraw);
        }
    }, [batchDraw]);

    // High-performance drawing event handlers
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let rect: DOMRect | null = null;

        const getPos = (clientX: number, clientY: number) => {
            if (!rect) rect = canvas.getBoundingClientRect();
            return { 
                x: clientX - rect.left, 
                y: clientY - rect.top 
            };
        };

        const startDrawing = (x: number, y: number) => {
            isDrawingRef.current = true;
            rect = canvas.getBoundingClientRect();
            lastPointRef.current = null;
            pendingPointsRef.current = [];
            queuePoint(x, y);
        };

        const continueDrawing = (x: number, y: number) => {
            if (!isDrawingRef.current) return;
            queuePoint(x, y);
        };

        const stopDrawing = () => {
            if (!isDrawingRef.current) return;
            
            isDrawingRef.current = false;
            lastPointRef.current = null;
            rect = null;
            
            // Cancel any pending animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
            
            // Final draw of any remaining points
            if (pendingPointsRef.current.length > 0) {
                batchDraw();
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

        // Touch events with immediate response
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const pos = getPos(touch.clientX, touch.clientY);
                startDrawing(pos.x, pos.y);
            }
            return false;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDrawingRef.current) return;
            e.preventDefault();
            e.stopPropagation();
            
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const pos = getPos(touch.clientX, touch.clientY);
                continueDrawing(pos.x, pos.y);
            }
            return false;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            e.stopPropagation();
            stopDrawing();
            return false;
        };

        // Add event listeners with high priority
        canvas.addEventListener('mousedown', handleMouseDown, { passive: false });
        canvas.addEventListener('mousemove', handleMouseMove, { passive: false });
        canvas.addEventListener('mouseup', stopDrawing, { passive: false });
        canvas.addEventListener('mouseleave', stopDrawing, { passive: false });

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
        canvas.addEventListener('touchcancel', stopDrawing, { passive: false, capture: true });

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('mouseleave', stopDrawing);
            
            canvas.removeEventListener('touchstart', handleTouchStart, true);
            canvas.removeEventListener('touchmove', handleTouchMove, true);
            canvas.removeEventListener('touchend', handleTouchEnd, true);
            canvas.removeEventListener('touchcancel', stopDrawing, true);
        };
    }, [queuePoint, batchDraw]);

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
                
                data.forEach((result) => {
                    if (result.assign === true) {
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

    const handleVariableInput = useCallback((input: string) => {
        try {
            const pairs = input.split(',').map(pair => pair.trim());
            const newVars: Record<string, number | string> = {};
            
            pairs.forEach(pair => {
                if (pair.includes('=')) {
                    const [key, value] = pair.split('=').map(s => s.trim());
                    if (key && value) {
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

    useEffect(() => {
        const cleanup = loadMathJax();
        return () => {
            if (cleanup) cleanup();
        };
    }, [loadMathJax]);

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
            <div className="relative z-10 p-4 glass-panel mx-4 mt-4 mb-2">
                <div className="flex flex-wrap items-center gap-4 justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            A
                        </div>
                        <h1 className="text-xl font-bold text-white">Aryan's AI Calculator</h1>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Subject Selection */}
                        <Select
                            data={SUBJECTS.map(s => ({ value: s.value, label: s.label }))}
                            value={subject}
                            onChange={(value) => setSubject(value || 'math')}
                            className="w-40"
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
                            className="glass-input w-48"
                        />
                        
                        {/* Color Palette */}
                        <Group className="flex-wrap">
                            {SWATCHES.map((swatch) => (
                                <ColorSwatch
                                    key={swatch}
                                    color={swatch}
                                    onClick={() => setColor(swatch)}
                                    className={`cursor-pointer transition-all duration-200 ${
                                        color === swatch ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                                    }`}
                                    size={24}
                                />
                            ))}
                        </Group>
                        
                        {/* Action Buttons */}
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

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute top-20 left-0 w-full cursor-crosshair"
                style={{ 
                    height: 'calc(100vh - 100px)',
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    WebkitTapHighlightColor: 'transparent'
                }}
            />

            {/* Results Panel */}
            {(results.length > 0 || error) && (
                <Draggable defaultPosition={latexPosition}>
                    <div className="absolute glass-panel p-6 max-w-md max-h-96 overflow-y-auto">
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
        </div>
    );
}
