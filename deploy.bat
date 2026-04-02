@echo off
setlocal
title Deploy to AWS EC2

set PEM_KEY=D:\Codes\english_learn\myrsa2.pem
set EC2_USER=ec2-user
set EC2_IP=13.55.100.227
set REMOTE_DIR=/home/ec2-user/english_learn
set PACKAGE=english_learn_deploy.tar.gz

echo ============================================
echo   Deploy to EC2 %EC2_IP%
echo ============================================
echo.

:: Step 1: Build frontend
echo [1/4] Building frontend...
cd /d D:\Codes\english_learn\web
call npm run build
if errorlevel 1 (
    echo [FAIL] Frontend build failed.
    goto :error
)
echo [OK] Frontend built.
echo.

:: Step 2: Package project (exclude unnecessary files)
echo [2/4] Packaging project...
cd /d D:\Codes\english_learn
tar -czf %PACKAGE% ^
  --exclude=".git" ^
  --exclude=".gitignore" ^
  --exclude="web/node_modules" ^
  --exclude="web/dist" ^
  --exclude="eng-learn/bin" ^
  --exclude="eng-learn/obj" ^
  --exclude="data" ^
  --exclude="*.bat" ^
  --exclude="*.tar.gz" ^
  --exclude="migrate.js" ^
  .
if errorlevel 1 (
    echo [FAIL] Packaging failed.
    goto :error
)
echo [OK] Packaged to %PACKAGE%.
echo.

:: Step 3: Upload to EC2
echo [3/4] Uploading to EC2 (this may take a minute)...
scp -i "%PEM_KEY%" -o StrictHostKeyChecking=no %PACKAGE% %EC2_USER%@%EC2_IP%:~/
if errorlevel 1 (
    echo [FAIL] Upload failed. Check your network and PEM key.
    goto :error
)
echo [OK] Upload done.
echo.

:: Step 4: Deploy on EC2
echo [4/4] Deploying on EC2...
ssh -i "%PEM_KEY%" -o StrictHostKeyChecking=no %EC2_USER%@%EC2_IP% "mkdir -p %REMOTE_DIR% && tar -xzf ~/%PACKAGE% -C %REMOTE_DIR% && cd %REMOTE_DIR% && docker-compose down && docker-compose up -d --build && rm ~/%PACKAGE%"
if errorlevel 1 (
    echo [FAIL] Remote deploy failed. SSH in and check logs:
    echo   ssh -i "%PEM_KEY%" %EC2_USER%@%EC2_IP%
    echo   cd %REMOTE_DIR% ^&^& docker-compose logs
    goto :error
)
echo.

:: Cleanup local package
del %PACKAGE% 2>nul

echo ============================================
echo  [DONE] Visit http://%EC2_IP%
echo ============================================
goto :end

:error
del %PACKAGE% 2>nul
echo.
echo Deploy failed. See error above.
pause
exit /b 1

:end
pause
