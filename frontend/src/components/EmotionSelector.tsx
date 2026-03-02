interface Emotion {
  id: string;
  label: string;
}

const emotions: Emotion[] = [
  { id: "neutral", label: "Neutral"},
  { id: "happy", label: "Happy"},
  { id: "sad", label: "Sad"},
  { id: "angry", label: "Angry"},
  { id: "jolly", label: "Jolly"},
  { id: "anxious", label: "Anxious"},
];

interface EmotionSelectorProps {
  selected: string;
  onSelect: (emotionId: string) => void;
}

const EmotionSelector = ({ selected, onSelect }: EmotionSelectorProps) => {
  return (
    <div className="flex flex-wrap gap-3">
      {emotions.map((emotion) => (
        <button
          key={emotion.id}
          onClick={() => onSelect(emotion.id)}
          className={`emotion-pill flex items-center gap-2 text-sm font-medium ${
            selected === emotion.id ? "selected" : ""
          }`}
        >
          {emotion.label}
        </button>
      ))}
    </div>
  );
};

export default EmotionSelector;
