declare module "expo-speech-recognition" {
  export type SpeechResultEvent = {
    results?: { transcript?: string }[];
    isFinal?: boolean;
  };

  export type SpeechErrorEvent = {
    error: string;
    message?: string;
  };

  export const ExpoSpeechRecognitionModule: {
    isRecognitionAvailable(): boolean;
    requestPermissionsAsync(): Promise<{ granted: boolean }>;
    start(options: {
      lang?: string;
      interimResults?: boolean;
      continuous?: boolean;
    }): void;
    stop(): void;
    addListener(
      event: "result",
      handler: (event: SpeechResultEvent) => void,
    ): { remove(): void };
    addListener(event: "end", handler: () => void): { remove(): void };
    addListener(
      event: "error",
      handler: (event: SpeechErrorEvent) => void,
    ): { remove(): void };
  };
}
