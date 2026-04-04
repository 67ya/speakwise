import client from './client';

export interface DailyApiResult {
  spoken: string;
  vocabulary: string;
  fromCache: boolean;
}

export interface ConversationApiLine {
  speaker: string;
  english: string;
  chinese: string;
  vocabulary: string;
}

export interface ConversationApiResult {
  lines: ConversationApiLine[];
}

export const analyzeDaily = (chinese: string) =>
  client.post<DailyApiResult>('/api/daily', { chinese }).then(r => r.data);

export const randomConversation = (topic?: string) =>
  client.post<ConversationApiResult>('/api/daily/random', { topic }).then(r => r.data);
