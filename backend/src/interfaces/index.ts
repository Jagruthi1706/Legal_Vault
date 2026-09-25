export interface IHealthResponse {
  status: 'ok';
  service: string;
  version: string;
}

export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface IApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

export interface IEnvironment {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  API_VERSION: string;
  APP_NAME: string;
  APP_VERSION: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  DATABASE_URL: string;
}
