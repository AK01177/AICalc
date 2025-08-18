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

    // Initialize canvas with proper sizing and context
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Set canvas size to match display size
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
                
                // Set drawing context properties
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                // Initialize with black background
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, [color]);

    // Handle window resize and orientation change for mobile
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
            if (ctx) {
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width;
                canvas.height = rect.height;
                
                // Redraw black background
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
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
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, []);

    // Helper function to get coordinates from both mouse and touch events
    const getCoordinates = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        
        if ('touches' in e) {
            // Touch event
            const touch = e.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        } else {
            // Mouse event
            return {
                x: e.nativeEvent.offsetX,
                y: e.nativeEvent.offsetY
            };
        }
    }, []);

    const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        // Prevent default touch behavior to avoid scrolling
        if ('touches' in e) {
            e.preventDefault();
        }
        
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const coords = getCoordinates(e);
                ctx.beginPath();
                ctx.moveTo(coords.x, coords.y);
                setIsDrawing(true);
            }
        }
    }, [getCoordinates]);

    const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        
        // Prevent default touch behavior to avoid scrolling
        if ('touches' in e) {
            e.preventDefault();
        }
        
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const coords = getCoordinates(e);
                ctx.strokeStyle = color;
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            }
        }
    }, [isDrawing, color, getCoordinates]);

    const stopDrawing = useCallback(() => {
        setIsDrawing(false);
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
                        <Calculator className="w-6 h-6 text-white" />
                        <h1 className="text-xl font-bold text-white">AI Calculator</h1>
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
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                onTouchCancel={stopDrawing}
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

            {/* Instructions */}
            <div className="absolute bottom-4 left-4 glass-panel p-4 max-w-xs">
                <h4 className="text-white font-semibold mb-2">How to use:</h4>
                <ol className="text-white/80 text-sm space-y-1">
                    <li>1. Select subject and set variables</li>
                    <li>2. Draw your expression on the canvas</li>
                    <li>3. Click Calculate to solve</li>
                    <li>4. Drag result panel to move</li>
                </ol>
                <div className="mt-2 text-xs text-white/60">
                    💡 Use mouse on desktop or touch on mobile to draw
                </div>
            </div>
        </div>
    );
}
