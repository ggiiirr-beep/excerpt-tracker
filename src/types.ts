export type ConfidenceRating = 1 | 2 | 3 | 4 | 5;
export type ExcerptConfidenceRating = 0 | ConfidenceRating;

export type ResourceLink = {
  id: string;
  label: string;
  url: string;
};

export type PracticeEntry = {
  id: string;
  date: string;
  rating: ConfidenceRating;
  note: string;
  recording?: SessionRecording | null;
};

export type PdfAttachment = {
  name: string;
  size: number;
  dataUrl: string;
};

export type SessionRecording = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type Excerpt = {
  id: string;
  title: string;
  confidenceRating: ExcerptConfidenceRating;
  isNew: boolean;
  isFocus: boolean;
  practiceCount: number;
  lastPracticedDate: string | null;
  dateAdded: string;
  notes: string;
  tags: string[];
  resources: ResourceLink[];
  pdfAttachment?: PdfAttachment | null;
  practiceHistory: PracticeEntry[];
};

export type RepertoireList = {
  id: string;
  name: string;
  excerptIds: string[];
};

export type AppData = {
  excerpts: Excerpt[];
  lists: RepertoireList[];
};
