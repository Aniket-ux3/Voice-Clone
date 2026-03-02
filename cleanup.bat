@echo off
echo ============================================================
echo  voice_clone_project - Cleanup Script
echo  Removes temp files and dev docs not needed to run the app
echo ============================================================
echo.

set ROOT=%~dp0

:: ── 1. Loose temp WAV files in root ──────────────────────────
echo [1/5] Removing temp WAV files from root...
del /f /q "%ROOT%base_gen.wav"
del /f /q "%ROOT%final_authenticated.wav"
del /f /q "%ROOT%final_output.wav"
del /f /q "%ROOT%input_normalized.wav"
del /f /q "%ROOT%raw_output.wav"
del /f /q "%ROOT%ref_converted.wav"
del /f /q "%ROOT%verify_converted.wav"

:: ── 2. Dev/doc markdown files (README.md is kept) ────────────
echo [2/5] Removing dev documentation files...
del /f /q "%ROOT%ARCHITECTURE.md"
del /f /q "%ROOT%BUILD_ERROR_FIX.md"
del /f /q "%ROOT%CHECKLIST.md"
del /f /q "%ROOT%DOCS_INDEX.md"
del /f /q "%ROOT%FINAL_BUILD_SUMMARY.md"
del /f /q "%ROOT%INTEGRATION_COMPLETE.md"
del /f /q "%ROOT%PROJECT_CONTEXT.md"
del /f /q "%ROOT%QUICK_REFERENCE.md"
del /f /q "%ROOT%QUICK_START.md"
del /f /q "%ROOT%SETUP_GUIDE.md"
del /f /q "%ROOT%SHARING_CHECKLIST.md"

:: ── 3. Old Streamlit app (superseded by api_server.py) ───────
echo [3/5] Removing old Streamlit app...
del /f /q "%ROOT%app.py"

:: ── 4. Root-level package.json / package-lock.json ───────────
::    (frontend\ has its own — these are shadcn install leftovers)
echo [4/5] Removing root-level package files...
del /f /q "%ROOT%package.json"
del /f /q "%ROOT%package-lock.json"
del /f /q "%ROOT%verify_setup.bat"
del /f /q "%ROOT%quick-start.bat"
del /f /q "%ROOT%quick-start.sh"

:: ── 5. Temp session files in uploads\, outputs\, processed\ ──
echo [5/5] Clearing temp session files...

:: uploads\ — all except .gitkeep
for %%f in ("%ROOT%uploads\*") do (
    if /i not "%%~nxf"==".gitkeep" del /f /q "%%f"
)

:: outputs\ — all except .gitkeep
for %%f in ("%ROOT%outputs\*") do (
    if /i not "%%~nxf"==".gitkeep" del /f /q "%%f"
)

:: processed\ — remove all session subdirectories entirely
for /d %%d in ("%ROOT%processed\*") do (
    rmdir /s /q "%%d"
)

:: ── Done ──────────────────────────────────────────────────────
echo.
echo ============================================================
echo  Cleanup complete! Delete this cleanup.bat file when done.
echo ============================================================
echo.
pause
