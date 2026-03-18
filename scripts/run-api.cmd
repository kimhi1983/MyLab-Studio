@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "PM2_BIN=C:\Users\user\AppData\Roaming\npm\node_modules\pm2\bin\pm2"
set "PATH=C:\Program Files\nodejs;C:\Users\user\AppData\Roaming\npm;%PATH%"

cd /d E:\MyLab-Studio

:: pm2로 기동 (이미 있으면 restart, 없으면 start)
"%NODE_EXE%" "%PM2_BIN%" describe mylab-api >nul 2>&1
if errorlevel 1 (
    echo [run-api] mylab-api 신규 시작...
    "%NODE_EXE%" "%PM2_BIN%" start server/index.js --name mylab-api --cwd E:\MyLab-Studio\server
) else (
    echo [run-api] mylab-api 재시작...
    "%NODE_EXE%" "%PM2_BIN%" restart mylab-api
)

"%NODE_EXE%" "%PM2_BIN%" list

endlocal
