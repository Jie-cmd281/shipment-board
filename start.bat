@echo off
cd /d "%~dp0"
echo [%date% %time%] starting shipment-board >> service.log
"C:\Program Files\nodejs\node.exe" server.js >> service.log 2>&1
