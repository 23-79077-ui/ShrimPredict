import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const firstArray = Object.values(value).find(Array.isArray);
    if (firstArray) return firstArray;
  }
  return [];
}

export function safeObject(value, defaults = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return defaults;
}

export default api;
