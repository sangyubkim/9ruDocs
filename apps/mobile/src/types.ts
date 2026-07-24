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
  /** 주차 안내 사진 (기본정보 주차 필드와 별도) */
  parkingImages: string[];
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
  /** WP 포스트 슬러그 (영문 케밥) — AI 채움 */
  slug: string;
  /** 대표 이미지용 영문 프롬프트(참고용). 실제 대표 이미지는 앱 사진 사용 */
  imagePrompt: string;
  /** 대표 이미지 대체 텍스트 */
  imageAlt: string;
  /** 대표 이미지 캡션 */
  imageCaption: string;
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
