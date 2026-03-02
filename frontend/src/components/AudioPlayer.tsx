import { useState, useRef, useEffect } from "react";
import { Play, Pause, Download, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface AudioPlayerProps {
  audioUrl: string;
  onRegenerate?: () => void;
}

const AudioPlayer = ({ audioUrl, onRegenerate }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    const newVolume = value[0];
    audioRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = audioUrl;
    link.download = "generated-voice.mp3";
    link.click();
  };

  return (
    <div className="glass-card p-6 animate-scale-in">
      <audio ref={audioRef} src={audioUrl} />

      {/* Waveform visualization */}
      <div className="flex items-center justify-center gap-0.5 h-16 mb-6 px-4">
        {Array.from({ length: 60 }).map((_, i) => {
          const progress = duration > 0 ? currentTime / duration : 0;
          const barProgress = i / 60;
          const isActive = barProgress <= progress;
          
          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-100 ${
                isActive
                  ? "bg-gradient-to-t from-primary via-secondary to-accent"
                  : "bg-muted-foreground/20"
              }`}
              style={{
                height: `${20 + Math.sin(i * 0.3) * 30 + Math.random() * 30}%`,
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
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Volume control */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            className="h-9 w-9"
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
          />
        </div>

        {/* Play button */}
        <Button
          onClick={togglePlayback}
          className="h-14 w-14 rounded-full gradient-bg hover:opacity-90 transition-all glow"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-foreground" />
          ) : (
            <Play className="w-6 h-6 text-foreground ml-1" />
          )}
        </Button>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRegenerate}
              className="h-9 w-9 hover:bg-primary/20"
            >
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
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
