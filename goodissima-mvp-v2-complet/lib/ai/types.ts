export type AIProviderName = "mock" | "mistral";

export type AIAction = "summary" | "chat" | "classify";

export type AIProviderRequest = {
  system?: string;
  prompt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AISummary = {
  summary: string;
  keyPoints: string[];
  risks: string[];
  suggestedActions: AISuggestedAction[];
  missingDocuments: string[];
};

export type AIClassification = {
  label: string;
  confidence: number;
};

export type AISuggestedActionType =
  | "REQUEST_DOCUMENT"
  | "FOLLOW_UP"
  | "REQUEST_CLARIFICATION"
  | "SCHEDULE_EXCHANGE"
  | "INVESTOR_FOLLOW_UP";

export type AITimelineActionType = AISuggestedActionType | "VALIDATION_REVIEW";

export type AIDraftType =
  | "FOLLOW_UP"
  | "DOCUMENT_REQUEST"
  | "CLARIFICATION_REQUEST"
  | "INVESTOR_REPLY"
  | "PROFESSIONAL_RESPONSE";

export type AIRiskSignalType =
  | "MISSING_DOCUMENT"
  | "INCONSISTENT_INFORMATION"
  | "UNANSWERED_REQUEST"
  | "LOW_INFORMATION"
  | "POSSIBLE_PROMPT_INJECTION"
  | "TIMELINE_INACTIVITY"
  | "UNCLEAR_INTENT"
  | "MISSING_ORGANIZATION"
  | "VARIABLE_INCOME"
  | "UNCONFIRMED_GUARANTOR";

export type AIRiskSeverity = "low" | "medium" | "high";

export type AISuggestedAction = {
  label: string;
  type: AISuggestedActionType;
  reason: string;
};

export type AITimelineNextBestAction = {
  label: string;
  type: AITimelineActionType;
  reason: string;
};

export type AITimelineIntelligence = {
  timelineStatus: string;
  inactiveSinceDays?: number;
  blockers: string[];
  nextBestActions: AITimelineNextBestAction[];
  alerts: string[];
};

export type AIDraft = {
  draftType: AIDraftType;
  subject?: string;
  message: string;
  tone: string;
  warnings: string[];
};

export type AIRiskSignal = {
  type: AIRiskSignalType;
  severity: AIRiskSeverity;
  title: string;
  explanation: string;
  recommendation?: string;
};

export type AIRiskAnalysis = {
  riskSignals: AIRiskSignal[];
};

export type AIProviderResult<T> = {
  provider: AIProviderName;
  model: string;
  output: T;
};

export type AIProvider = {
  name: AIProviderName;
  model: string;
  chat(request: AIProviderRequest): Promise<AIProviderResult<string>>;
  summarize(request: AIProviderRequest): Promise<AIProviderResult<AISummary>>;
  analyzeTimeline(request: AIProviderRequest): Promise<AIProviderResult<AITimelineIntelligence>>;
  generateDraft(request: AIProviderRequest): Promise<AIProviderResult<AIDraft>>;
  analyzeRiskSignals(request: AIProviderRequest): Promise<AIProviderResult<AIRiskAnalysis>>;
  classify(request: AIProviderRequest): Promise<AIProviderResult<AIClassification>>;
  // embeddings(request) will be added when the V1 use case is explicit.
};

export type AIRelationContext = {
  title: string;
  template: {
    key: string | null;
    name: string | null;
    status: string | null;
    aiInstructions?: string | null;
  };
  status: string;
  currentStep: string | null;
  steps: string[];
  openActions: Array<{
    type: string;
    title: string;
    description: string | null;
  }>;
  recentMessages: Array<{
    author: "owner" | "contact" | "system";
    body: string;
    createdAt: string;
  }>;
  documents: Array<{
    fileName: string;
    mimeType: string | null;
  }>;
};
