import { buildSentence } from "./sentenceBuilder";
import { findTranslationFeedbackOverride } from "./translationFeedback";

export type AgentState = "IDLE" | "SIGNING" | "PAUSED";

type SentenceResult = {
  malay: string;
  english: string;
};

export class SignAgent {
  private state: AgentState = "IDLE";
  private buffer: string[] = [];
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onSentence: (result: SentenceResult, signs: string[]) => void,
    private readonly onBufferUpdate?: (buffer: string[]) => void
  ) {}

  update(sign: string | null): void {
    if (sign && sign !== "UNKNOWN") {
      this.cancelPauseTimer();
      this.state = "SIGNING";

      if (this.buffer[this.buffer.length - 1] !== sign) {
        this.buffer.push(sign);
        if (this.buffer.length > 8) {
          this.buffer = this.buffer.slice(-8);
        }
        this.emitBuffer();
      }

      return;
    }

    if (this.state === "IDLE" || this.state === "PAUSED") {
      return;
    }

    this.state = "PAUSED";
    this.pauseTimer = setTimeout(() => this.flush(), 2000);
  }

  flush(): void {
    this.cancelPauseTimer();

    if (this.buffer.length === 0) {
      this.state = "IDLE";
      return;
    }

    const signs = [...this.buffer];
    const learnedSentence = findTranslationFeedbackOverride(signs);
    this.onSentence(learnedSentence ?? buildSentence(signs), signs);
    this.buffer = [];
    this.emitBuffer();
    this.state = "IDLE";
  }

  reset(): void {
    this.cancelPauseTimer();
    this.buffer = [];
    this.emitBuffer();
    this.state = "IDLE";
  }

  private cancelPauseTimer() {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
  }

  private emitBuffer() {
    this.onBufferUpdate?.([...this.buffer]);
  }
}
