import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, RotateCcw, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  audioUrl: string;
  onRegenerate?: () => void;
}

// Deterministic waveform heights — sine-based, never re-randomised on render
function makeWaveformShape(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    20 + Math.abs(Math.sin(i * 0.31 + 0.9) * 30 + Math.sin(i * 0.13) * 20)
  );
}

// 60 bars total; on mobile (< sm) the last 20 are hidden via CSS
const WAVEFORM_COUNT = 60;
const WAVEFORM_SHAPE = makeWaveformShape(WAVEFORM_COUNT);

const AudioPlayer = ({ audioUrl, onRegenerate }: AudioPlayerProps) => {
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [isMuted,     setIsMuted]     = useState(false);
  const [loadError,   setLoadError]   = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset state when audio source changes (e.g. after regeneration)
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => { setDuration(audio.duration); setLoadError(false); };
    const onEnd  = () => setIsPlaying(false);
    const onErr  = () => { setIsPlaying(false); setLoadError(true); };
    audio.addEventListener("timeupdate",     onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended",          onEnd);
    audio.addEventListener("error",          onErr);
    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended",          onEnd);
      audio.removeEventListener("error",          onErr);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => { setIsPlaying(false); setLoadError(true); });
      setIsPlaying(true);
    }
  };

  const handleSeek = (v: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = v[0];
    setCurrentTime(v[0]);
  };

  const handleVolumeChange = (v: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = v[0];
    setVolume(v[0]);
    setIsMuted(v[0] === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      const r = volume || 0.5;
      audio.volume = r;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (t: number) => {
    if (!isFinite(t) || isNaN(t)) return "0:00";
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "generated-voice.wav";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="glass-card p-4 sm:p-5 animate-scale-in">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Load error banner */}
      {loadError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20 mb-3 animate-fade-in-up">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive mb-0.5">Playback error</p>
            <p className="text-xs text-muted-foreground">Could not load audio. Try downloading instead.</p>
          </div>
        </div>
      )}

      {/*
        Waveform visualisation
        ─────────────────────
        Container is h-16 on mobile, h-20 on sm+. Each bar's height is a
        percentage of the container, giving a tall, prominent visualisation.
        On mobile (< sm) we hide the last 20 bars to avoid cramping — the
        remaining 40 bars still fill the full width cleanly.
      */}
      <div className="flex items-center justify-center gap-[2px] h-16 sm:h-20 mb-5 px-1 overflow-hidden">
        {WAVEFORM_SHAPE.map((h, i) => {
          const isActive = (i / WAVEFORM_COUNT) <= progress;
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors duration-100 shrink-0 ${
                /* hide last 20 bars on small screens */
                i >= 40 ? "hidden sm:block" : ""
              } ${
                isActive
                  ? "bg-gradient-to-t from-primary via-secondary to-accent"
                  : "bg-muted-foreground/20"
              }`}
              style={{
                height: `${h}%`,
                opacity: isPlaying && isActive ? 1 : 0.75,
              }}
            />
          );
        })}
      </div>

      {/* Seek bar + timestamps */}
      <div className="mb-4">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
          disabled={loadError}
        />
        <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-1.5">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2">

        {/* Volume (hidden on xs, shown from sm up) */}
        <div className="hidden sm:flex items-center gap-1.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="h-9 w-9 shrink-0"
            disabled={loadError}
          >
            {isMuted
              ? <VolumeX className="w-4 h-4 text-muted-foreground" />
              : <Volume2 className="w-4 h-4 text-muted-foreground" />}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20"
            disabled={loadError}
          />
        </div>

        {/* Play / Pause — central, large */}
        <Button
          onClick={togglePlayback}
          disabled={loadError}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="h-14 w-14 rounded-full gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isPlaying
            ? <Pause className="w-6 h-6 text-foreground" />
            : <Play  className="w-6 h-6 text-foreground ml-0.5" />}
        </Button>

        {/* Regenerate + Download */}
        <div className="flex items-center gap-1.5">
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              aria-label="Regenerate"
              className="h-9 w-9 hover:bg-primary/20"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            aria-label="Download audio"
            className="h-9 w-9 hover:bg-success/20"
          >
            <Download className="w-4 h-4 text-success" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
