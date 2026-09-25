import { env } from '../config';
import { APP } from '../constants/app.constants';
import { IHealthResponse } from '../interfaces';

export class HealthService {
  getHealthStatus(): IHealthResponse {
    return {
      status: 'ok',
      service: env.APP_NAME || APP.NAME,
      version: env.APP_VERSION || APP.VERSION,
    };
  }
}

export const healthService = new HealthService();
