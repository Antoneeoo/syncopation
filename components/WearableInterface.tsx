import React, { useState, useEffect } from 'react';
import { VitalSigns } from '../types';

interface WearableProps {
  currentVitals: VitalSigns;
  onToggleSleep: () => void;
  onSimulateAnomaly: () => void;
  isEmergency: boolean;
  onCancelEmergency: () => void;
}

const WearableInterface: React.FC<WearableProps> = ({ 
  currentVitals, 
  onToggleSleep, 
  onSimulateAnomaly,
  isEmergency,
  onCancelEmergency
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isEmergency) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-900 animate-pulse text-white p-6 text-center">
        <i className="fas fa-exclamation-triangle text-6xl mb-4 text-yellow-400"></i>
        <h1 className="text-3xl font-bold mb-2">EMERGENCY</h1>
        <p className="text-xl mb-8">Vitals Critical. Calling Help...</p>
        <button 
          onClick={onCancelEmergency}
          className="bg-white text-red-900 font-bold py-4 px-8 rounded-full text-xl shadow-lg active:scale-95 transition-transform"
        >
          I'M OKAY (CANCEL)
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white p-4 font-sans select-none overflow-y-auto">
      {/* Header / StatusBar */}
      <div className="flex justify-between items-center mb-4 px-2">
        <span className="text-gray-400 text-sm">{formatTime(time)}</span>
        <div className="flex gap-2 text-green-500 text-xs">
          <i className="fas fa-battery-three-quarters"></i>
          <i className="fas fa-wifi"></i>
        </div>
      </div>

      {/* Main Rings / Stats */}
      <div className="flex-grow flex flex-col items-center justify-center space-y-4">
        
        {/* Heart Rate (Primary) */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
             <circle cx="50%" cy="50%" r="60" fill="transparent" stroke="#333" strokeWidth="6" />
             <circle 
                cx="50%" cy="50%" r="60" fill="transparent" stroke="#ef4444" strokeWidth="6" 
                strokeDasharray="377" strokeDashoffset={377 - (377 * (currentVitals.heartRate / 200))}
                className="transition-all duration-1000 ease-in-out"
             />
          </svg>
          <div className="text-center z-10">
            <div className="text-4xl font-bold text-red-500 flex flex-col items-center">
              {currentVitals.heartRate}
              <i className="fas fa-heart text-xl mt-1 animate-pulse"></i>
            </div>
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">BPM</span>
          </div>
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-2 gap-3 w-full px-1">
          <div className="bg-gray-900 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800">
            <span className="text-blue-400 text-xs mb-1"><i className="fas fa-tint"></i> SpO2</span>
            <span className="text-xl font-semibold">{currentVitals.spo2}%</span>
          </div>
          <div className="bg-gray-900 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800">
            <span className="text-orange-400 text-xs mb-1"><i className="fas fa-thermometer-half"></i> Temp</span>
            <span className="text-xl font-semibold">{currentVitals.temperature.toFixed(1)}°C</span>
          </div>
          <div className="bg-gray-900 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800">
            <span className="text-pink-400 text-xs mb-1"><i className="fas fa-activity"></i> BP</span>
            <span className="text-lg font-semibold whitespace-nowrap">{currentVitals.systolic}/{currentVitals.diastolic}</span>
          </div>
          <div className="bg-gray-900 rounded-2xl p-3 flex flex-col items-center justify-center border border-gray-800">
            <span className="text-yellow-400 text-xs mb-1"><i className="fas fa-shoe-prints"></i> Steps</span>
            <span className="text-xl font-semibold">{currentVitals.steps}</span>
          </div>
        </div>

        {/* Sleep Toggle */}
        <button 
          onClick={onToggleSleep}
          className={`w-full py-3 rounded-2xl flex items-center justify-center gap-3 transition-colors ${
            currentVitals.isSleeping ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <i className="fas fa-bed text-lg"></i>
          <span className="font-semibold text-sm">{currentVitals.isSleeping ? 'Sleeping Mode ON' : 'Sleep Tracking'}</span>
        </button>
      </div>

      {/* Footer Controls */}
      <div className="mt-auto pt-2 flex justify-center pb-2">
         <button 
           onClick={onSimulateAnomaly}
           className="text-xs text-red-900 bg-red-900/20 border border-red-900/50 px-4 py-2 rounded-full opacity-60 hover:opacity-100 transition-opacity"
         >
           Simulate Anomaly
         </button>
      </div>
    </div>
  );
};

export default WearableInterface;