@echo off
title English Learn - Backend

echo [1/2] Starting Redis...
start "Redis" "D:\Programs\Redis-x64-5.0.14.1\redis-server.exe"
echo [OK] Redis running on 127.0.0.1:6379
echo.

echo [2/2] Starting .NET backend...
echo  URL:     http://127.0.0.1:8090
echo  Swagger: http://127.0.0.1:8090/swagger
echo.
cd /d D:\Codes\english_learn\eng-learn
dotnet run --launch-profile http
pause
