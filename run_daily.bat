@echo off
REM run_daily.bat - Jalankan scraper + processor harian
REM Dipanggil oleh Windows Task Scheduler tiap pagi (default jam 09:00)

setlocal
set "PROJDIR=C:\Users\agral\.gemini\antigravity\scratch\micro-cpi"
cd /d "%PROJDIR%"

echo ==========================================
echo Micro CPI Daily Update - %DATE% %TIME%
echo ==========================================

call "%PROJDIR%\venv\Scripts\activate.bat"

REM Hari biasa: cukup tarik 3 hari ke belakang (kasih buffer untuk data yang telat masuk PIHPS)
REM scraper.py juga otomatis mengekspor frontend/data.json setelah selesai
python scraper.py 3
if errorlevel 1 (
    echo [ERROR] scraper.py gagal.
    exit /b 1
)

echo ==========================================
echo Selesai - %DATE% %TIME%
echo ==========================================
endlocal
