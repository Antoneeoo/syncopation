
import React, { useState, useEffect } from 'react';
import { VitalSigns, Patient } from '../types';

interface WearableProps {
  currentPatient: Patient;
  onToggleSleep: () => void;
  onSimulateAnomaly: () => void;
  isEmergency: boolean;
  onCancelEmergency: () => void;
  onTriggerSOS: () => void;
  onToggleScan: () => void;
}

const WearableInterface: React.FC<WearableProps> = ({ 
  currentPatient, 
  onToggleSleep, 
  onSimulateAnomaly,
  isEmergency,
  onCancelEmergency,
  onTriggerSOS,
  onToggleScan
}) => {
  const [time, setTime] = useState(new Date());
  const vitals = currentPatient.vitals;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (isEmergency) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-900 animate-pulse text-white p-6 text-center">
        <i className="fas fa-exclamation-triangle text-6xl mb-6"></i>
        <h1 className="text-4xl font-black mb-2">SOS ACTIVE</h1>
        <p className="text-lg mb-8 opacity-80">Monitoring Agent: Rescuers Dispatched</p>
        <button onClick={onCancelEmergency} className="bg-white text-red-900 font-bold py-4 px-10 rounded-full shadow-2xl">CANCEL</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4 font-sans relative overflow-hidden">
      {/* Network Status Header */}
      <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div>
          HUB-SYNC: {currentPatient.name.split(' ')[0]}
        </div>
        <div className="flex gap-2">
          <i className="fas fa-wifi text-cyan-500"></i>
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center space-y-6">
        <div onClick={onToggleScan} className="relative cursor-pointer group">
          <div className={`absolute inset-0 rounded-full border-2 ${vitals.isScanning ? 'border-cyan-500 animate-ping' : 'border-gray-800'}`}></div>
          <div className="w-44 h-44 rounded-full bg-gray-950 flex flex-col items-center justify-center border-4 border-gray-900 shadow-[0_0_30px_rgba(0,0,0,1)]">
            <span className={`text-6xl font-black ${vitals.heartRate > 100 ? 'text-red-500' : 'text-cyan-400'}`}>{vitals.heartRate}</span>
            <span className="text-[10px] text-gray-500 font-bold tracking-tighter">AVG BPM</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-gray-900/50 p-4 rounded-[2rem] border border-gray-800 flex flex-col items-center">
             <span className="text-[10px] text-gray-500 uppercase mb-1">Temp</span>
             <span className="text-xl font-bold">{vitals.temperature.toFixed(1)}°</span>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-[2rem] border border-gray-800 flex flex-col items-center">
             <span className="text-[10px] text-gray-500 uppercase mb-1">SpO2</span>
             <span className="text-xl font-bold">{vitals.spo2}%</span>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-[2rem] border border-gray-800 flex flex-col items-center col-span-2">
             <span className="text-[10px] text-gray-500 uppercase mb-1">BP (mmHg)</span>
             <span className="text-xl font-bold">{vitals.systolic}/{vitals.diastolic}</span>
          </div>
        </div>

        <div className="w-full space-y-2">
          <button onClick={onTriggerSOS} className="w-full bg-red-600 py-4 rounded-3xl font-black uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95 transition-all">SOS ALERT</button>
          <div className="flex gap-2">
            <button onClick={onToggleSleep} className={`flex-1 py-3 rounded-3xl font-bold text-xs uppercase ${vitals.isSleeping ? 'bg-purple-600' : 'bg-gray-800 text-gray-400'}`}>
              <i className="fas fa-moon mr-2"></i> Sleep
            </button>
            <button onClick={onSimulateAnomaly} className="flex-1 py-3 rounded-3xl bg-gray-800 text-gray-400 font-bold text-xs uppercase">
              Simulate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WearableInterface;
