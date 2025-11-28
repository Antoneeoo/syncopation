import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppMode, VitalSigns, EmergencyContact, HealthAnalysis, SyncMessage } from './types';
import WearableInterface from './components/WearableInterface';
import CompanionDashboard from './components/CompanionDashboard';
import { analyzeVitals } from './services/geminiService';

const BROADCAST_CHANNEL_NAME = 'vitals_sync_channel';

// Mock initial vitals
const INITIAL_VITALS: VitalSigns = {
  timestamp: Date.now(),
  heartRate: 75,
  spo2: 98,
  temperature: 36.6,
  systolic: 120,
  diastolic: 80,
  steps: 1240,
  stressLevel: 25,
  isSleeping: false,
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SELECT);
  const [vitals, setVitals] = useState<VitalSigns>(INITIAL_VITALS);
  const [history, setHistory] = useState<VitalSigns[]>([INITIAL_VITALS]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Dr. Smith', phone: '555-0123', isAutoDial: true }
  ]);
  const [isEmergency, setIsEmergency] = useState(false);
  const [analysis, setAnalysis] = useState<HealthAnalysis | null>(null);
  const [isAnalysing, setIsAnalysing] = useState(false);

  // Sync Channel
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    
    channelRef.current.onmessage = (event) => {
      const message: SyncMessage = event.data;
      if (message.type === 'VITALS_UPDATE') {
        const newVitals = message.payload;
        setVitals(newVitals);
        setHistory(prev => [...prev, newVitals].slice(-100)); // Keep last 100
      } else if (message.type === 'EMERGENCY_TRIGGER') {
        setIsEmergency(message.payload);
      } else if (message.type === 'ANALYSIS_UPDATE') {
        setAnalysis(message.payload);
      }
    };

    return () => {
      channelRef.current?.close();
    };
  }, []);

  const broadcast = useCallback((type: SyncMessage['type'], payload: any) => {
    channelRef.current?.postMessage({ type, payload });
  }, []);

  // --- Wearable Logic (Data Generation) ---
  useEffect(() => {
    if (mode !== AppMode.WEARABLE) return;

    const interval = setInterval(() => {
      setVitals(prev => {
        // Random fluctuation logic
        const jitter = (base: number, range: number) => base + (Math.random() * range - range/2);
        
        // If simulated emergency/anomaly
        const isAnomaly = prev.heartRate > 130 || prev.spo2 < 90 || prev.temperature > 38 || prev.systolic > 140;

        let newHr = isAnomaly ? jitter(prev.heartRate, 5) : jitter(75, 10);
        let newSpo2 = isAnomaly ? jitter(prev.spo2, 1) : jitter(98, 2);
        
        // Temp and BP fluctuations
        let newTemp = isAnomaly ? jitter(prev.temperature, 0.2) : jitter(36.6, 0.3);
        let newSys = isAnomaly ? jitter(prev.systolic, 5) : jitter(120, 8);
        let newDia = isAnomaly ? jitter(prev.diastolic, 3) : jitter(80, 5);

        // Clamp values
        if(newSpo2 > 100) newSpo2 = 100;
        
        const newVitals: VitalSigns = {
          ...prev,
          timestamp: Date.now(),
          heartRate: Math.round(newHr),
          spo2: Math.round(newSpo2),
          temperature: newTemp,
          systolic: Math.round(newSys),
          diastolic: Math.round(newDia),
          stressLevel: Math.round(Math.max(0, Math.min(100, jitter(isAnomaly ? 85 : 25, 10)))),
          steps: prev.isSleeping ? prev.steps : prev.steps + (Math.random() > 0.5 ? 1 : 0),
        };

        // Check for auto-emergency condition (Persistent high HR + Low SpO2 or Hypertensive Crisis)
        const isCritical = (newVitals.heartRate > 150 && newVitals.spo2 < 90) || (newVitals.systolic > 180);
        
        if (isCritical && !isEmergency) {
             setIsEmergency(true);
             broadcast('EMERGENCY_TRIGGER', true);
        }

        broadcast('VITALS_UPDATE', newVitals);
        return newVitals;
      });
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [mode, broadcast, isEmergency]);

  // --- Handlers ---
  const handleToggleSleep = () => {
    setVitals(prev => {
      const newVal = { ...prev, isSleeping: !prev.isSleeping };
      broadcast('VITALS_UPDATE', newVal);
      return newVal;
    });
  };

  const handleSimulateAnomaly = () => {
    // Spike HR, Drop SpO2, Increase Temp (Fever), Spike BP (Hypertension)
    setVitals(prev => {
      const newVal = { 
        ...prev, 
        heartRate: 160, 
        spo2: 88, 
        stressLevel: 95,
        temperature: 39.2, // Fever
        systolic: 175, // Hypertension
        diastolic: 105
      };
      broadcast('VITALS_UPDATE', newVal);
      return newVal;
    });
  };

  const handleCancelEmergency = () => {
    setIsEmergency(false);
    broadcast('EMERGENCY_TRIGGER', false);
    // Reset vitals to normal
    setVitals(prev => {
        const newVal = { 
          ...prev, 
          heartRate: 75, 
          spo2: 98, 
          stressLevel: 20,
          temperature: 36.6,
          systolic: 120,
          diastolic: 80
        };
        broadcast('VITALS_UPDATE', newVal);
        return newVal;
    });
  };

  const handleTriggerAnalysis = async () => {
    if (history.length < 5) return;
    setIsAnalysing(true);
    const result = await analyzeVitals(history);
    setAnalysis(result);
    broadcast('ANALYSIS_UPDATE', result);
    setIsAnalysing(false);
  };

  const handleAddContact = (contact: EmergencyContact) => {
    setEmergencyContacts(prev => [...prev, contact]);
  };
  
  const handleRemoveContact = (id: string) => {
    setEmergencyContacts(prev => prev.filter(c => c.id !== id));
  };


  // --- Render ---

  if (mode === AppMode.SELECT) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 text-center">
          VitalSync AI
        </h1>
        <p className="text-gray-400 mb-12 text-center max-w-md">
          A cross-device health monitoring system powered by Gemini. Select a mode to begin.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          <button 
            onClick={() => setMode(AppMode.WEARABLE)}
            className="group relative bg-gray-900 border border-gray-800 hover:border-cyan-500 rounded-3xl p-8 transition-all hover:scale-105"
          >
            <div className="absolute inset-0 bg-cyan-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-3xl text-cyan-400">
                <i className="fas fa-watch"></i>
              </div>
              <h2 className="text-2xl font-bold text-white">Wearable Mode</h2>
              <p className="text-gray-400 text-center text-sm">
                Simulates smartwatch interface. Collects biometric data, detects falls, and monitors sleep.
              </p>
            </div>
          </button>

          <button 
            onClick={() => setMode(AppMode.COMPANION)}
            className="group relative bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-3xl p-8 transition-all hover:scale-105"
          >
            <div className="absolute inset-0 bg-blue-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-3xl text-blue-400">
                <i className="fas fa-mobile-alt"></i>
              </div>
              <h2 className="text-2xl font-bold text-white">Companion Mode</h2>
              <p className="text-gray-400 text-center text-sm">
                Smartphone/Desktop dashboard. Visualizes data, manages contacts, and runs Gemini AI analysis.
              </p>
            </div>
          </button>
        </div>
        
        <div className="mt-12 text-gray-600 text-sm">
           <i className="fas fa-info-circle mr-2"></i> 
           Open this URL in two separate tabs/windows to test real-time syncing.
        </div>
      </div>
    );
  }

  if (mode === AppMode.WEARABLE) {
    return (
      <WearableInterface 
        currentVitals={vitals}
        onToggleSleep={handleToggleSleep}
        onSimulateAnomaly={handleSimulateAnomaly}
        isEmergency={isEmergency}
        onCancelEmergency={handleCancelEmergency}
      />
    );
  }

  return (
    <CompanionDashboard 
       vitalsHistory={history}
       currentVitals={vitals}
       analysis={analysis}
       emergencyContacts={emergencyContacts}
       onAddContact={handleAddContact}
       onRemoveContact={handleRemoveContact}
       isAnalysing={isAnalysing}
       onTriggerAnalysis={handleTriggerAnalysis}
    />
  );
};

export default App;