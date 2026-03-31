import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, Download, RotateCcw, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  audioUrl: string;
  onRegenerate?: () => void;
}

// Pre-generate stable waveform shape — deterministic, never re-randomised
// on re-renders. Gives each bar a visually natural sine-based height.
function makeWaveformShape(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    20 + Math.abs(Math.sin(i * 0.31 + 0.9) * 30 + Math.sin(i * 0.13) * 20),
  );
}

const WAVEFORM_COUNT  = 60;
const WAVEFORM_SHAPE  = makeWaveformShape(WAVEFORM_COUNT);

const AudioPlayer = ({ audioUrl, onRegenerate }: AudioPlayerProps) => {
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(1);
  const [isMuted,     setIsMuted]     = useState(false);
  const [loadError,   setLoadError]   = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset state whenever the audio source changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(false);
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate   = () => setCurrentTime(audio.currentTime);
    const onLoadedMeta   = () => { setDuration(audio.duration); setLoadError(false); };
    const onEnded        = () => setIsPlaying(false);
    const onError        = () => { setIsPlaying(false); setLoadError(true); };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended",          onEnded);
    audio.addEventListener("error",          onError);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("error",          onError);
    };
  }, []);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {
        setIsPlaying(false);
        setLoadError(true);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = value[0];
    audio.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      const restored = volume || 0.5;
      audio.volume = restored;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (t: number) => {
    if (!isFinite(t) || isNaN(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = "generated-voice.wav";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="glass-card p-6 animate-scale-in">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Load error fallback — user-friendly, never a raw browser error */}
      {loadError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/8 border border-destructive/20 mb-4 animate-fade-in-up">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive mb-0.5">Playback error</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Could not load the audio. Try downloading the file and playing it locally.
            </p>
          </div>
        </div>
      )}

      {/* Waveform visualisation — stable shape, progress-tinted */}
      <div className="flex items-center justify-center gap-0.5 h-16 mb-6 px-4">
        {WAVEFORM_SHAPE.map((h, i) => {
          const barProgress = i / WAVEFORM_COUNT;
          const isActive = barProgress <= progress;
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-colors duration-100 ${
                isActive
                  ? "bg-gradient-to-t from-primary via-secondary to-accent"
                  : "bg-muted-foreground/20"
              }`}
              style={{
                height: `${h}%`,
                opacity: isPlaying && isActive ? 1 : 0.8,
              }}
            />
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="cursor-pointer"
          disabled={loadError}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Volume */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            className="h-9 w-9"
            disabled={loadError}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            )}
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

        {/* Play / Pause */}
        <Button
          onClick={togglePlayback}
          disabled={loadError}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="h-14 w-14 rounded-full gradient-bg hover:opacity-90 transition-all glow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-foreground" />
          ) : (
            <Play className="w-6 h-6 text-foreground ml-1" />
          )}
        </Button>

        {/* Regenerate / Download */}
        <div className="flex items-center gap-2">
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
