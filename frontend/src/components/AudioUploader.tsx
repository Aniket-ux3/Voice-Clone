import { useState, useRef, useCallback } from "react";
import { Upload, Music, Play, Pause, X, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AudioUploaderProps {
  onFileSelect: (file: File | null) => void;
  file: File | null;
  label?: string;
  inputId?: string;
}

const ACCEPTED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm", "audio/flac"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

function isAcceptedAudio(file: File): boolean {
  return (
    file.type.startsWith("audio/") ||
    ACCEPTED_TYPES.includes(file.type) ||
    /\.(wav|mp3|m4a|ogg|flac|webm|aac)$/i.test(file.name)
  );
}

// Deterministic waveform heights — never re-randomised on render
function makeBarHeights(count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    20 + Math.abs(Math.sin(i * 2.4 + 1.3) * 70 + Math.sin(i * 0.7) * 30)
  );
}
const WAVEFORM_HEIGHTS = makeBarHeights(32); // fewer bars on mobile looks cleaner

const AudioUploader = ({
  onFileSelect,
  file,
  label = "Upload Audio Sample",
  inputId = "audio-upload",
}: AudioUploaderProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [fileError, setFileError]   = useState<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const revokeUrl = () => {
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
  };

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); }, []);
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const processFile = (f: File) => {
    setFileError(null);
    if (!isAcceptedAudio(f)) { setFileError("Unsupported format. Please upload WAV, MP3, M4A, FLAC, or OGG."); return; }
    if (f.size > MAX_SIZE_BYTES) { setFileError("File too large — maximum is 50 MB."); return; }
    revokeUrl();
    audioUrlRef.current = URL.createObjectURL(f);
    setIsPlaying(false);
    onFileSelect(f);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const handleRemove = () => {
    revokeUrl(); setIsPlaying(false); setFileError(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (inputRef.current) inputRef.current.value = "";
    onFileSelect(null);
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrlRef.current) return;
    if (!audio.src || audio.src !== audioUrlRef.current) audio.src = audioUrlRef.current;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().catch(() => setIsPlaying(false)); setIsPlaying(true); }
  };

  const handleAudioEnded = () => setIsPlaying(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <input ref={inputRef} type="file" accept="audio/*" onChange={handleInputChange} className="hidden" id={inputId} />

      {!file ? (
        <>
          <label
            htmlFor={inputId}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`upload-zone flex flex-col items-center justify-center cursor-pointer min-h-[140px] sm:min-h-[170px] ${isDragOver ? "drag-over" : ""} ${fileError ? "!border-destructive/50" : ""}`}
          >
            <div className="relative mb-3">
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-colors ${
                fileError ? "bg-destructive/15 border border-destructive/30" : "bg-gradient-to-br from-primary/20 to-secondary/20"
              }`}>
                {fileError
                  ? <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-destructive" />
                  : <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                }
              </div>
              {isDragOver && <div className="absolute inset-0 rounded-full animate-ping bg-primary/20" />}
            </div>
            <p className="text-foreground font-medium text-sm mb-0.5">{label}</p>
            <p className="text-muted-foreground text-xs">Tap to browse · or drag &amp; drop</p>
            <p className="text-muted-foreground/50 text-[10px] mt-1.5">WAV · MP3 · M4A · FLAC — max 50 MB</p>
          </label>

          {fileError && (
            <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-destructive/8 border border-destructive/20 animate-fade-in-up">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive/90 leading-relaxed">{fileError}</p>
            </div>
          )}
        </>
      ) : (
        <div className="glass-card p-4 animate-scale-in">
          {/* File info row */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center shrink-0">
              <Music className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium text-xs sm:text-sm truncate">{file.name}</p>
              <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
            </div>
            {/* Controls — always reachable */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={togglePlayback}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="h-9 w-9 rounded-full bg-primary/20 hover:bg-primary/30">
                {isPlaying
                  ? <Pause className="w-4 h-4 text-primary" />
                  : <Play  className="w-4 h-4 text-primary ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleRemove}
                aria-label="Remove file"
                className="h-9 w-9 rounded-full hover:bg-destructive/20">
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* Waveform — height reduced on mobile */}
          <div className="mt-3 flex items-center justify-center gap-0.5 h-8 sm:h-10">
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <div key={i}
                className={`w-1 rounded-full waveform-bar transition-all duration-150 ${isPlaying ? "animate-wave" : ""}`}
                style={{ height: `${h}%`, animationDelay: `${i * 0.06}s`, opacity: isPlaying ? 1 : 0.35 }}
              />
            ))}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-success">
            <Check className="w-3.5 h-3.5" />
            <span>Sample uploaded successfully</span>
          </div>

          <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
