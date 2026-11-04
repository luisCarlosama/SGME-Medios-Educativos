const API_BASE_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:6001/api'
).replace(/\/api\/?$/, '');

export function fetchBackend(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, options);
}
