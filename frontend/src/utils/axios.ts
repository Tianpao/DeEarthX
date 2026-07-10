interface AxiosResponse<T = unknown> {
  data: T;
  status: number;
}

const BASE_URL = 'http://localhost:37019';

function request<T>(method: string, url: string, data?: unknown, config?: Record<string, unknown>): Promise<AxiosResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config as Record<string, unknown>)?.headers as Record<string, string>,
  };

  return fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  }).then(async (response) => {
    const responseData = await response.json().catch(() => null);
    return { data: responseData as T, status: response.status };
  });
}

const axiosInstance = {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return request<T>('GET', url, undefined, config);
  },
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return request<T>('POST', url, data, config);
  },
  put<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return request<T>('PUT', url, data, config);
  },
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<AxiosResponse<T>> {
    return request<T>('DELETE', url, undefined, config);
  },
};

export default axiosInstance;
