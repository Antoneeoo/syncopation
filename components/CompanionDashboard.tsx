import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Patient, DeviceConnection } from '../types';

interface CompanionProps {
  patients: Patient[];
  activePatientId: string;
  onSwitchPatient: (id: string) => void;
  onAddPatient: (patient: Patient) => void;
  devices: DeviceConnection[];
  onTriggerAnalysis: () => void;
  isAnalysing: boolean;
  bleStatus: 'DISCONNECTED' | 'SEARCHING' | 'CONNECTING' | 'CONNECTED';
  bleDeviceName: string;
  onConnectBluetooth: () => void;
}

const CompanionDashboard: React.FC<CompanionProps> = ({
  patients,
  activePatientId,
  onSwitchPatient,
  onAddPatient,
  devices,
  onTriggerAnalysis,
  isAnalysing,
  bleStatus,
  bleDeviceName,
  onConnectBluetooth
}) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'PATIENTS' | 'INTEGRATION' | 'LOGS'>('DASHBOARD');
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [syncStatus, setSyncStatus] = useState<string>('');

  const patient = patients.find(p => p.id === activePatientId) || patients[0];

  const chartData = patient.history.slice(-60).map((v) => ({
    time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    heartRate: v.heartRate,
    spo2: v.spo2,
    temp: v.temperature.toFixed(1)
  }));

  const exportCSV = () => {
    const header = "Timestamp,HeartRate,SpO2,Temperature,BloodPressure\n";
    const body = patient.history.map(h => `${new Date(h.timestamp).toISOString()},${h.heartRate},${h.spo2},${h.temperature},${h.systolic}/${h.diastolic}`).join("\n");
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VITALSYNC_REPORT_${patient.name.toUpperCase()}_${Date.now()}.csv`;
    a.click();
  };

  const addNewPatient = () => {
    if (!newPatientName) return;
    const newP: Patient = {
      id: `p${Date.now()}`,
      name: newPatientName,
      age: 30,
      gender: 'Undisclosed',
      bloodType: 'O+',
      vitals: patient.vitals,
      history: [],
      analysis: null
    };
    onAddPatient(newP);
    setNewPatientName('');
    setIsAddingPatient(false);
  };

  // Live Sync Webhook Simulators
  const simulateAppleWatchSync = async () => {
    setSyncStatus('Syncing Apple HealthKit...');
    const payload = {
      patientId: activePatientId,
      source: 'AppleWatch',
      deviceName: 'Apple Watch Ultra 2',
      battery: 89,
      samples: [
        { type: 'HKQuantityTypeIdentifierHeartRate', value: Math.floor(75 + Math.random() * 20), unit: 'count/min' },
        { type: 'HKQuantityTypeIdentifierOxygenSaturation', value: 0.98, unit: '%' },
        { type: 'HKQuantityTypeIdentifierBodyTemperature', value: 98.4, unit: 'degF' },
        { type: 'HKQuantityTypeIdentifierBloodPressureSystolic', value: 122, unit: 'mmHg' },
        { type: 'HKQuantityTypeIdentifierBloodPressureDiastolic', value: 81, unit: 'mmHg' }
      ]
    };
    try {
      const res = await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSyncStatus('Apple Watch HealthKit successfully synced!');
        setTimeout(() => setSyncStatus(''), 3000);
      }
    } catch (err) {
      setSyncStatus('Sync failed: Server offline.');
    }
  };

  const simulateSamsungWatchSync = async () => {
    setSyncStatus('Syncing Samsung S-Health...');
    const payload = {
      patientId: activePatientId,
      source: 'SamsungWatch',
      deviceName: 'Galaxy Watch 6 Classic',
      battery: 76,
      data: {
        'com.samsung.health.heart_rate': { bpm: Math.floor(70 + Math.random() * 15) },
        'com.samsung.health.oxygen_saturation': { spo2: 99 },
        'com.samsung.health.blood_pressure': { systolic: 119, diastolic: 78 },
        'com.samsung.health.step_count': { steps: 540 }
      }
    };
    try {
      const res = await fetch('/api/wearable/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSyncStatus('Samsung Galaxy Watch successfully synced!');
        setTimeout(() => setSyncStatus(''), 3000);
      }
    } catch (err) {
      setSyncStatus('Sync failed: Server offline.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* Dynamic Sidebar */}
      <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col z-20">
        <div className="p-8 pb-10">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:scale-105 transition-transform">
              <i className="fas fa-shield-heart text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none mb-1">VITALSYNC</h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Enterprise Mesh</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {[
            { id: 'DASHBOARD', icon: 'fa-cubes-stacked', label: 'Command Hub' },
            { id: 'PATIENTS', icon: 'fa-address-book', label: 'Patient Mesh' },
            { id: 'INTEGRATION', icon: 'fa-network-wired', label: 'Watch Integrations' },
            { id: 'LOGS', icon: 'fa-brain', label: 'Agent Intelligence' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-3xl transition-all font-bold text-sm ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40' : 'text-gray-500 hover:bg-white/5'}`}
            >
              <i className={`fas ${tab.icon} w-5 text-lg`}></i> {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-6">
           <div className="bg-black/40 p-5 rounded-3xl border border-gray-800 flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-gray-600 text-xl border border-gray-700">
                  <i className="fas fa-id-card-clip"></i>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-gray-900"></div>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-sm font-black truncate">{patient.name}</div>
                <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Agent Active</div>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="flex-1 overflow-y-auto relative bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.05),transparent)]">
        <header className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-3xl border-b border-gray-800 px-10 py-8 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-1">System View</div>
            <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">
              {activeTab === 'INTEGRATION' ? 'Smart Watch Sync API' : activeTab.replace('_', ' ')}
            </h2>
          </div>
          <div className="flex gap-4">
            <button onClick={exportCSV} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-2xl text-xs font-black transition-all border border-gray-700 uppercase tracking-widest">
              <i className="fas fa-file-csv mr-2"></i> Report
            </button>
            <button 
              onClick={onTriggerAnalysis} 
              disabled={isAnalysing} 
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-2xl text-xs font-black transition-all shadow-xl shadow-cyan-900/30 uppercase tracking-widest flex items-center gap-2"
            >
              {isAnalysing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-atom"></i>}
              Deep Scan
            </button>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-10">
              {/* Vitals Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Heart Rate', val: patient.vitals.heartRate, unit: 'BPM', color: 'text-red-500', bg: 'bg-red-500/5', icon: 'fa-heartbeat' },
                  { label: 'Oxygen SpO2', val: patient.vitals.spo2, unit: '%', color: 'text-blue-400', bg: 'bg-blue-400/5', icon: 'fa-lungs' },
                  { label: 'Pressure (S/D)', val: `${patient.vitals.systolic}/${patient.vitals.diastolic}`, unit: 'mmHg', color: 'text-pink-400', bg: 'bg-pink-400/5', icon: 'fa-gauge-high' },
                  { label: 'Core Temp', val: patient.vitals.temperature.toFixed(1), unit: '°C', color: 'text-orange-400', bg: 'bg-orange-400/5', icon: 'fa-thermometer-half' },
                ].map((stat, i) => (
                  <div key={i} className={`p-8 rounded-[2.5rem] border border-gray-800 transition-all hover:scale-[1.02] shadow-sm flex flex-col items-center text-center ${stat.bg}`}>
                    <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
                      <i className={`fas ${stat.icon} ${stat.color} text-xl`}></i>
                    </div>
                    <div className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-5xl font-black ${stat.color} tracking-tighter`}>
                      {stat.val} <span className="text-sm font-bold text-gray-700 ml-1">{stat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Main Telemetry Visuals */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                  <div className="bg-gray-900/30 p-10 rounded-[3rem] border border-gray-800 shadow-2xl">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> Live Cardiac Stream
                      </h3>
                      <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Auto-sampling: 1.5s</div>
                    </div>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} opacity={0.3} />
                          <XAxis dataKey="time" stroke="#4b5563" tick={{fontSize: 9}} hide={true} />
                          <YAxis stroke="#4b5563" tick={{fontSize: 10}} domain={['dataMin - 10', 'dataMax + 10']} />
                          <Tooltip contentStyle={{backgroundColor: '#0d1117', border: '1px solid #1f2937', borderRadius: '20px'}} />
                          <Area type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#colorHr)" animationDuration={300} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="bg-gray-900 p-10 rounded-[3rem] border border-gray-800 h-full flex flex-col shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <i className="fas fa-robot text-8xl"></i>
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                      <i className="fas fa-brain text-cyan-400"></i> Guardian Logic
                    </h3>
                    <div className="flex-1 space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                      {patient.analysis?.agentActions?.map((action, i) => (
                        <div key={i} className="flex gap-5 group items-start">
                          <div className="flex flex-col items-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan] mt-1.5 ring-4 ring-cyan-500/10"></div>
                            <div className="w-px h-12 bg-gradient-to-b from-cyan-500/50 to-transparent my-1"></div>
                          </div>
                          <div className="bg-gray-800/20 p-4 rounded-2xl border border-gray-800 group-hover:bg-cyan-500/5 transition-colors w-full">
                            <div className="text-[10px] text-gray-600 font-black uppercase mb-1">{new Date().toLocaleTimeString()}</div>
                            <p className="text-xs text-gray-300 font-bold leading-relaxed">{action}</p>
                          </div>
                        </div>
                      ))}
                      {(!patient.analysis?.agentActions || patient.analysis.agentActions.length === 0) && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-20">
                           <i className="fas fa-wave-square text-4xl mb-4"></i>
                           <p className="text-xs font-black uppercase tracking-widest">Awaiting Biometric Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PATIENTS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {patients.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => onSwitchPatient(p.id)}
                  className={`p-10 rounded-[3rem] border cursor-pointer transition-all hover:translate-y-[-5px] ${activePatientId === p.id ? 'bg-blue-600/10 border-blue-500 shadow-2xl' : 'bg-gray-900/40 border-gray-800'}`}
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl border ${activePatientId === p.id ? 'bg-blue-500 text-white border-blue-400' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                      <i className="fas fa-user-shield"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-xl tracking-tighter">{p.name}</h4>
                      <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{p.gender}, {p.age}y • {p.bloodType}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-6">
                    <div>
                      <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Status</div>
                      <div className={`text-xs font-black ${p.vitals.heartRate > 110 ? 'text-red-500' : 'text-green-500'}`}>
                        {p.vitals.heartRate > 110 ? 'ATTENTION REQ.' : 'STABLE'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">HR AVG</div>
                      <div className="text-xs font-black">{p.vitals.heartRate} BPM</div>
                    </div>
                  </div>
                </div>
              ))}
              
              {!isAddingPatient ? (
                <button 
                  onClick={() => setIsAddingPatient(true)}
                  className="p-10 rounded-[3rem] border-2 border-dashed border-gray-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-col items-center justify-center text-gray-700 group h-full min-h-[220px]"
                >
                  <i className="fas fa-plus-circle text-4xl mb-4 group-hover:scale-110 transition-transform"></i>
                  <span className="text-xs font-black uppercase tracking-widest">Enroll New Node</span>
                </button>
              ) : (
                <div className="p-10 rounded-[3rem] border-2 border-blue-500 bg-gray-900 shadow-2xl flex flex-col gap-4">
                  <h4 className="text-sm font-black uppercase tracking-widest text-blue-400">Add New Patient</h4>
                  <input 
                    type="text" 
                    placeholder="ENTER NAME" 
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={addNewPatient} className="flex-1 bg-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest">Enroll</button>
                    <button onClick={() => setIsAddingPatient(false)} className="px-6 py-4 rounded-2xl font-black text-[10px] bg-gray-800 uppercase tracking-widest">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'INTEGRATION' && (
            <div className="space-y-10">
              {/* API and Integration Controller */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Hardware pairing */}
                <div className="bg-gray-900/50 p-10 rounded-[3rem] border border-gray-800 shadow-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-widest">BLE Protocol v2</span>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mt-1 mb-4">Real Smart Watch Pairing</h3>
                    <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                      Connect any standard Bluetooth Low Energy watch, wristband, or heart rate monitor directly. The system registers GATT heart rate notifications in real-time.
                    </p>
                    
                    <div className="bg-black/50 p-6 rounded-2xl border border-gray-800 flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${bleStatus === 'CONNECTED' ? 'bg-cyan-500/15 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}>
                          <i className="fas fa-heartbeat"></i>
                        </div>
                        <div>
                          <div className="text-sm font-bold">{bleStatus === 'CONNECTED' ? bleDeviceName : 'No Hardware Connected'}</div>
                          <div className="text-[10px] text-gray-600 font-bold uppercase">GATT Server Status</div>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        bleStatus === 'CONNECTED' ? 'bg-green-500/10 text-green-400' :
                        bleStatus === 'CONNECTING' ? 'bg-orange-500/10 text-orange-400' :
                        bleStatus === 'SEARCHING' ? 'bg-blue-500/10 text-blue-400 animate-pulse' : 'bg-gray-800 text-gray-500'
                      }`}>
                        {bleStatus}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={onConnectBluetooth}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-cyan-950/40"
                  >
                    <i className="fab fa-bluetooth mr-2 text-sm"></i> Pair Bluetooth Watch
                  </button>
                </div>

                {/* Cloud Sync Simulator */}
                <div className="bg-gray-900/50 p-10 rounded-[3rem] border border-gray-800 shadow-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Webhook Sync Proxy</span>
                    <h3 className="text-2xl font-black uppercase tracking-tighter mt-1 mb-4">Apple & Samsung Cloud Sim</h3>
                    <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                      Test push synchronization. Apple Watch and Samsung Galaxy Watch use native background worker loops to post health metrics. Press below to simulate.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <button 
                        onClick={simulateAppleWatchSync}
                        className="bg-black/40 hover:bg-black/60 p-6 rounded-2xl border border-gray-800 text-center transition-all group flex flex-col items-center"
                      >
                        <i className="fab fa-apple text-3xl mb-3 text-gray-400 group-hover:text-white transition-colors"></i>
                        <span className="text-xs font-black uppercase">Apple HealthKit</span>
                        <span className="text-[9px] text-gray-600 mt-1">iOS Swift Payload</span>
                      </button>

                      <button 
                        onClick={simulateSamsungWatchSync}
                        className="bg-black/40 hover:bg-black/60 p-6 rounded-2xl border border-gray-800 text-center transition-all group flex flex-col items-center"
                      >
                        <i className="fas fa-mobile-android text-3xl mb-3 text-gray-400 group-hover:text-white transition-colors"></i>
                        <span className="text-xs font-black uppercase">Samsung Health</span>
                        <span className="text-[9px] text-gray-600 mt-1">WearOS SDK Payload</span>
                      </button>
                    </div>
                  </div>

                  {syncStatus && (
                    <div className="text-center py-2 text-xs font-bold text-cyan-400 tracking-wide animate-pulse">
                      {syncStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Developer Integration Code Specifications */}
              <div className="bg-gray-900/50 p-10 rounded-[3rem] border border-gray-800 shadow-xl">
                <h3 className="text-2xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                  <i className="fas fa-code text-cyan-400"></i> Universal Smart Watch Integration SDK
                </h3>
                <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                  The backend of VitalSync is universally compatible with Apple Watch, WearOS, Samsung Smart Watch, Garmin, and Custom wearables. Send standard POST JSON requests to bind and stream real-time telemetry instantly.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Swift Payload Example */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Apple Watch (HealthKit/Swift)</span>
                    <pre className="bg-black/80 p-6 rounded-2xl border border-gray-800 text-gray-400 text-xs font-mono overflow-x-auto h-[260px] custom-scrollbar">
{`// iOS Companion App background dispatcher
let url = URL(string: "https://vitalsync.io/api/wearable/sync")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.addValue("application/json", forHTTPHeaderField: "Content-Type")

let payload: [String: Any] = [
    "patientId": "p1",
    "source": "AppleWatch",
    "deviceName": "Apple Watch Series 9",
    "samples": [
        ["type": "HKQuantityTypeIdentifierHeartRate", "value": 78, "unit": "count/min"],
        ["type": "HKQuantityTypeIdentifierOxygenSaturation", "value": 0.99, "unit": "%"],
        ["type": "HKQuantityTypeIdentifierBloodPressureSystolic", "value": 120, "unit": "mmHg"],
        ["type": "HKQuantityTypeIdentifierBloodPressureDiastolic", "value": 80, "unit": "mmHg"]
    ]
]
request.httpBody = try? JSONSerialization.data(withJSONObject: payload)`}
                    </pre>
                  </div>

                  {/* Kotlin Payload Example */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">WearOS & Samsung (Health Connect)</span>
                    <pre className="bg-black/80 p-6 rounded-2xl border border-gray-800 text-gray-400 text-xs font-mono overflow-x-auto h-[260px] custom-scrollbar">
{`// Android / WearOS Coroutine sync dispatcher
val client = OkHttpClient()
val payload = JSONObject().apply {
    put("patientId", "p1")
    put("source", "SamsungWatch")
    put("deviceName", "Galaxy Watch 6 Pro")
    put("data", JSONObject().apply {
        put("com.samsung.health.heart_rate", JSONObject().put("bpm", 82))
        put("com.samsung.health.oxygen_saturation", JSONObject().put("spo2", 98))
        put("com.samsung.health.blood_pressure", JSONObject().apply {
            put("systolic", 121)
            put("diastolic", 79)
        })
    })
}
val body = payload.toString().toRequestBody("application/json".toMediaType())
val request = Request.Builder()
    .url("https://vitalsync.io/api/wearable/sync")
    .post(body)
    .build()`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'LOGS' && (
            <div className="space-y-10">
              <div className="bg-gray-900/50 p-12 rounded-[3rem] border border-gray-800 shadow-xl">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-2xl font-black tracking-tighter uppercase">Device Mesh Topology</h3>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-2 text-[10px] text-gray-500 font-black uppercase tracking-widest">
                       <i className="fas fa-circle text-cyan-500"></i> Active Nodes
                    </span>
                    <button className="text-[10px] font-black text-cyan-500 hover:text-cyan-400 transition-colors uppercase tracking-widest underline decoration-2 underline-offset-4">Rescan Network</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {devices.map(d => (
                    <div key={d.id} className="bg-black/40 p-8 rounded-[2.5rem] border border-gray-800 flex items-center justify-between group transition-all hover:bg-white/5">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ${d.status === 'CONNECTED' ? 'bg-cyan-500/10 text-cyan-500' : 'bg-gray-800 text-gray-500'}`}>
                          <i className={`fas ${d.type === 'WATCH' ? 'fa-clock-rotate-left' : 'fa-sensor'}`}></i>
                        </div>
                        <div>
                          <div className="font-black text-lg tracking-tighter">{d.name}</div>
                          <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">{d.status} • {d.battery}% BATT</div>
                        </div>
                      </div>
                      {d.status === 'CONNECTED' && (
                        <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CompanionDashboard;
