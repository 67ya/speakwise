import client from './client';

export interface CodeResult {
  summary: string;
  analysis: string;
  fromCache?: boolean;
}

export const analyzeCode = (code: string) =>
  client.post<CodeResult>('/api/code', { code }).then(r => r.data);
