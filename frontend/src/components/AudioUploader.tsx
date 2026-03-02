import { useState, useRef, useCallback } from "react";
import { Upload, Music, Play, Pause, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioUploaderProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  label?: string;
  inputId?: string;
}

const AudioUploader = ({ onFileSelect, file, label = "Upload Audio Sample", inputId = "audio-upload" }: AudioUploaderProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith("audio/")) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    onFileSelect(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setAudioUrl(url);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleRemove = () => {
    onFileSelect(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setIsPlaying(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={handleInputChange}
        className="hidden"
        id={inputId}
      />
      
      {!file ? (
        <label
          htmlFor={inputId}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`upload-zone flex flex-col items-center justify-center cursor-pointer min-h-[180px] ${
            isDragOver ? "drag-over" : ""
          }`}
        >
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            {isDragOver && (
              <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            )}
          </div>
          <p className="text-foreground font-medium mb-1">{label}</p>
          <p className="text-muted-foreground text-sm">
            Drag & drop or click to browse
          </p>
          <p className="text-muted-foreground/60 text-xs mt-2">
            Supports WAV, MP3, M4A
          </p>
        </label>
      ) : (
        <div className="glass-card p-5 animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{file.name}</p>
              <p className="text-muted-foreground text-sm">
                {formatFileSize(file.size)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayback}
                className="h-10 w-10 rounded-full bg-primary/20 hover:bg-primary/30"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-primary" />
                ) : (
                  <Play className="w-5 h-5 text-primary ml-0.5" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemove}
                className="h-10 w-10 rounded-full hover:bg-destructive/20"
              >
                <X className="w-5 h-5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>

          {/* Waveform visualization placeholder */}
          <div className="mt-4 flex items-center justify-center gap-1 h-12">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className={`waveform-bar transition-all duration-150 ${
                  isPlaying ? "animate-wave" : ""
                }`}
                style={{
                  height: `${Math.random() * 100}%`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: isPlaying ? 1 : 0.4,
                }}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-success">
            <Check className="w-3.5 h-3.5" />
            <span>Sample uploaded successfully</span>
          </div>

          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onEnded={handleAudioEnded}
              className="hidden"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
