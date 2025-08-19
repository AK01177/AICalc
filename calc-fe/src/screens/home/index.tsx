import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, Calculator, Loader2, RefreshCw, Upload, Palette, Settings } from 'lucide-react';

// Constants
const SWATCHES = [
    'rgb(255, 255, 255)', // White
    'rgb(255, 0, 0)',     // Red
    'rgb(0, 255, 0)',     // Green
    'rgb(0, 0, 255)',     // Blue
    'rgb(255, 255, 0)',   // Yellow
    'rgb(255, 0, 255)',   // Magenta
    'rgb(0, 255, 255)',   // Cyan
    'rgb(255, 128, 0)',   // Orange
];

const SUBJECTS = [
    { value: 'math', label: 'Mathematics' },
    { value: 'physics', label: 'Physics' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'calculus', label: 'Calculus' },
    { value: 'algebra', label: 'Algebra' },
    { value: 'geometry', label: 'Geometry' },
];

// Types
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

// Component prop types
interface ColorSwatchProps {
    color: string;
    isSelected: boolean;
    onClick: (color: string) => void;
    size?: number;
}

interface SelectProps {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

interface ButtonProps {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'outline' | 'success';
    className?: string;
}

// Custom hook for mobile detection
const useMobileDetection = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkDevice = () => {
            const mobile = window.innerWidth <= 768;
            setIsMobile(mobile);
        };
        
        checkDevice();
        window.addEventListener('resize', checkDevice);
        window.addEventListener('orientationchange', checkDevice);
        
        return () => {
            window.removeEventListener('resize', checkDevice);
            window.removeEventListener('orientationchange', checkDevice);
        };
    }, []);

    return { isMobile };
};

// ColorSwatch Component
const ColorSwatch: React.FC<ColorSwatchProps> = ({ color, isSelected, onClick, size = 24 }) => (
    <div
        className={`cursor-pointer transition-all duration-200 rounded-full border-2 ${
            isSelected ? 'ring-2 ring-white scale-110 border-white' : 'border-gray-400 hover:scale-105'
        }`}
        style={{ 
            backgroundColor: color, 
            width: size, 
            height: size,
            minWidth: size,
            minHeight: size
        }}
        onClick={() => onClick(color)}
    />
);

// Select Component
const Select: React.FC<SelectProps> = ({ options, value, onChange, placeholder, className = '' }) => (
    <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
    >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-gray-800 text-white">
                {option.label}
            </option>
        ))}
    </select>
);

// Button Component
const Button: React.FC<ButtonProps> = ({ children, onClick, disabled = false, variant = 'default', className = '', ...props }) => {
    const baseClasses = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
    const variantClasses = {
        default: "bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 text-blue-300",
        outline: "bg-transparent border hover:bg-white/5",
        success: "bg-green-600/20 hover:bg-green-600/30 border border-green-400/30 text-green-300"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isMobile } = useMobileDetection();

    // State
    const [color, setColor] = useState<string>('rgb(255, 255, 255)');
    const [dictOfVars, setDictOfVars] = useState<Record<string, number | string>>({});
    const [results, setResults] = useState<Response[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [subject, setSubject] = useState<string>('math');
    const [varInput, setVarInput] = useState<string>('');
    const [showControls, setShowControls] = useState<boolean>(!isMobile);

    // Drawing state refs
    const colorRef = useRef<string>('rgb(255, 255, 255)');
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawingRef = useRef<boolean>(false);
    const rectRef = useRef<DOMRect | null>(null);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    // Keep color in sync
    useEffect(() => {
        colorRef.current = color;
        if (ctxRef.current) {
            ctxRef.current.strokeStyle = color;
        }
    }, [color]);

    // Initialize canvas
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
            desynchronized: true,
            willReadFrequently: false
        });
        
        if (!ctx) return;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        ctx.lineWidth = isMobile ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = colorRef.current;

        // Initialize with black background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, rect.width, rect.height);

        ctxRef.current = ctx;
    }, [isMobile]);

    // Handle resize
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (!canvas || !ctxRef.current) return;

            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            canvas.style.width = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;

            const ctx = ctxRef.current;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            // Redraw black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, rect.width, rect.height);

            ctx.lineWidth = isMobile ? 4 : 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = colorRef.current;
        };

        let resizeTimeout;
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

    // Canvas drawing functions
    const resetCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, rect.width, rect.height);
    }, []);

    const smoothLine = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
        const lastPoint = lastPointRef.current;
        
        if (!lastPoint) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            lastPointRef.current = { x, y };
            return;
        }

        const dx = x - lastPoint.x;
        const dy = y - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 2) return;

        const midX = (lastPoint.x + x) / 2;
        const midY = (lastPoint.y + y) / 2;

        ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
        ctx.stroke();

        lastPointRef.current = { x, y };
    }, []);

    // Drawing event handlers
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
        };

        const continueDrawing = (x: number, y: number) => {
            if (!isDrawingRef.current || !ctxRef.current) return;
            smoothLine(ctxRef.current, x, y);
        };

        const stopDrawing = () => {
            if (!isDrawingRef.current) return;
            
            isDrawingRef.current = false;
            lastPointRef.current = null;
            rectRef.current = null;
            
            if (ctxRef.current) {
                ctxRef.current.closePath();
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

        // Touch events
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

        // Add event listeners
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', stopDrawing);

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', stopDrawing);

        // Prevent context menu and scrolling
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', stopDrawing);
            
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
            canvas.removeEventListener('touchcancel', stopDrawing);
            canvas.removeEventListener('contextmenu', (e) => e.preventDefault());
        };
    }, [smoothLine]);

    // API submission (mock implementation since no backend)
    const submitDrawing = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        setLoading(true);
        setError(null);
        
        try {
            // Mock API response for demonstration
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulate a successful response
            const mockResults: Response[] = [
                {
                    expr: "2 + 3",
                    result: 5,
                    assign: false,
                    steps: [
                        { latex: "2 + 3", explanation: "Adding two numbers" },
                        { latex: "= 5", explanation: "Result" }
                    ]
                }
            ];
            
            setResults(mockResults);
            
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
            const pairs = input.split(',').map((pair: string) => pair.trim());
            const newVars: Record<string, number | string> = {};
            
            pairs.forEach((pair: string) => {
                if (pair.includes('=')) {
                    const [key, value] = pair.split('=').map((s: string) => s.trim());
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
            <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 32 32%27 width=%2732%27 height=%2732%27 fill=%27none%27 stroke=%27rgb(148 163 184 / 0.05)%27%3e%3cpath d=%27m0 .5 32 32M32 .5 0 32%27/%3e%3c/svg%3e')]"></div>
            </div>
            
            {/* Mobile Controls Toggle */}
            {isMobile && (
                <button
                    onClick={() => setShowControls(!showControls)}
                    className="fixed top-4 right-4 z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-3 text-white"
                >
                    <Settings className="w-5 h-5" />
                </button>
            )}

            {/* Header Controls */}
            {showControls && (
                <div className={`relative z-40 ${
                    isMobile 
                        ? 'fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-white/10' 
                        : ''
                } p-4`}>
                    {isMobile ? (
                        <div className="space-y-3 pt-8">
                            {/* App Title */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg w-8 h-8 text-lg">
                                    A
                                </div>
                                <h1 className="font-bold text-white text-lg">AI Calculator</h1>
                            </div>
                            
                            {/* Subject and Variables */}
                            <div className="grid grid-cols-1 gap-3">
                                <Select
                                    options={SUBJECTS}
                                    value={subject}
                                    onChange={setSubject}
                                    className="w-full"
                                />
                                <input
                                    type="text"
                                    placeholder="Variables: x=5, y=10"
                                    value={varInput}
                                    onChange={(e) => {
                                        setVarInput(e.target.value);
                                        handleVariableInput(e.target.value);
                                    }}
                                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full"
                                />
                            </div>
                            
                            {/* Color Picker */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-white text-sm">
                                    <Palette className="w-4 h-4" />
                                    <span>Drawing Color</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SWATCHES.map((swatch) => (
                                        <ColorSwatch
                                            key={swatch}
                                            color={swatch}
                                            isSelected={color === swatch}
                                            onClick={setColor}
                                            size={32}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    onClick={handleReset}
                                    variant="outline"
                                    className="border-red-400/30 hover:border-red-400/50 text-red-300"
                                >
                                    <RefreshCw className="mr-2 w-4 h-4" />
                                    Reset
                                </Button>
                                <Button
                                    onClick={submitDrawing}
                                    disabled={loading}
                                    variant="success"
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                    ) : (
                                        <Upload className="mr-2 w-4 h-4" />
                                    )}
                                    {loading ? 'Processing...' : 'Calculate'}
                                </Button>
                            </div>
                            
                            {/* Variables Display */}
                            {Object.keys(dictOfVars).length > 0 && (
                                <div className="p-3 bg-black/20 rounded-lg">
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
                    ) : (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 mx-4">
                            <div className="flex flex-wrap items-center gap-4 justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="bg-gradient-to-br from-blue-400 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg w-10 h-10 text-xl">
                                        A
                                    </div>
                                    <h1 className="font-bold text-white text-2xl">Aryan's AI Calculator</h1>
                                </div>
                                <div className="flex flex-wrap items-center gap-4">
                                    <Select
                                        options={SUBJECTS}
                                        value={subject}
                                        onChange={setSubject}
                                        className="w-40"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Variables: x=5, y=10"
                                        value={varInput}
                                        onChange={(e) => {
                                            setVarInput(e.target.value);
                                            handleVariableInput(e.target.value);
                                        }}
                                        className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {SWATCHES.map((swatch) => (
                                            <ColorSwatch
                                                key={swatch}
                                                color={swatch}
                                                isSelected={color === swatch}
                                                onClick={setColor}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={handleReset}
                                            variant="outline"
                                            className="border-red-400/30 hover:border-red-400/50 text-red-300"
                                        >
                                            <RefreshCw className="mr-2 w-4 h-4" />
                                            Reset
                                        </Button>
                                        <Button
                                            onClick={submitDrawing}
                                            disabled={loading}
                                            variant="success"
                                        >
                                            {loading ? (
                                                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                                            ) : (
                                                <Upload className="mr-2 w-4 h-4" />
                                            )}
                                            {loading ? 'Processing...' : 'Calculate'}
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Variables Display (desktop) */}
                                {Object.keys(dictOfVars).length > 0 && (
                                    <div className="w-full mt-4 p-3 bg-black/20 rounded-lg">
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
                        </div>
                    )}
                </div>
            )}

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                className={`absolute cursor-crosshair touch-none select-none ${
                    isMobile 
                        ? 'top-0 left-0 w-full h-full' 
                        : 'top-0 left-0 w-full'
                }`}
                style={{ 
                    height: isMobile ? '100vh' : 'calc(100vh - 120px)',
                    marginTop: isMobile ? 0 : '120px',
                    imageRendering: 'pixelated',
                    touchAction: 'none',
                    zIndex: 10
                }}
            />

            {/* Results Panel */}
            {(results.length > 0 || error) && (
                <div className={`${
                    isMobile 
                        ? 'fixed bottom-4 left-4 right-4 max-h-64' 
                        : 'fixed top-32 right-4 max-w-md max-h-96'
                } bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 overflow-y-auto z-30`}>
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
                                            {results.map((result: Response, index: number) => (
                                                <div key={index} className="bg-black/20 rounded-lg p-3">
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
                                                            {result.steps.map((step: Step, stepIndex: number) => (
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
            )}
        </div>
    );
}
