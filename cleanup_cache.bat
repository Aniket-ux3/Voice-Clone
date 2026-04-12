@echo off
echo Cleaning stale SE embedding cache and corrupt emotion wavs...

REM Delete the processed/ SE cache — stale embeddings from old (broken) pipeline
if exist "processed\" (
    rmdir /s /q "processed"
    echo [OK] Deleted processed\ cache
) else (
    echo [--] processed\ not found, skipping
)

REM Delete all emotion wavs so _generate_emotion_wavs() rebuilds them on startup
REM The current ones were generated with TTS-only prosody, which is fine,
REM but we want them rebuilt after any pipeline changes for consistency.
for %%f in (emotions\neutral.wav emotions\happy.wav emotions\sad.wav emotions\angry.wav emotions\jolly.wav emotions\anxious.wav) do (
    if exist "%%f" (
        del "%%f"
        echo [OK] Deleted %%f
    )
)

echo.
echo Done. Restart the server now — emotion wavs will be regenerated at boot.
pause
