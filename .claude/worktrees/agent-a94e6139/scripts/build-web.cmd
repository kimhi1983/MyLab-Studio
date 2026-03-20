@echo off
setlocal

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if exist "%NODE_EXE%" goto run

set "NODE_EXE=node"

:run
set "PATH=%ProgramFiles%\nodejs;%PATH%"
cd /d "%~dp0.."
"%NODE_EXE%" node_modules\vite\bin\vite.js build

