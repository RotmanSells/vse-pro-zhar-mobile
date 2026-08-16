export const HEALTH_SERVICE_NAME = 'vse-pro-zhar-api';

export interface HealthClock {
  now(): Date;
}

export interface HealthReadiness {
  isReady(): boolean;
}
