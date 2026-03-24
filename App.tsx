
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, VitalSigns, Patient, EmergencyContact, SyncMessage, DeviceConnection } from './types';
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

  const channelRef = useRef<BroadcastChannel | null>(null);

  // Synchronization initialization
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

  const handleTriggerAnalysis = async () => {
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || isAnalysing) return;

    setIsAnalysing(true);
    const result = await analyzePatientHealth(activePatient);
    
    setPatients(prev => prev.map(p => {
      if (p.id !== activePatientId) return p;
      const updated = { ...p, analysis: result };
      broadcast('PATIENT_UPDATE', updated);
      return updated;
    }));
    setIsAnalysing(false);
  };

  // AUTOMATIC GUARDIAN LOOP: Autonomously monitor the active patient
  useEffect(() => {
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || isAnalysing || mode === AppMode.SELECT) return;

    const v = activePatient.vitals;
    // Agentic threshold check: If HR > 115, SpO2 < 93, Temp > 38.5, or BP is abnormal, run AI check automatically
    const isCritical = v.heartRate > 115 || v.spo2 < 93 || v.temperature > 38.5 || v.systolic > 160 || v.diastolic > 100 || v.systolic < 90;
    
    if (isCritical && !activePatient.analysis?.status.includes('CRITICAL')) {
      handleTriggerAnalysis();
    }
  }, [patients, activePatientId, isAnalysing, mode]);

  // FALL DETECTION LOOP
  useEffect(() => {
    if (mode !== AppMode.WEARABLE || isEmergency) return;
    const activePatient = patients.find(p => p.id === activePatientId);
    if (!activePatient || activePatient.history.length < 5) return;

    // Fast local check before calling AI
    const recentAccel = activePatient.vitals.accelerometer;
    const magnitude = Math.sqrt(recentAccel.x**2 + recentAccel.y**2 + recentAccel.z**2);
    
    if (magnitude > 15) { // Spike detected
      const checkFall = async () => {
        const detected = await detectFalls(activePatient.history);
        if (detected) {
          setIsEmergency(true);
          broadcast('SOS_TRIGGER', true);
        }
      };
      checkFall();
    }
  }, [patients, activePatientId, mode, isEmergency, broadcast]);

  // WEARABLE DATA GENERATION
  useEffect(() => {
    if (mode !== AppMode.WEARABLE) return;

    const interval = setInterval(() => {
      setPatients(prev => {
        return prev.map(p => {
          if (p.id !== activePatientId) return p;

          const jitter = (b: number, r: number) => b + (Math.random() * r - r/2);
          
          // Natural drift
          let newHr = jitter(p.vitals.heartRate, 4);
          let newSpo2 = jitter(p.vitals.spo2, 0.5);
          let newSystolic = jitter(p.vitals.systolic, 2);
          let newDiastolic = jitter(p.vitals.diastolic, 1.5);
          
          // Keep values within realistic bounds
          newHr = Math.max(40, Math.min(200, newHr));
          newSpo2 = Math.max(80, Math.min(100, newSpo2));
          newSystolic = Math.max(70, Math.min(220, newSystolic));
          newDiastolic = Math.max(40, Math.min(130, newDiastolic));

          const newVitals: VitalSigns = {
            ...p.vitals,
            timestamp: Date.now(),
            heartRate: Math.round(newHr),
            spo2: Math.round(newSpo2),
            systolic: Math.round(newSystolic),
            diastolic: Math.round(newDiastolic),
            temperature: jitter(p.vitals.temperature, 0.1),
            steps: p.vitals.isSleeping ? p.vitals.steps : p.vitals.steps + (Math.random() > 0.85 ? 1 : 0),
            accelerometer: {
              x: jitter(0, 0.2),
              y: jitter(0.2, 0.2),
              z: jitter(9.8, 0.1)
            }
          };

          const updatedPatient = {
            ...p,
            vitals: newVitals,
            history: [...p.history, newVitals].slice(-500)
          };

          broadcast('PATIENT_UPDATE', updatedPatient);
          return updatedPatient;
        });
      });
    }, 1500); // 1.5s refresh for real-time feel

    return () => clearInterval(interval);
  }, [mode, activePatientId, broadcast]);

  const handleAddPatient = (newP: Patient) => {
    setPatients(prev => [...prev, newP]);
    broadcast('PATIENT_UPDATE', newP);
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
             <p className="text-gray-500 text-lg leading-relaxed text-left font-medium">Central command interface. Manage multiple patients with agentic trend analysis via Gemini 3 Pro.</p>
          </button>
        </div>

        <div className="mt-20 flex items-center gap-6 px-8 py-4 bg-gray-900/40 rounded-full border border-gray-800 text-[10px] text-gray-600 font-black uppercase tracking-widest shadow-inner">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></div>
              <span>Network Active</span>
           </div>
           <div className="w-px h-4 bg-gray-800"></div>
           <span>API Key: {process.env.API_KEY ? 'DETECTED' : 'MISSING'}</span>
        </div>
      </div>
    );
  }

  if (mode === AppMode.WEARABLE) {
    return (
      <WearableInterface 
        currentPatient={currentPatient}
        onToggleSleep={() => {
          setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, isSleeping: !p.vitals.isSleeping } } : p));
        }}
        onToggleScan={() => {
           setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, isScanning: !p.vitals.isScanning } } : p));
        }}
        onSimulateAnomaly={() => {
          setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, heartRate: 158, spo2: 89, stressLevel: 98, systolic: 195, diastolic: 115, accelerometer: { x: 25.4, y: -12.1, z: 2.3 } } } : p));
        }}
        isEmergency={isEmergency}
        onCancelEmergency={() => { 
          setIsEmergency(false); 
          broadcast('SOS_TRIGGER', false); 
          setPatients(prev => prev.map(p => p.id === activePatientId ? { ...p, vitals: { ...p.vitals, heartRate: 72, spo2: 98, stressLevel: 15, systolic: 125, diastolic: 82, accelerometer: { x: 0, y: 0.2, z: 9.8 } } } : p));
        }}
        onTriggerSOS={() => { setIsEmergency(true); broadcast('SOS_TRIGGER', true); }}
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
    />
  );
};

export default App;
