export type Step = {
  id: string;
  imageUri: string | null;
  caption: string;
  order: number;
};

export type BlogDraft = {
  id: string;
  title: string;
  steps: Step[];
  body: string;
  excerpt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
