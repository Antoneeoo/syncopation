
export enum AppMode {
  SELECT = 'SELECT',
  WEARABLE = 'WEARABLE',
  COMPANION = 'COMPANION',
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  bloodType: string;
  vitals: VitalSigns;
  history: VitalSigns[];
  analysis: HealthAnalysis | null;
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
  isScanning?: boolean;
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
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
  agentActions?: string[];
}

export interface DeviceConnection {
  id: string;
  name: string;
  type: 'WATCH' | 'STRAP' | 'SCALE' | 'PATCH';
  status: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING';
  battery: number;
}

export interface SyncMessage {
  type: 'PATIENT_UPDATE' | 'EMERGENCY_TRIGGER' | 'SOS_TRIGGER' | 'AGENT_ACTION' | 'DEVICE_UPDATE';
  payload: any;
}
