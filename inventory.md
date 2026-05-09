# AICalc Project Inventory

This document lists every file in the project, its purpose, and the impact of its removal.

## Root Directory
- **README.md**: The main entry point for documentation. Explains how to setup and run the whole project. 
  - *Why kept*: Essential for anyone (including you) to understand the project structure later.
  - *Impact of removal*: No guidance for new developers; hard to know how to start.
- **.gitignore**: Tells Git which files to ignore (like `node_modules`, `.env`, `venv`).
  - *Why kept*: Prevents accidental commits of massive or sensitive files.
  - *Impact of removal*: Repository will be cluttered with thousands of dependency files.

## Backend (`calc-be`)
- **.env / .env.example**: Configuration for API keys and environment variables.
  - *Why kept*: Required for Gemini API authentication.
  - *Impact of removal*: App will crash as it won't find the API key.
- **constants.py**: Shared configuration values like API keys and model names.
  - *Why kept*: Prevents hardcoding values across multiple files.
  - *Impact of removal*: Breaks imports in `main.py` and `utils.py`.
- **gunicorn_config.py**: Configuration for the production web server.
  - *Why kept*: Required for stable deployment on Render/Heroku.
  - *Impact of removal*: Deployment might fail or be unstable under load.
- **main.py**: The main entry point for the FastAPI application.
  - *Why kept*: It starts the server and mounts the routes.
  - *Impact of removal*: The backend literally won't exist.
- **Procfile**: Command that Render/Heroku runs to start the app.
  - *Why kept*: Required for deployment.
  - *Impact of removal*: App won't start on Render.
- **render.yaml**: Render-specific deployment configuration.
  - *Why kept*: Automates the creation of web and static services on Render.
  - *Impact of removal*: Manual setup on Render would be required.
- **requirements.txt**: List of Python dependencies (FastAPI, Google GenAI, etc.).
  - *Why kept*: Tells the system what to install.
  - *Impact of removal*: Dependencies won't be installed; app won't run.
- **runtime.txt**: Specifies the Python version.
  - *Why kept*: Ensures the correct Python version is used on the server.
  - *Impact of removal*: Server might use an incompatible Python version.
- **schema.py**: Pydantic models for data validation.
  - *Why kept*: Validates the JSON sent from the frontend.
  - *Impact of removal*: `route.py` will fail to import models; API calls will error.
- **apps/calculator/route.py**: Defines the `/calculate` API endpoint.
    - *Why kept*: Handles the logic of receiving images and returning results.
    - *Impact of removal*: The "Solve" functionality will stop working.
- **apps/calculator/utils.py**: Integration logic for Google Gemini.
    - *Why kept*: It's where the AI prompt is built and the image is processed.
    - *Impact of removal*: The AI won't be able to "see" or solve your sketches.

## Frontend (`calc-fe`)
- **.env.example**: Template for frontend environment variables.
  - *Why kept*: Useful for setting up the API base URL if needed.
  - *Impact of removal*: Minor inconvenience during setup.
- **eslint.config.js**: Rules for code quality and bug prevention.
  - *Why kept*: Helps maintain clean code during development.
  - *Impact of removal*: Development becomes harder; potential for more bugs.
- **index.html**: The main HTML file that hosts the React app.
  - *Why kept*: The foundation of the web page.
  - *Impact of removal*: No website.
- **package.json / package-lock.json**: Lists JavaScript dependencies (React, Vite, etc.).
  - *Why kept*: Essential for installing libraries.
  - *Impact of removal*: You can't run or build the frontend.
- **tsconfig.*.json**: TypeScript configuration files.
  - *Why kept*: Configures how the code is compiled to JavaScript.
  - *Impact of removal*: Compilation errors; code won't run.
- **vercel.json**: Configuration for Vercel deployment (backup).
  - *Why kept*: Useful if you ever want to switch from Render to Vercel.
  - *Impact of removal*: Loss of deployment configuration for Vercel.
- **vite.config.ts**: Configures the Vite build tool and development proxy.
  - *Why kept*: Connects the frontend to the backend during local development.
  - *Impact of removal*: Frontend won't be able to talk to the backend locally.
- **public/favicon.svg**: The icon that appears in the browser tab.
  - *Why kept*: Adds professional polish to the app.
  - *Impact of removal*: Default "missing icon" will show in browser.
- **src/App.tsx**: The core logic of the application (Drawing, State, API calls).
  - *Why kept*: This IS the application.
  - *Impact of removal*: No app.
- **src/index.css**: All the styling (B&W theme, CRT effect, overlays).
  - *Why kept*: Provides the retro aesthetic you requested.
  - *Impact of removal*: The app will look like plain 1990s HTML.
- **src/main.tsx**: Bootstraps the React application.
  - *Why kept*: Standard React entry point.
  - *Impact of removal*: App won't start.
- **src/vite-env.d.ts**: Type definitions for Vite features.
  - *Why kept*: Fixes TypeScript warnings for environment variables.
  - *Impact of removal*: Annoying TypeScript errors in your editor.
