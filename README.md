# AI Calculator - Multi-Subject Problem Solver

A powerful AI-powered calculator that can solve problems across multiple subjects using image analysis and drawing recognition.

## Features

### 🧮 **Mathematics**
- Basic arithmetic operations (+, -, *, /)
- Algebraic equations and systems of equations
- Variable assignments and calculations
- Graphical math problems
- Abstract concept recognition

### ⚡ **Physics**
- Force, mass, and acceleration calculations (F = ma)
- Energy equations (E = mc²)
- Velocity and displacement problems (v = d/t)
- Free body diagrams analysis
- Circuit diagrams and electrical problems
- Projectile motion and collisions

### 🧪 **Chemistry**
- Molar calculations (n = m/M)
- Concentration problems (c = n/V)
- pH calculations (pH = -log[H+])
- Gas law equations (PV = nRT)
- Molecular structure analysis
- Chemical equation balancing
- Titration curves and stoichiometry

### 🔬 **General Science**
- Density calculations (ρ = m/V)
- Speed and velocity problems
- Pressure and force relationships (P = F/A)
- Energy and work calculations (E = mgh)
- Food webs and ecosystem diagrams
- Water cycle and geological processes
- Cell structures and biological systems

## How It Works

1. **Select Subject**: Choose from Math, Physics, Chemistry, or General Science
2. **Draw Your Problem**: Use the drawing canvas to sketch equations, diagrams, or problems
3. **AI Analysis**: Our AI analyzes your drawing and identifies the problem type
4. **Smart Solutions**: Get step-by-step solutions with proper variable handling
5. **Variable Management**: Assign and reuse variables across multiple problems

## Technology Stack

- **Backend**: FastAPI with Python
- **Frontend**: React with TypeScript
- **AI Model**: Google Gemini 2.5 Pro
- **Drawing**: HTML5 Canvas with color support
- **Math Rendering**: MathJax for LaTeX display

## Installation

### Backend Setup
```bash
cd calc-be
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Setup
```bash
cd calc-fe
npm install
```

### Environment Variables
Create `.env.local` in `calc-fe/`:
```env
VITE_API_URL=http://localhost:8000/calculate
```

Create `.env` in `calc-be/`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Usage Examples

### Physics Problem
Draw a free body diagram with forces labeled, and the AI will:
- Identify the forces and their directions
- Apply Newton's laws
- Calculate net force and acceleration

### Chemistry Problem
Draw a molecular structure or chemical equation, and the AI will:
- Identify reactants and products
- Balance the equation
- Calculate stoichiometric relationships

### Math Problem
Draw any mathematical expression, and the AI will:
- Follow PEMDAS order of operations
- Solve step by step
- Handle variables and assignments

## API Endpoints

- `POST /calculate` - Process images and solve problems
  - Body: `{ image: base64_string, dict_of_vars: {}, subject: "math|physics|chemistry|science" }`
  - Response: `{ message: string, data: Array, status: string }`

## Contributing

Feel free to contribute by:
- Adding new subject areas
- Improving AI prompts
- Enhancing the drawing interface
- Adding new calculation types

## License

This project is open source and available under the MIT License.
