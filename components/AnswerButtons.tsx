// The False and True buttons of the game screen (design system 5.8): False on the left, True on the right,
// matching the swipe directions. Icon plus word, so the answer never depends on colour alone.
import { PillButton } from "./PillButton";
import { CheckIcon, CrossIcon } from "./icons";

export interface AnswerButtonsProps {
  /** Called with false (the False button) or true (the True button). Not called while disabled. */
  onAnswer: (value: boolean) => void;
  /** Dims both buttons and ignores presses (Timed stamp beat). The buttons stay focusable so focus is not lost. */
  disabled?: boolean;
  className?: string;
}

export function AnswerButtons({ onAnswer, disabled = false, className }: AnswerButtonsProps) {
  const press = (value: boolean) => () => {
    if (!disabled) onAnswer(value);
  };
  return (
    <div className={["flex gap-(--space-12)", className].filter(Boolean).join(" ")}>
      <PillButton
        tone="false"
        className="flex-1"
        leadingIcon={<CrossIcon size={16} />}
        aria-disabled={disabled || undefined}
        onClick={press(false)}
      >
        False
      </PillButton>
      <PillButton
        tone="true"
        className="flex-1"
        leadingIcon={<CheckIcon size={18} />}
        aria-disabled={disabled || undefined}
        onClick={press(true)}
      >
        True
      </PillButton>
    </div>
  );
}
