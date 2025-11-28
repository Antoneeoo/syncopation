import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts';
import { VitalSigns, HealthAnalysis, EmergencyContact } from '../types';

interface CompanionProps {
  vitalsHistory: VitalSigns[];
  currentVitals: VitalSigns;
  analysis: HealthAnalysis | null;
  emergencyContacts: EmergencyContact[];
  onAddContact: (contact: EmergencyContact) => void;
  onRemoveContact: (id: string) => void;
  isAnalysing: boolean;
  onTriggerAnalysis: () => void;
}

const CompanionDashboard: React.FC<CompanionProps> = ({
  vitalsHistory,
  currentVitals,
  analysis,
  emergencyContacts,
  onAddContact,
  onRemoveContact,
  isAnalysing,
  onTriggerAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'SETTINGS'>('DASHBOARD');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const handleAddContact = () => {
    if (newContactName && newContactPhone) {
      onAddContact({
        id: Date.now().toString(),
        name: newContactName,
        phone: newContactPhone,
        isAutoDial: true
      });
      setNewContactName('');
      setNewContactPhone('');
    }
  };

  // Format data for Recharts
  const chartData = vitalsHistory.slice(-50).map((v) => ({
    time: new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    heartRate: v.heartRate,
    spo2: v.spo2,
    stress: v.stressLevel,
    systolic: v.systolic,
    diastolic: v.diastolic,
    temperature: v.temperature
  }));

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 hidden md:flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            VitalSync AI
          </h1>
          <p className="text-xs text-gray-500 mt-1">Companion Dashboard</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fas fa-chart-line"></i> Dashboard
          </button>
          <button 
             onClick={() => setActiveTab('SETTINGS')}
             className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'SETTINGS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800'}`}
          >
            <i className="fas fa-cog"></i> Settings
          </button>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-sm text-gray-400">Wearable Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Heart Rate</div>
                <div className="text-2xl font-bold text-red-500">{currentVitals.heartRate} <span className="text-xs text-gray-500">bpm</span></div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Blood Pressure</div>
                <div className="text-2xl font-bold text-pink-400">{currentVitals.systolic}/{currentVitals.diastolic}</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Temperature</div>
                <div className="text-2xl font-bold text-orange-400">{currentVitals.temperature.toFixed(1)}°C</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Blood Oxygen</div>
                <div className="text-2xl font-bold text-blue-400">{currentVitals.spo2}%</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Stress Level</div>
                <div className="text-2xl font-bold text-purple-400">{currentVitals.stressLevel} <span className="text-xs text-gray-500">/100</span></div>
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                <div className="text-gray-400 text-xs mb-1">Steps</div>
                <div className="text-2xl font-bold text-emerald-400">{currentVitals.steps}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Charts Section */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Chart 1: HR & SpO2 */}
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fas fa-heartbeat text-red-500"></i> Heart Rate & SpO2
                  </h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="time" stroke="#9ca3af" tick={{fontSize: 10}} minTickGap={30} />
                        <YAxis stroke="#9ca3af" domain={[40, 160]} tick={{fontSize: 10}} />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff'}}
                          itemStyle={{color: '#fff'}}
                        />
                        <Area type="monotone" dataKey="heartRate" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorHr)" name="HR (bpm)" />
                        <Line type="monotone" dataKey="spo2" stroke="#3b82f6" strokeWidth={2} dot={false} name="SpO2 (%)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Hemodynamics & Temp */}
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <i className="fas fa-activity text-pink-500"></i> Hemodynamics & Temperature
                  </h3>
                   <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="time" stroke="#9ca3af" tick={{fontSize: 10}} minTickGap={30} />
                        <YAxis yAxisId="left" stroke="#ec4899" domain={[40, 200]} tick={{fontSize: 10}} label={{ value: 'mmHg', angle: -90, position: 'insideLeft', fill: '#ec4899' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f97316" domain={[35, 42]} tick={{fontSize: 10}} label={{ value: '°C', angle: 90, position: 'insideRight', fill: '#f97316' }} />
                        <Tooltip contentStyle={{backgroundColor: '#1f2937', borderColor: '#374151'}} />
                        <Line yAxisId="left" type="monotone" dataKey="systolic" stroke="#ec4899" strokeWidth={2} dot={false} name="Systolic" />
                        <Line yAxisId="left" type="monotone" dataKey="diastolic" stroke="#db2777" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Diastolic" />
                        <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#f97316" strokeWidth={2} dot={false} name="Temp (°C)" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* AI Analysis Panel */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700 rounded-3xl p-6 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                      Gemini Health AI
                    </h3>
                    <button 
                      onClick={onTriggerAnalysis}
                      disabled={isAnalysing}
                      className="text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isAnalysing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-magic"></i>}
                      Analyze
                    </button>
                  </div>

                  {!analysis ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-center space-y-4">
                       <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center animate-pulse">
                         <i className="fas fa-user-md text-4xl text-gray-600"></i>
                       </div>
                       <div>
                         <p className="text-lg font-semibold text-gray-400">Ready for Analysis</p>
                         <p className="text-sm">Click "Analyze" to process vitals, detect anomalies, and generate health insights using Gemini.</p>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in flex-1 overflow-y-auto pr-1">
                       <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                         analysis.status === 'CRITICAL' ? 'bg-red-900/30 border-red-500/50 text-red-200' :
                         analysis.status === 'WARNING' ? 'bg-yellow-900/30 border-yellow-500/50 text-yellow-200' :
                         'bg-green-900/30 border-green-500/50 text-green-200'
                       }`}>
                          <i className={`text-2xl fas ${analysis.status === 'NORMAL' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                          <div>
                            <div className="text-xs opacity-70 font-bold uppercase tracking-wider">Health Status</div>
                            <div className="font-bold text-lg">{analysis.status}</div>
                          </div>
                       </div>
                       
                       <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700/50">
                          <p className="text-gray-300 text-sm leading-relaxed">{analysis.summary}</p>
                       </div>

                       {analysis.anomaliesDetected.length > 0 ? (
                         <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30">
                           <div className="flex items-center gap-2 mb-3">
                             <i className="fas fa-bolt text-red-500"></i>
                             <span className="text-xs text-red-400 font-bold uppercase tracking-wide">Detected Anomalies</span>
                           </div>
                           <ul className="space-y-2">
                             {analysis.anomaliesDetected.map((a, i) => (
                               <li key={i} className="flex items-start gap-3 text-sm text-red-200 bg-red-900/20 p-2 rounded-lg">
                                 <i className="fas fa-exclamation-circle mt-1 text-xs text-red-400"></i>
                                 <span>{a}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       ) : (
                          <div className="flex items-center gap-2 text-green-500/50 text-sm px-2">
                            <i className="fas fa-shield-alt"></i> No anomalies detected.
                          </div>
                       )}
                       
                       <div className="mt-4 pt-4 border-t border-gray-700">
                          <span className="text-xs text-blue-400 font-bold uppercase flex items-center gap-2">
                            <i className="fas fa-lightbulb"></i> Recommendation
                          </span>
                          <p className="text-white text-sm mt-2 italic border-l-2 border-blue-500 pl-3">{analysis.recommendation}</p>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
           <div className="max-w-2xl mx-auto bg-gray-900 rounded-2xl border border-gray-800 p-8">
              <h2 className="text-2xl font-bold mb-6">Emergency Configuration</h2>
              
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 text-gray-300">Registered Contacts</h3>
                {emergencyContacts.length === 0 ? (
                  <p className="text-gray-500 italic">No contacts set up.</p>
                ) : (
                  <ul className="space-y-3">
                    {emergencyContacts.map(contact => (
                      <li key={contact.id} className="flex items-center justify-between bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 font-bold">
                             {contact.name.charAt(0)}
                           </div>
                           <div>
                             <div className="font-bold">{contact.name}</div>
                             <div className="text-sm text-gray-400">{contact.phone}</div>
                           </div>
                        </div>
                        <button 
                          onClick={() => onRemoveContact(contact.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                <h3 className="text-md font-bold mb-4 text-white">Add New Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <input 
                    type="text" 
                    placeholder="Name" 
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button 
                  onClick={handleAddContact}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
                >
                  Add Contact
                </button>
              </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default CompanionDashboard;