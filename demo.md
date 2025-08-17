# Demo Guide - Multi-Subject AI Calculator

## Testing the New Features

### 1. **Mathematics Mode** (Default)
- Draw simple equations like: `2 + 3 * 4`
- Draw algebraic expressions: `x^2 + 2x + 1 = 0`
- Draw variable assignments: `x = 5`

### 2. **Physics Mode**
- Draw force diagrams: `F = ma` with labeled forces
- Draw velocity problems: `v = d/t`
- Draw energy equations: `E = mc²`
- Draw circuit diagrams with components

### 3. **Chemistry Mode**
- Draw molecular structures (H₂O, CO₂)
- Draw chemical equations: `2H₂ + O₂ → 2H₂O`
- Draw concentration problems: `c = n/V`
- Draw pH calculations: `pH = -log[H+]`

### 4. **General Science Mode**
- Draw food webs with arrows
- Draw water cycle diagrams
- Draw cell structures
- Draw geological processes

## How to Test

1. **Start the Backend**:
   ```bash
   cd calc-be
   python main.py
   ```

2. **Start the Frontend**:
   ```bash
   cd calc-fe
   npm run dev
   ```

3. **Select Subject**: Use the dropdown to choose your subject

4. **Draw Your Problem**: Use the canvas to sketch equations/diagrams

5. **Click Run**: Watch the AI analyze and solve your problem

## Expected Results

- **Math**: Solutions with PEMDAS order, variable assignments
- **Physics**: Force calculations, energy equations, motion problems
- **Chemistry**: Chemical equations, stoichiometry, pH calculations
- **Science**: Biological diagrams, geological processes, ecosystem interactions

## Tips for Best Results

- Use clear, bold lines when drawing
- Label variables and units clearly
- Use different colors for different elements
- Keep drawings simple and focused
- Include relevant text labels when possible

## Troubleshooting

- If the AI doesn't recognize your drawing, try making it larger
- Ensure your Gemini API key is set correctly
- Check that the backend is running on the correct port
- Verify the frontend environment variables are set
