export type ChatRole = "user" | "assistant";

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface UserProfileContext {
  emotionToday?: string | null;
  stressLevel?: number;
  selfcareLevel?: number;
  emotionsFound?: string[];
  caregiverRole?: string | null;
  journeysCompleted?: number[];
  challengeArea?: string | null;
  copingStyle?: string | null;
  supportNetwork?: string | null;
  sleepQuality?: string | null;
}

export interface JourneyCatalogItem {
  number: number;
  title: string;
  subtitle?: string | null;
  activation_signals?: string[];
}

export interface ChatRequestBody {
  message: string;
  profile?: UserProfileContext;
  history?: ChatHistoryMessage[];
  journey?: JourneyContext;
  journeys?: JourneyCatalogItem[];
}

export interface JourneyContext {
  number: number;
  title: string;
  stepIndex: number;
  instruction: string;
  userChoice?: string;
}

export interface JourneyRecommendation {
  number: number;
  reason?: string;
}

export interface ChatResponseBody {
  reply: string;
  audioText: string;
  speechAudio?: string;
  journeyRecommendation?: JourneyRecommendation;
}

export interface TranscribeResponseBody {
  text: string;
}
