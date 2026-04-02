import client from './client';
import type { Entry } from '../types';

export const getEntries = () =>
  client.get<Entry[]>('/api/entries').then(r => r.data);

export const createEntry = (data: Omit<Entry, 'id' | 'timestamp' | 'color'>) =>
  client.post<Entry>('/api/entries', data).then(r => r.data);

export const updateColor = (id: number, color: string | null) =>
  client.patch<Entry>(`/api/entries/${id}/color`, { value: color }).then(r => r.data);

export const updateCategory = (id: number, categoryId: number | null) =>
  client.patch<Entry>(`/api/entries/${id}/category`, { value: categoryId }).then(r => r.data);

export const deleteEntry = (id: number) =>
  client.delete(`/api/entries/${id}`);
