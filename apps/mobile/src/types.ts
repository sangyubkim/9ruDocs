export type StepLocation = {
  label: string;
  latitude?: number;
  longitude?: number;
  mapsUrl: string;
};

export type StepStatus = "editing" | "completed";

export type Step = {
  id: string;
  imageUri: string | null;
  caption: string;
  order: number;
  status: StepStatus;
  location?: StepLocation | null;
};

/** AI 글쓰기 옵션 (선택, 미입력 시 단계 캡션에서 추론) */
export type AiWritingOptions = {
  persona?: string;
  target?: string;
  keywords?: string;
  toneLabel?: string;
  personalTips?: string;
  cta?: string;
};

export type BlogDraft = {
  id: string;
  title: string;
  steps: Step[];
  body: string;
  excerpt: string;
  tags: string[];
  /** friendly | professional */
  tone?: "friendly" | "professional";
  ai?: AiWritingOptions;
  createdAt: string;
  updatedAt: string;
};

export type Screen = "home" | "edit" | "preview" | "publish";
