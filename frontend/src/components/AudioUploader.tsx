import { useState, useRef, useCallback, useMemo } from "react";
import { Upload, Music, Play, Pause, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioUploaderProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  label?: string;
  inputId?: string;
}

// Accepted MIME types and extensions
const ACCEPTED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/flac"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function isAcceptedAudio(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    ACCEPTED_TYPES.includes(file.type) ||
    /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i.test(file.name)
  );
}

// Pre-generate stable waveform bar heights so they don't re-render on every
// React reconciliation pass (Math.random() inside JSX rerenders = jitter).
function makeBarHeights(count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    // Pseudo-random but deterministic per-index via sine hash
    out.push(20 + Math.abs(Math.sin(i * 2.4 + 1.3) * 70 + Math.sin(i * 0.7) * 30));
  }
  return out;
}

const WAVEFORM_HEIGHTS = makeBarHeights(40);

const AudioUploader = ({
  onFileSelect,
  file,
  label = "Upload Audio Sample",
  inputId = "audio-upload",
}: AudioUploaderProps) => {
  const [isDragOver, setIsDragOver]   = useState(false);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [fileError, setFileError]     = useState<string | null>(null);
  // Internal object URL owned by this component (separate from parent's copy)
  const audioUrlRef  = useRef<string | null>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const revokeUrl = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  };

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
    if (droppedFile) processFile(droppedFile);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const processFile = (selectedFile: File) => {
    setFileError(null);

    if (!isAcceptedAudio(selectedFile)) {
      setFileError("Unsupported format. Please upload a WAV, MP3, M4A, FLAC, or OGG file.");
      return;
    }
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setFileError("File is too large. Maximum size is 50 MB.");
      return;
    }

    revokeUrl();
    const url = URL.createObjectURL(selectedFile);
    audioUrlRef.current = url;
    setIsPlaying(false);
    onFileSelect(selectedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
    // Reset so the same file can be re-selected after removal
    e.target.value = "";
  };

  const handleRemove = () => {
    revokeUrl();
    setIsPlaying(false);
    setFileError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrlRef.current) return;

    // Lazily assign src so the browser doesn't start fetching until play
    if (!audio.src || audio.src !== audioUrlRef.current) {
      audio.src = audioUrlRef.current;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {
        // Autoplay blocked or decode error — fail silently, reset state
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => setIsPlaying(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <>
          <label
            htmlFor={inputId}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`upload-zone flex flex-col items-center justify-center cursor-pointer min-h-[180px] ${
              isDragOver ? "drag-over" : ""
            } ${fileError ? "border-destructive/50" : ""}`}
          >
            <div className="relative mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${
                fileError
                  ? "bg-destructive/15 border border-destructive/30"
                  : "bg-gradient-to-br from-primary/20 to-secondary/20"
              }`}>
                {fileError
                  ? <AlertCircle className="w-8 h-8 text-destructive" />
                  : <Upload className="w-8 h-8 text-primary" />
                }
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
              WAV · MP3 · M4A · FLAC · OGG — max 50 MB
            </p>
          </label>

          {/* File validation error — shown below the drop zone, never a raw crash */}
          {fileError && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-destructive/8 border border-destructive/20 animate-fade-in-up">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive/90 leading-relaxed">{fileError}</p>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-5 animate-scale-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{file.name}</p>
              <p className="text-muted-foreground text-sm">{formatFileSize(file.size)}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayback}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
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
                aria-label="Remove file"
                className="h-10 w-10 rounded-full hover:bg-destructive/20"
              >
                <X className="w-5 h-5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>

          {/* Waveform visualisation — stable heights, no per-render randomness */}
          <div className="mt-4 flex items-center justify-center gap-1 h-12">
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full waveform-bar transition-all duration-150 ${
                  isPlaying ? "animate-wave" : ""
                }`}
                style={{
                  height: `${h}%`,
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

          {/* Hidden audio element — src set lazily on first play */}
          <audio
            ref={audioRef}
            onEnded={handleAudioEnded}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
