import React, { useState, useEffect, useCallback } from 'react';
import { AppMode, VitalSigns, Patient, DeviceConnection } from './types';
import WearableInterface from './components/WearableInterface';
import CompanionDashboard from './components/CompanionDashboard';
import { analyzePatientHealth, detectFalls } from './services/geminiService';

const DEFAULT_PATIENTS: Patient[] = [
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

const MOCK_DEVICES: DeviceConnection[] = [
  { id: 'd1', name: 'VitalWatch Elite v4', type: 'WATCH', status: 'CONNECTED', battery: 92 },
  { id: 'd2', name: 'NanoPulse Chest Strap', type: 'STRAP', status: 'DISCONNECTED', battery: 12 },
  { id: 'd3', name: 'BioSense Skin Patch', type: 'PATCH', status: 'SYNCING', battery: 100 }
];

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);
  const [patients, setPatients] = useState<Patient[]>(DEFAULT_PATIENTS);
  const [activePatientId, setActivePatientId] = useState<string>(DEFAULT_PATIENTS[0].id);
  const [isEmergency, setIsEmergency] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [devices, setDevices] = useState<DeviceConnection[]>(MOCK_DEVICES);

  // BLE Pairing States
  const [bleStatus, setBleStatus] = useState<'DISCONNECTED' | 'SEARCHING' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [bleDeviceName, setBleDeviceName] = useState<string>('');

  // 1. BACKEND STATE SYNCHRONIZATION (Polling loop)
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/patients');
        if (res.ok) {
          const data = await res.json();
          if (data.patients && data.patients.length > 0) {
            setPatients(data.patients);
          }
          if (data.devices && data.devices.length > 0) {
            setDevices(data.devices);
          }
          setIsEmergency(data.isEmergency);
        }
      } catch (err) {
        console.warn('Backend server not responsive yet. Defaulting to local state simulation.', err);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, []);

  // 2. AUTOMATIC GUARDIAN LOOP: Autonomously monitor the active patient for abnormalities
  const handleTriggerAnalysis = useCallback(async () => {
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || isAnalysing) return;

    setIsAnalysing(true);
    const result = await analyzePatientHealth(activePatient);
    
    try {
      const res = await fetch('/api/patients/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activePatientId,
          analysis: result
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.patient) {
          setPatients(prev => prev.map(p => p.id === activePatientId ? data.patient : p));
        }
      }
    } catch (err) {
      // Fallback local update
      setPatients(prev => prev.map(p => {
        if (p.id !== activePatientId) return p;
        return { ...p, analysis: result };
      }));
    } finally {
      setIsAnalysing(false);
    }
  }, [patients, activePatientId, isAnalysing]);

  useEffect(() => {
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || isAnalysing || mode === AppMode.SELECT) return;

    const v = activePatient.vitals;
    const isCritical = v.heartRate > 115 || v.spo2 < 93 || v.temperature > 38.5 || v.systolic > 160 || v.diastolic > 100 || v.systolic < 90;
    
    if (isCritical && !activePatient.analysis?.status.includes('CRITICAL')) {
      handleTriggerAnalysis();
    }
  }, [patients, activePatientId, isAnalysing, mode, handleTriggerAnalysis]);

  // 3. FALL DETECTION LOOP
  useEffect(() => {
    if (mode !== AppMode.WEARABLE || isEmergency) return;
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || activePatient.history.length < 5) return;

    const recentAccel = activePatient.vitals.accelerometer;
    const magnitude = Math.sqrt(recentAccel.x**2 + recentAccel.y**2 + recentAccel.z**2);
    
    if (magnitude > 15) { // Impact detected
      const checkFall = async () => {
        const detected = await detectFalls(activePatient.history);
        if (detected) {
          try {
            await fetch('/api/sos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isEmergency: true })
            });
            setIsEmergency(true);
          } catch (err) {
            setIsEmergency(true);
          }
        }
      };
      checkFall();
    }
  }, [patients, activePatientId, mode, isEmergency]);

  // 4. WEARABLE SIMULATION DATA DRIFT
  useEffect(() => {
    if (mode !== AppMode.WEARABLE) return;

    const interval = setInterval(async () => {
      const p = patients.find(pat => pat.id === activePatientId);
      if (!p) return;

      const jitter = (b: number, r: number) => b + (Math.random() * r - r/2);
      
      let newHr = jitter(p.vitals.heartRate, 4);
      let newSpo2 = jitter(p.vitals.spo2, 0.5);
      let newSystolic = jitter(p.vitals.systolic, 2);
      let newDiastolic = jitter(p.vitals.diastolic, 1.5);
      
      newHr = Math.max(40, Math.min(200, newHr));
      newSpo2 = Math.max(80, Math.min(100, newSpo2));
      newSystolic = Math.max(70, Math.min(220, newSystolic));
      newDiastolic = Math.max(40, Math.min(130, newDiastolic));

      const payload = {
        patientId: activePatientId,
        heartRate: Math.round(newHr),
        spo2: Math.round(newSpo2),
        systolic: Math.round(newSystolic),
        diastolic: Math.round(newDiastolic),
        temperature: Number(jitter(p.vitals.temperature, 0.1).toFixed(1)),
        steps: p.vitals.isSleeping ? p.vitals.steps : p.vitals.steps + (Math.random() > 0.85 ? 1 : 0),
        stressLevel: p.vitals.stressLevel,
        isSleeping: p.vitals.isSleeping,
        accelerometer: {
          x: Number(jitter(0, 0.2).toFixed(2)),
          y: Number(jitter(0.2, 0.2).toFixed(2)),
          z: Number(jitter(9.8, 0.1).toFixed(2))
        },
        deviceName: 'Simulated Apple/Samsung Node',
        battery: 91
      };

      try {
        await fetch('/api/wearable/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        // Local fallback
        setPatients(prev => prev.map(pat => {
          if (pat.id !== activePatientId) return pat;
          return {
            ...pat,
            vitals: { ...pat.vitals, ...payload, timestamp: Date.now() },
            history: [...pat.history, { ...pat.vitals, ...payload, timestamp: Date.now() }].slice(-500)
          };
        }));
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [mode, activePatientId, patients]);

  // 5. INTERFACE ACTIONS
  const handleAddPatient = async (newP: Patient) => {
    try {
      const res = await fetch('/api/patients/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newP)
      });
      if (res.ok) {
        setPatients(prev => [...prev, newP]);
      }
    } catch (err) {
      setPatients(prev => [...prev, newP]);
    }
  };

  const handleToggleSleep = async () => {
    const p = patients.find(pat => pat.id === activePatientId);
    if (!p) return;
    try {
      await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activePatientId,
          isSleeping: !p.vitals.isSleeping
        })
      });
    } catch (err) {
      setPatients(prev => prev.map(pat => pat.id === activePatientId ? { ...pat, vitals: { ...pat.vitals, isSleeping: !pat.vitals.isSleeping } } : pat));
    }
  };

  const handleToggleScan = async () => {
    const p = patients.find(pat => pat.id === activePatientId);
    if (!p) return;
    try {
      await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activePatientId,
          isScanning: !p.vitals.isScanning
        })
      });
    } catch (err) {
      setPatients(prev => prev.map(pat => pat.id === activePatientId ? { ...pat, vitals: { ...pat.vitals, isScanning: !pat.vitals.isScanning } } : pat));
    }
  };

  const handleSimulateAnomaly = async () => {
    const payload = {
      patientId: activePatientId,
      heartRate: 158,
      spo2: 89,
      stressLevel: 98,
      systolic: 195,
      diastolic: 115,
      accelerometer: { x: 25.4, y: -12.1, z: 2.3 }
    };
    try {
      await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      setPatients(prev => prev.map(pat => pat.id === activePatientId ? { ...pat, vitals: { ...pat.vitals, ...payload } } : pat));
    }
  };

  const handleCancelEmergency = async () => {
    try {
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEmergency: false })
      });
      await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: activePatientId,
          heartRate: 72,
          spo2: 98,
          stressLevel: 15,
          systolic: 125,
          diastolic: 82,
          accelerometer: { x: 0, y: 0.2, z: 9.8 }
        })
      });
      setIsEmergency(false);
    } catch (err) {
      setIsEmergency(false);
      setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, heartRate: 72, spo2: 98, stressLevel: 15, systolic: 125, diastolic: 82, accelerometer: { x: 0, y: 0.2, z: 9.8 } } } : p));
    }
  };

  const handleTriggerSOS = async () => {
    try {
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEmergency: true })
      });
      setIsEmergency(true);
    } catch (err) {
      setIsEmergency(true);
    }
  };

  // 6. REAL WEB BLUETOOTH PAIRING FOR HARDWARE SMARTWATCHES / CHEST STRAPS
  const connectBluetooth = async () => {
    // @ts-ignore
    if (!navigator.bluetooth) {
      alert('Web Bluetooth is only supported in secure contexts (HTTPS) and modern browsers like Chrome or Edge.');
      return;
    }
    try {
      setBleStatus('SEARCHING');
      // @ts-ignore
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['heart_rate']
      });

      setBleDeviceName(device.name || 'Bluetooth Heart Device');
      setBleStatus('CONNECTING');

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('heart_rate');
      const characteristic = await service?.getCharacteristic('heart_rate_measurement');

      await characteristic?.startNotifications();
      
      characteristic?.addEventListener('characteristicvaluechanged', async (event: any) => {
        const value = event.target.value;
        const flags = value.getUint8(0);
        const rate16 = flags & 0x1;
        let heartRate = 0;
        if (rate16) {
          heartRate = value.getUint16(1, true);
        } else {
          heartRate = value.getUint8(1);
        }

        console.log('🔗 BLE Hardware Heart Rate:', heartRate);

        // Send to backend sync to display in our dashboard in real-time
        try {
          await fetch('/api/wearable/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId: activePatientId,
              heartRate: heartRate,
              deviceName: device.name || 'Hardware BLE Monitor',
              battery: 98
            })
          });
        } catch (syncErr) {
          console.error('Error syncing BLE vitals:', syncErr);
        }
      });

      setBleStatus('CONNECTED');

      device.addEventListener('gattserverdisconnected', () => {
        setBleStatus('DISCONNECTED');
        setBleDeviceName('');
      });

    } catch (err: any) {
      console.warn('Bluetooth Pairing Canceled/Failed:', err);
      setBleStatus('DISCONNECTED');
    }
  };

  const currentPatient = patients.find(p => p.id === activePatientId) || patients[0];

  if (mode === AppMode.SELECT) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8 font-sans">
        <div className="text-center mb-16 relative">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          <h1 className="text-6xl md:text-8xl font-black bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 mb-6 tracking-tighter leading-none">
            VITALSYNC <span className="italic">AI</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.4em] text-xs">Autonomous Medical Mesh Network</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-5xl">
          <button 
            onClick={() => setMode(AppMode.WEARABLE)} 
            className="group relative bg-gray-900 border border-gray-800 hover:border-cyan-500/50 rounded-[3rem] p-12 transition-all hover:-translate-y-3 shadow-2xl flex flex-col items-start overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
               <i className="fas fa-clock text-9xl"></i>
             </div>
             <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 flex items-center justify-center text-3xl text-cyan-400 mb-8">
               <i className="fas fa-microchip"></i>
             </div>
             <h3 className="text-3xl font-black uppercase mb-3 tracking-tighter">Wearable Mode</h3>
             <p className="text-gray-500 text-lg leading-relaxed text-left font-medium">Deploy sensor node for live biometric collection, fall detection, and SOS broadcasting.</p>
          </button>

          <button 
            onClick={() => setMode(AppMode.COMPANION)} 
            className="group relative bg-gray-900 border border-gray-800 hover:border-blue-500/50 rounded-[3rem] p-12 transition-all hover:-translate-y-3 shadow-2xl flex flex-col items-start overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
               <i className="fas fa-server text-9xl"></i>
             </div>
             <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-3xl text-blue-400 mb-8">
               <i className="fas fa-terminal"></i>
             </div>
             <h3 className="text-3xl font-black uppercase mb-3 tracking-tighter">Guardian Hub</h3>
             <p className="text-gray-500 text-lg leading-relaxed text-left font-medium">Central command interface. Monitor synchronized smart watches, configure APIs, and run agent intelligence.</p>
          </button>
        </div>

        <div className="mt-20 flex items-center gap-6 px-8 py-4 bg-gray-900/40 rounded-full border border-gray-800 text-[10px] text-gray-600 font-black uppercase tracking-widest shadow-inner">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
              <span>Network Active</span>
           </div>
           <div className="w-px h-4 bg-gray-800"></div>
           <span>API Server: {process.env.API_KEY ? 'SECURED_CLOUD_ROUTING' : 'OFFLINE_FALLBACK'}</span>
        </div>
      </div>
    );
  }

  if (mode === AppMode.WEARABLE) {
    return (
      <WearableInterface 
        currentPatient={currentPatient}
        onToggleSleep={handleToggleSleep}
        onToggleScan={handleToggleScan}
        onSimulateAnomaly={handleSimulateAnomaly}
        isEmergency={isEmergency}
        onCancelEmergency={handleCancelEmergency}
        onTriggerSOS={handleTriggerSOS}
      />
    );
  }

  return (
    <CompanionDashboard 
      patients={patients}
      activePatientId={activePatientId}
      onSwitchPatient={setActivePatientId}
      onAddPatient={handleAddPatient}
      devices={devices}
      onTriggerAnalysis={handleTriggerAnalysis}
      isAnalysing={isAnalysing}
      bleStatus={bleStatus}
      bleDeviceName={bleDeviceName}
      onConnectBluetooth={connectBluetooth}
    />
  );
};

export default App;
