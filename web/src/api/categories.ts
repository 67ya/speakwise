import client from './client';
import type { Category } from '../types';

export const getCategories = () =>
  client.get<Category[]>('/api/categories').then(r => r.data);

export const createCategory = (name: string) =>
  client.post<Category>('/api/categories', { name }).then(r => r.data);

export const updateCategory = (id: number, name: string) =>
  client.put<Category>(`/api/categories/${id}`, { name }).then(r => r.data);

export const deleteCategory = (id: number) =>
  client.delete(`/api/categories/${id}`);
