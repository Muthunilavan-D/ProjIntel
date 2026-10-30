@echo off
title PROJINTEL - AI-Assisted Academic Project Management System
echo =====================================================================
echo  PROJINTEL - Presentation & Production Launcher
echo =====================================================================
echo.
echo Starting Backend API Server (Port 5000)...
start "PROJINTEL Backend (Node/Express)" cmd /k "cd /d %~dp0server && node server.js"

echo Waiting 3 seconds for Backend Server to initialize...
timeout /t 3 /nobreak >nul

echo Starting Frontend UI Dev Server (Port 5173)...
start "PROJINTEL Frontend (Vite/React)" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo =====================================================================
echo  Services started successfully!
echo  - Frontend Portal: http://localhost:5173
echo  - Backend API:     http://localhost:5000
echo =====================================================================
echo.
echo Opening browser to http://localhost:5173 ...
timeout /t 2 /nobreak >nul
start http://localhost:5173
