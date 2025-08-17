# AI Calculator Frontend

A modern, responsive React frontend for the AI Calculator that processes mathematical expressions from hand-drawn images using AI.

## 🚀 Features

- **✏️ Drawing Interface**: Intuitive canvas for hand-drawing mathematical expressions
- **🧠 AI-Powered**: Processes drawings using Google Gemini AI through the backend API
- **📚 Multi-Subject Support**: 
  - Mathematics
  - Physics 
  - Chemistry
  - General Science
- **🔢 Variable Support**: Set and reuse variables across calculations
- **📊 Step-by-Step Solutions**: View detailed solution steps
- **🎨 Modern UI**: Glass-morphism design with smooth animations
- **📱 Responsive**: Works on desktop, tablet, and mobile devices
- **⚡ Real-time**: Live variable updates and result display
- **🎯 Draggable Results**: Move result panels around the screen

## 🛠️ Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Mantine UI** components
- **Lucide React** icons
- **Axios** for API communication
- **React Router** for navigation
- **MathJax** for mathematical rendering

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- AI Calculator Backend running (see backend README)

## 🔧 Installation

1. **Clone and navigate to frontend directory:**
   ```bash
   cd calc-fe
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment setup:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   ```env
   VITE_API_URL=http://localhost:8900
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open in browser:**
   Visit `http://localhost:5173`

## 🎯 Usage Guide

### Basic Usage
1. **Select Subject**: Choose from Math, Physics, Chemistry, or General Science
2. **Set Variables** (optional): Enter variables like `x=5, y=10` in the input field
3. **Choose Color**: Select drawing color from the palette
4. **Draw**: Draw your mathematical expression on the black canvas
5. **Calculate**: Click the "Calculate" button to process your drawing
6. **View Results**: Results appear in a draggable panel

### Advanced Features

#### Variable System
- Enter variables in format: `x=5, y=10, z=3.14`
- Variables are automatically updated when assignments are detected
- Use variables across multiple calculations in the same session

#### Subject-Specific Processing
Each subject has optimized processing:
- **Math**: Basic arithmetic, algebra, calculus, geometry
- **Physics**: Force calculations, energy equations, motion problems
- **Chemistry**: Chemical equations, stoichiometry, pH calculations  
- **Science**: General scientific calculations and unit conversions

#### Drawing Tips
- Use white or light colors for better recognition
- Draw clearly with adequate spacing
- For fractions, draw the fraction line clearly
- Exponents should be clearly positioned above the base

## 🎨 UI Components

### Main Interface
- **Header Panel**: Controls and settings
- **Canvas**: Full-screen drawing area
- **Results Panel**: Draggable results display
- **Instructions**: Quick usage guide

### Interactive Elements
- **Color Palette**: 12 predefined colors for drawing
- **Subject Selector**: Dropdown for subject selection
- **Variable Input**: Text field for variable definitions
- **Action Buttons**: Reset and Calculate with loading states

## 🚨 Error Handling

The application includes comprehensive error handling:

- **Network Errors**: Displays connection issues
- **API Errors**: Shows backend error messages
- **Validation Errors**: Highlights input problems
- **Error Boundary**: Catches and displays React errors
- **Loading States**: Visual feedback during processing

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/
│   │   └── button.tsx          # Reusable button component
│   └── ErrorBoundary.tsx       # Error boundary wrapper
├── screens/
│   └── home/
│       └── index.tsx           # Main calculator interface
├── lib/
│   └── utils.ts               # Utility functions
├── types/
│   ├── globals.d.ts           # Global type definitions
│   └── mathjax.d.ts          # MathJax type definitions
├── constants.ts               # App constants (colors, subjects)
├── App.tsx                   # Root component
├── main.tsx                  # React entry point
└── index.css                # Global styles and animations
```

## 🎨 Styling System

### Glass Morphism Design
- Semi-transparent panels with backdrop blur
- Smooth animations and transitions
- Gradient backgrounds
- Hover and focus states

### CSS Classes
- `.glass-panel`: Main glass effect panels
- `.glass-button`: Interactive buttons
- `.glass-input`: Form inputs
- `.solution-step`: Result display steps

### Responsive Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

## 🔧 Configuration

### Environment Variables
```env
VITE_API_URL=http://localhost:8900    # Backend API URL
```

### Build Configuration
- **Vite Config**: Module resolution and path aliases
- **TypeScript**: Strict typing with path mapping
- **Tailwind**: Custom utility classes and animations
- **ESLint**: Code quality and consistency

## 🚀 Building for Production

```bash
# Build the application
npm run build

# Preview the build
npm run preview

# Deploy the dist/ folder to your hosting service
```

### Build Optimization
- Code splitting and lazy loading
- Tree shaking for smaller bundles
- Asset optimization
- TypeScript compilation
- CSS purging and minification

## 🧪 Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

### Development Features
- Hot module replacement (HMR)
- TypeScript error checking
- ESLint integration
- Auto-formatting on save

## 🔗 API Integration

The frontend communicates with the backend through:

### POST `/calculate`
```typescript
interface CalculateRequest {
  image: string;              // Base64 encoded canvas image
  dict_of_vars: Record<string, number | string>;
  subject: 'math' | 'physics' | 'chemistry' | 'science';
}

interface CalculateResponse {
  message: string;
  status: 'success' | 'error' | 'warning';
  data: Array<{
    expr: string;
    result: string | number;
    assign?: boolean;
    steps?: Array<{
      explanation: string;
      latex: string;
    }>;
  }>;
}
```

## 🐛 Troubleshooting

### Common Issues

**Canvas not drawing:**
- Check if the canvas is properly initialized
- Verify mouse event handlers are attached
- Ensure canvas has proper dimensions

**API connection failed:**
- Verify backend is running on correct port
- Check VITE_API_URL in .env file
- Inspect network tab in browser dev tools

**MathJax not loading:**
- Check internet connection
- Verify CDN is accessible
- Clear browser cache

**Build errors:**
- Run `npm install` to ensure all dependencies
- Check TypeScript errors with `npm run lint`
- Verify all imports have correct paths

### Debug Mode
Set `NODE_ENV=development` to enable:
- Detailed error messages
- Console debugging
- Error boundary stack traces

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run lint`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- Use TypeScript for all new components
- Follow React best practices
- Implement proper error handling
- Add comments for complex logic
- Use semantic commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini AI for mathematical processing
- Mantine team for beautiful UI components
- Tailwind CSS for utility-first styling
- MathJax for mathematical rendering
- React team for the excellent framework

---

For backend setup and API documentation, see the `calc-be` README.
