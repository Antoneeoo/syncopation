import express from 'express';
import path from 'path';

// Hardcoded in-memory state for Patients
interface VitalSigns {
  timestamp: number;
  heartRate: number;
  spo2: number;
  temperature: number;
  systolic: number;
  diastolic: number;
  steps: number;
  stressLevel: number;
  isSleeping: boolean;
  isScanning?: boolean;
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
}

interface HealthAnalysis {
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  summary: string;
  recommendation: string;
  anomaliesDetected: string[];
  agentActions?: string[];
}

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  bloodType: string;
  vitals: VitalSigns;
  history: VitalSigns[];
  analysis: HealthAnalysis | null;
}

interface DeviceConnection {
  id: string;
  name: string;
  type: 'WATCH' | 'STRAP' | 'SCALE' | 'PATCH';
  status: 'CONNECTED' | 'DISCONNECTED' | 'SYNCING';
  battery: number;
}

let PATIENTS_STORE: Patient[] = [
  {
    id: 'p1',
    name: 'Dr. Johnathan Doe',
    age: 58,
    gender: 'Male',
    bloodType: 'O+',
    vitals: { timestamp: Date.now(), heartRate: 72, spo2: 98, temperature: 36.6, systolic: 125, diastolic: 82, steps: 2400, stressLevel: 15, isSleeping: false, accelerometer: { x: 0, y: 0.2, z: 9.8 } },
    history: [],
    analysis: null
  },
  {
    id: 'p2',
    name: 'Sarah Jane Smith',
    age: 29,
    gender: 'Female',
    bloodType: 'B-',
    vitals: { timestamp: Date.now(), heartRate: 65, spo2: 99, temperature: 36.7, systolic: 110, diastolic: 70, steps: 8900, stressLevel: 10, isSleeping: false, accelerometer: { x: 0, y: 0.1, z: 9.9 } },
    history: [],
    analysis: null
  }
];

let DEVICES_STORE: DeviceConnection[] = [
  { id: 'd1', name: 'VitalWatch Elite v4', type: 'WATCH', status: 'CONNECTED', battery: 92 },
  { id: 'd2', name: 'NanoPulse Chest Strap', type: 'STRAP', status: 'DISCONNECTED', battery: 12 },
  { id: 'd3', name: 'BioSense Skin Patch', type: 'PATCH', status: 'SYNCING', battery: 100 }
];

let IS_EMERGENCY_STORE = false;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS headers to ensure wearables on other domains/apps can sync
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // --- API ROUTES ---

  // Get current patient state and active devices
  app.get('/api/patients', (req, res) => {
    res.json({
      patients: PATIENTS_STORE,
      devices: DEVICES_STORE,
      isEmergency: IS_EMERGENCY_STORE
    });
  });

  // Update SOS/Emergency state
  app.post('/api/sos', (req, res) => {
    const { isEmergency } = req.body;
    IS_EMERGENCY_STORE = !!isEmergency;
    res.json({ success: true, isEmergency: IS_EMERGENCY_STORE });
  });

  // Add a new patient node
  app.post('/api/patients/add', (req, res) => {
    const newP: Patient = req.body;
    if (!newP.id || !newP.name) {
      return res.status(400).json({ error: 'Missing patient id or name' });
    }
    // Check if exists
    const idx = PATIENTS_STORE.findIndex(p => p.id === newP.id);
    if (idx > -1) {
      PATIENTS_STORE[idx] = { ...PATIENTS_STORE[idx], ...newP };
    } else {
      PATIENTS_STORE.push(newP);
    }
    res.json({ success: true, patient: newP });
  });

  // Save analysis update from Gemini
  app.post('/api/patients/analysis', (req, res) => {
    const { patientId, analysis } = req.body;
    const patient = PATIENTS_STORE.find(p => p.id === patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    patient.analysis = analysis;
    res.json({ success: true, patient });
  });

  // UNIFIED SMARTWATCH SYNC ENDPOINT (Compatible with Apple Watch, Samsung Galaxy Watch, etc.)
  app.post('/api/wearable/sync', (req, res) => {
    const payload = req.body;
    const patientId = payload.patientId || 'p1';

    let patient = PATIENTS_STORE.find(p => p.id === patientId);
    if (!patient) {
      // Create patient if it doesn't exist to make it auto-integrate
      patient = {
        id: patientId,
        name: payload.name || `Wearable Node ${patientId}`,
        age: payload.age || 35,
        gender: payload.gender || 'Unknown',
        bloodType: payload.bloodType || 'Unknown',
        vitals: { timestamp: Date.now(), heartRate: 70, spo2: 98, temperature: 36.6, systolic: 120, diastolic: 80, steps: 0, stressLevel: 10, isSleeping: false, accelerometer: { x: 0, y: 0.2, z: 9.8 } },
        history: [],
        analysis: null
      };
      PATIENTS_STORE.push(patient);
    }

    let heartRate = patient.vitals.heartRate;
    let spo2 = patient.vitals.spo2;
    let temperature = patient.vitals.temperature;
    let systolic = patient.vitals.systolic;
    let diastolic = patient.vitals.diastolic;
    let steps = patient.vitals.steps;
    let stressLevel = patient.vitals.stressLevel;
    let isSleeping = patient.vitals.isSleeping;
    let accelerometer = { ...patient.vitals.accelerometer };

    // 1. APPLE WATCH HEALTHKIT INTERPRETATION
    if (payload.source === 'AppleWatch' || payload.samples) {
      const samples = payload.samples || [];
      samples.forEach((sample: any) => {
        const value = Number(sample.value);
        switch (sample.type) {
          case 'HKQuantityTypeIdentifierHeartRate':
            heartRate = value;
            break;
          case 'HKQuantityTypeIdentifierOxygenSaturation':
            // Apple HealthKit oxygen saturation is stored as ratio (e.g. 0.98), convert to %
            spo2 = value < 1 ? Math.round(value * 100) : value;
            break;
          case 'HKQuantityTypeIdentifierBodyTemperature':
            // Convert Fahrenheit to Celsius if needed
            temperature = sample.unit === 'degF' ? (value - 32) * 5/9 : value;
            break;
          case 'HKQuantityTypeIdentifierBloodPressureSystolic':
            systolic = value;
            break;
          case 'HKQuantityTypeIdentifierBloodPressureDiastolic':
            diastolic = value;
            break;
          case 'HKQuantityTypeIdentifierStepCount':
            steps += value;
            break;
        }
      });
    }
    // 2. SAMSUNG HEALTH / WEAROS / GOOGLE FIT INTERPRETATION
    else if (payload.source === 'SamsungWatch' || payload.source === 'GoogleFit' || payload.data) {
      const data = payload.data || {};
      
      // Heart Rate
      if (data['com.samsung.health.heart_rate'] || data['heart_rate']) {
        heartRate = Number(data['com.samsung.health.heart_rate']?.bpm || data['heart_rate']?.bpm || data['heart_rate'] || heartRate);
      }
      // SpO2
      if (data['com.samsung.health.oxygen_saturation'] || data['spo2']) {
        spo2 = Number(data['com.samsung.health.oxygen_saturation']?.spo2 || data['spo2']?.spo2 || data['spo2'] || spo2);
      }
      // Blood Pressure
      if (data['com.samsung.health.blood_pressure'] || data['blood_pressure']) {
        const bp = data['com.samsung.health.blood_pressure'] || data['blood_pressure'] || {};
        systolic = Number(bp.systolic || systolic);
        diastolic = Number(bp.diastolic || diastolic);
      }
      // Steps
      if (data['com.samsung.health.step_count'] || data['steps']) {
        steps = Number(data['com.samsung.health.step_count']?.steps || data['steps']?.steps || data['steps'] || steps);
      }
    }
    // 3. GENERIC OR CUSTOM SMARTWATCH PAYLOAD
    else {
      if (payload.heartRate !== undefined) heartRate = Number(payload.heartRate);
      if (payload.spo2 !== undefined) spo2 = Number(payload.spo2);
      if (payload.temperature !== undefined) temperature = Number(payload.temperature);
      if (payload.systolic !== undefined) systolic = Number(payload.systolic);
      if (payload.diastolic !== undefined) diastolic = Number(payload.diastolic);
      if (payload.steps !== undefined) steps = Number(payload.steps);
      if (payload.stressLevel !== undefined) stressLevel = Number(payload.stressLevel);
      if (payload.isSleeping !== undefined) isSleeping = !!payload.isSleeping;
      if (payload.accelerometer !== undefined) {
        accelerometer = {
          x: payload.accelerometer.x ?? accelerometer.x,
          y: payload.accelerometer.y ?? accelerometer.y,
          z: payload.accelerometer.z ?? accelerometer.z
        };
      }
    }

    // Prepare updated vitals
    const newVitals: VitalSigns = {
      timestamp: Date.now(),
      heartRate: Math.round(heartRate),
      spo2: Math.round(spo2),
      temperature: Number(temperature.toFixed(1)),
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      steps: Math.round(steps),
      stressLevel: Math.round(stressLevel),
      isSleeping,
      accelerometer
    };

    // Update state
    patient.vitals = newVitals;
    patient.history = [...patient.history, newVitals].slice(-500);

    // Dynamic device register if not exists
    const deviceName = payload.deviceName || payload.source || 'Generic Smartwatch';
    const deviceId = `d_${deviceName.replace(/\s+/g, '_').toLowerCase()}`;
    if (!DEVICES_STORE.some(d => d.id === deviceId)) {
      DEVICES_STORE.push({
        id: deviceId,
        name: deviceName,
        type: 'WATCH',
        status: 'CONNECTED',
        battery: payload.battery ?? 88
      });
    } else {
      // update battery / status
      const dev = DEVICES_STORE.find(d => d.id === deviceId);
      if (dev) {
        dev.status = 'CONNECTED';
        if (payload.battery !== undefined) dev.battery = payload.battery;
      }
    }

    res.json({
      success: true,
      patientId: patient.id,
      patientVitals: patient.vitals
    });
  });

  // --- VITE DEV / PROD HANDLERS ---

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VitalSync Enterprise Multi-Watch backend serving on port ${PORT}`);
  });
}

startServer();
