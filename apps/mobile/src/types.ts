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

export type TemplateType = "restaurant" | "basic";

export type MapProvider = "google" | "naver";

export type RestaurantBasicInfo = {
  name: string;
  address: string;
  hours: string;
  phone: string;
  parking: string;
  reservation: string;
};

export type RestaurantSectionKey =
  | "intro"
  | "atmosphere"
  | "menu"
  | "foodReview"
  | "summary"
  | "closing";

export type RestaurantSection = {
  id: string;
  key: RestaurantSectionKey;
  content: string;
  images: string[];
};

export type RestaurantRatingKey =
  | "taste"
  | "price"
  | "service"
  | "cleanliness"
  | "revisit";

export type RestaurantRatings = Record<RestaurantRatingKey, number>;

export type RestaurantTemplateData = {
  region: string;
  restaurantName: string;
  mainMenu: string;
  mapProvider: MapProvider;
  location: StepLocation | null;
  basicInfo: RestaurantBasicInfo;
  sections: RestaurantSection[];
  ratings: RestaurantRatings;
  summaryHead: string;
  summaryTail: string;
};

export type BlogDraft = {
  id: string;
  title: string;
  template: TemplateType;
  restaurant?: RestaurantTemplateData;
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

export type DraftListState = {
  drafts: BlogDraft[];
  activeId: string;
};

export type Screen = "home" | "edit" | "preview" | "publish";
