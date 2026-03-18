@echo off
setlocal

set "NODE_DIR=C:\Program Files\nodejs"
set "NPM_GLOBAL=%APPDATA%\npm"
set "PATH=%NODE_DIR%;%NPM_GLOBAL%;%PATH%"

cd /d E:\MyLab-Studio

:: pm2 resurrect: 저장된 프로세스 목록 복원
"%APPDATA%\npm\pm2.cmd" resurrect

endlocal
