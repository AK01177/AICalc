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
    const [isDrawing, setIsDrawing] = useState(false);
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

    // Prevent scrolling when drawing on mobile
    useEffect(() => {
        const preventScroll = (e: TouchEvent) => {
            if (isDrawing) {
                e.preventDefault();
            }
        };

        // Add passive: false to allow preventDefault
        document.addEventListener('touchmove', preventScroll, { passive: false });
        
        return () => {
            document.removeEventListener('touchmove', preventScroll);
        };
    }, [isDrawing]);

    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

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

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = colorRef.current;

        // Initialize with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctxRef.current = ctx;
    }, []);

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

                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = colorRef.current;

                    ctxRef.current = ctx;
                }
            }
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, []);

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

    // Pointer-based drawing: immediate line segments with coalesced events for minimal lag
    const isDrawingRef = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const getPos = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect();
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const handlePointerDown = (e: PointerEvent) => {
            canvas.setPointerCapture?.(e.pointerId);
            const pos = getPos(e.clientX, e.clientY);
            isDrawingRef.current = true;
            setIsDrawing(true);
            const ctx = ctxRef.current;
            if (!ctx) return;
            ctx.strokeStyle = colorRef.current;
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDrawingRef.current) return;
            const ctx = ctxRef.current;
            if (!ctx) return;
            const events = (e as any).getCoalescedEvents?.() as PointerEvent[] | undefined;
            if (events && events.length > 0) {
                for (const ce of events) {
                    const p = getPos(ce.clientX, ce.clientY);
                    ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            } else {
                const p = getPos(e.clientX, e.clientY);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            }
        };

        const stop = () => {
            isDrawingRef.current = false;
            setIsDrawing(false);
            const ctx = ctxRef.current;
            if (ctx) {
                ctx.closePath();
            }
        };

        canvas.addEventListener('pointerdown', handlePointerDown);
        canvas.addEventListener('pointermove', handlePointerMove);
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointercancel', stop);
        canvas.addEventListener('pointerout', stop);

        return () => {
            canvas.removeEventListener('pointerdown', handlePointerDown);
            canvas.removeEventListener('pointermove', handlePointerMove);
            canvas.removeEventListener('pointerup', stop);
            canvas.removeEventListener('pointercancel', stop);
            canvas.removeEventListener('pointerout', stop);
        };
    }, []);

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
                className="absolute top-20 left-0 w-full cursor-crosshair touch-none"
                style={{ height: 'calc(100vh - 100px)' }}
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
