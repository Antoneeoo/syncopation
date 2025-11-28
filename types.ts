export enum AppMode {
  SELECT = 'SELECT',
  WEARABLE = 'WEARABLE',
  COMPANION = 'COMPANION',
}

export interface VitalSigns {
  timestamp: number;
  heartRate: number; // bpm
  spo2: number; // %
  temperature: number; // Celsius
  systolic: number; // mmHg
  diastolic: number; // mmHg
  steps: number;
  stressLevel: number; // 0-100
  isSleeping: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  isAutoDial: boolean;
}

export interface HealthAnalysis {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  summary: string;
  recommendation: string;
  anomaliesDetected: string[];
}

// For BroadcastChannel communication
export interface SyncMessage {
  type: 'VITALS_UPDATE' | 'EMERGENCY_TRIGGER' | 'ANALYSIS_UPDATE';
  payload: any;
}