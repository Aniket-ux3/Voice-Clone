const EMOTIONS = [
  { id: "neutral", label: "Neutral" },
  { id: "happy",   label: "Happy"   },
  { id: "sad",     label: "Sad"     },
  { id: "angry",   label: "Angry"   },
  { id: "jolly",   label: "Jolly"   },
  { id: "anxious", label: "Anxious" },
];

interface EmotionSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

const EmotionSelector = ({ selected, onSelect }: EmotionSelectorProps) => (
  <div className="flex flex-wrap gap-2">
    {EMOTIONS.map(({ id, label }) => (
      <button
        key={id}
        onClick={() => onSelect(id)}
        aria-pressed={selected === id}
        className={`emotion-pill font-medium ${selected === id ? "selected" : ""}`}
      >
        {label}
      </button>
    ))}
  </div>
);

export default EmotionSelector;
