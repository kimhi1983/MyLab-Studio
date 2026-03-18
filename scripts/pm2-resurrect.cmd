@echo off
setlocal

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "PM2_BIN=C:\Users\user\AppData\Roaming\npm\node_modules\pm2\bin\pm2"
set "PATH=C:\Program Files\nodejs;C:\Users\user\AppData\Roaming\npm;%PATH%"

cd /d E:\MyLab-Studio

:: pm2 저장된 프로세스 목록 복원
echo [pm2-resurrect] 프로세스 복원 시작...
"%NODE_EXE%" "%PM2_BIN%" resurrect

echo [pm2-resurrect] 완료
"%NODE_EXE%" "%PM2_BIN%" list

endlocal
