import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, VitalSigns, Patient, DeviceConnection, SyncMessage } from './types';
import WearableInterface from './components/WearableInterface';
import CompanionDashboard from './components/CompanionDashboard';
import { analyzePatientHealth, detectFalls } from './services/geminiService';

const BROADCAST_CHANNEL_NAME = 'vitalsync_enterprise_mesh';

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

  const channelRef = useRef<BroadcastChannel | null>(null);

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

  // 2. Broadcast Channel Synchronization
  useEffect(() => {
    channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current.onmessage = (event) => {
      const msg: SyncMessage = event.data;
      if (msg.type === 'PATIENT_UPDATE') {
        setPatients(prev => prev.map(p => p.id === msg.payload.id ? msg.payload : p));
      } else if (msg.type === 'SOS_TRIGGER') {
        setIsEmergency(msg.payload);
      } else if (msg.type === 'DEVICE_UPDATE') {
        setDevices(msg.payload);
      }
    };
    return () => channelRef.current?.close();
  }, []);

  const broadcast = useCallback((type: SyncMessage['type'], payload: any) => {
    channelRef.current?.postMessage({ type, payload });
  }, []);

  // 3. AUTOMATIC GUARDIAN LOOP: Autonomously monitor the active patient
  useEffect(() => {
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || isAnalysing || mode === AppMode.SELECT) return;

    const v = activePatient.vitals;
    // Agentic threshold check: If HR > 120 or SpO2 < 92, run AI check automatically
    const isCritical = v.heartRate > 120 || v.spo2 < 92 || v.temperature > 38.5;
    const alreadyAnalyzed = activePatient.analysis && (activePatient.analysis.status === 'CRITICAL' || activePatient.analysis.status === 'WARNING');
    
    if (isCritical && !alreadyAnalyzed) {
      handleTriggerAnalysis();
    }
  }, [patients, activePatientId, isAnalysing, mode]);

  // 4. WEARABLE DATA GENERATION
  useEffect(() => {
    if (mode !== AppMode.WEARABLE) return;

    const interval = setInterval(async () => {
      const p = patients.find(pat => pat.id === activePatientId);
      if (!p) return;

      const jitter = (b: number, r: number) => b + (Math.random() * r - r/2);
      
      const isAnomaly = p.vitals.heartRate > 110;
      let newHr = isAnomaly ? jitter(p.vitals.heartRate, 3) : jitter(72, 6);
      let newSpo2 = isAnomaly ? jitter(p.vitals.spo2, 0.5) : jitter(98, 1);
      let newSystolic = isAnomaly ? jitter(p.vitals.systolic, 3) : jitter(120, 4);
      let newDiastolic = isAnomaly ? jitter(p.vitals.diastolic, 1.5) : jitter(80, 2);
      
      // Keep values within realistic bounds
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
        isScanning: p.vitals.isScanning,
        accelerometer: {
          x: Number(jitter(0, 0.2).toFixed(2)),
          y: Number(jitter(0.2, 0.2).toFixed(2)),
          z: Number(jitter(9.8, 0.1).toFixed(2))
        },
        deviceName: 'Simulated Wearable Node',
        battery: 91
      };

      try {
        const res = await fetch('/api/wearable/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          // Backend updated, but let's update locally for instant responsiveness
          setPatients(prev => prev.map(pat => {
            if (pat.id !== activePatientId) return pat;
            const nextVitals = { ...pat.vitals, ...payload, timestamp: Date.now() };
            const updated = {
              ...pat,
              vitals: nextVitals,
              history: [...pat.history, nextVitals].slice(-500)
            };
            broadcast('PATIENT_UPDATE', updated);
            return updated;
          }));
        }
      } catch (err) {
        // Fallback local update
        setPatients(prev => prev.map(pat => {
          if (pat.id !== activePatientId) return pat;
          const nextVitals = { ...pat.vitals, ...payload, timestamp: Date.now() };
          const updated = {
            ...pat,
            vitals: nextVitals,
            history: [...pat.history, nextVitals].slice(-500)
          };
          broadcast('PATIENT_UPDATE', updated);
          return updated;
        }));
      }
    }, 1500); // 1.5s refresh for real-time feel

    return () => clearInterval(interval);
  }, [mode, activePatientId, patients, broadcast]);

  // 5. TRIGGER DETAILED AI REASONING
  const handleTriggerAnalysis = async () => {
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
          broadcast('PATIENT_UPDATE', data.patient);
        }
      }
    } catch (err) {
      // Fallback local update
      setPatients(prev => prev.map(p => {
        if (p.id !== activePatientId) return p;
        const updated = { ...p, analysis: result };
        broadcast('PATIENT_UPDATE', updated);
        return updated;
      }));
    } finally {
      setIsAnalysing(false);
    }
  };

  // 6. ENROLL A PATIENT
  const handleAddPatient = async (newP: Patient) => {
    try {
      const res = await fetch('/api/patients/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newP)
      });
      if (res.ok) {
        setPatients(prev => [...prev, newP]);
        broadcast('PATIENT_UPDATE', newP);
      }
    } catch (err) {
      setPatients(prev => [...prev, newP]);
      broadcast('PATIENT_UPDATE', newP);
    }
  };

  // 7. REAL WEB BLUETOOTH PAIRING FOR HARDWARE SMARTWATCHES
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
        onToggleSleep={async () => {
          const newVal = !currentPatient.vitals.isSleeping;
          const payload = { patientId: activePatientId, isSleeping: newVal };
          try {
            await fetch('/api/wearable/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {}
          setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, isSleeping: newVal } } : p));
          broadcast('PATIENT_UPDATE', { ...currentPatient, vitals: { ...currentPatient.vitals, isSleeping: newVal } });
        }}
        onToggleScan={async () => {
          const newVal = !currentPatient.vitals.isScanning;
          const payload = { patientId: activePatientId, isScanning: newVal };
          try {
            await fetch('/api/wearable/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {}
          setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, isScanning: newVal } } : p));
          broadcast('PATIENT_UPDATE', { ...currentPatient, vitals: { ...currentPatient.vitals, isScanning: newVal } });
        }}
        onSimulateAnomaly={async () => {
          const payload = {
            patientId: activePatientId,
            heartRate: 145,
            spo2: 89,
            stressLevel: 95,
            systolic: 175,
            diastolic: 105,
            temperature: 38.9,
            accelerometer: { x: 25.4, y: -12.1, z: 2.3 }
          };
          try {
            await fetch('/api/wearable/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {}
          setPatients(prev => prev.map(p => p.id === activePatientId ? {
            ...p,
            vitals: { ...p.vitals, ...payload },
            history: [...p.history, { ...p.vitals, ...payload, timestamp: Date.now() }].slice(-500)
          } : p));
          broadcast('PATIENT_UPDATE', {
            ...currentPatient,
            vitals: { ...currentPatient.vitals, ...payload },
            history: [...currentPatient.history, { ...currentPatient.vitals, ...payload, timestamp: Date.now() }].slice(-500)
          });
        }}
        isEmergency={isEmergency}
        onCancelEmergency={async () => {
          setIsEmergency(false);
          broadcast('SOS_TRIGGER', false);
          const payload = {
            patientId: activePatientId,
            heartRate: 72,
            spo2: 98,
            stressLevel: 15,
            systolic: 125,
            diastolic: 82,
            temperature: 36.6,
            accelerometer: { x: 0, y: 0.2, z: 9.8 }
          };
          try {
            await fetch('/api/sos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isEmergency: false })
            });
            await fetch('/api/wearable/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {}
          setPatients(prev => prev.map(p => p.id === activePatientId ? {
            ...p,
            vitals: { ...p.vitals, ...payload },
            history: [...p.history, { ...p.vitals, ...payload, timestamp: Date.now() }].slice(-500)
          } : p));
          broadcast('PATIENT_UPDATE', {
            ...currentPatient,
            vitals: { ...currentPatient.vitals, ...payload },
            history: [...currentPatient.history, { ...currentPatient.vitals, ...payload, timestamp: Date.now() }].slice(-500)
          });
        }}
        onTriggerSOS={async () => {
          setIsEmergency(true);
          broadcast('SOS_TRIGGER', true);
          try {
            await fetch('/api/sos', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isEmergency: true })
            });
          } catch (e) {}
        }}
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
