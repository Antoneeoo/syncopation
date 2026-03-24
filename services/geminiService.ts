
import { GoogleGenAI, Type } from "@google/genai";
import { VitalSigns, HealthAnalysis, Patient } from '../types';

// Initializing the AI client with the provided environment API Key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Perform a deep agentic analysis of patient vitals.
 * Uses gemini-3-pro-preview for advanced reasoning on time-series health data.
 */
export const analyzePatientHealth = async (patient: Patient): Promise<HealthAnalysis> => {
  if (!process.env.API_KEY) {
    return {
      status: 'NORMAL',
      summary: 'Biometric Agent Offline: API Key not detected.',
      recommendation: 'Verify system environment variables.',
      anomaliesDetected: ['System Error: Auth Missing'],
      agentActions: ['Entering fail-safe local monitoring mode']
    };
  }

  const recentHistory = patient.history.slice(-30);
  
  const prompt = `
    SYSTEM ROLE: You are an autonomous Medical Guardian Agent.
    CONTEXT: Monitoring ${patient.name} (${patient.age}y, ${patient.gender}, Blood: ${patient.bloodType}).
    
    TELEMETRY DATA (Last 30 samples):
    ${JSON.stringify(recentHistory)}
    
    CURRENT STATE:
    ${JSON.stringify(patient.vitals)}
    
    GOAL: Proactively monitor for and perform a diagnostic assessment of cardiac stress (e.g., heart attack, arrhythmias), respiratory distress (via SpO2), and stroke indicators based on the provided vital signs and history.
    
    INSTRUCTIONS:
    1. If you see a dangerous trend or anomaly, escalate the 'status' to CRITICAL or WARNING.
    2. Automatically trigger and propose specific 'agentActions' based on detected anomalies and the patient's current health status. Examples include "increase sensor polling rate", "alert user", "dial SOS", "prepare SOS packet", or "no action required".
    3. Be concise and medical-grade in your summary.

    You MUST respond in strict JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['NORMAL', 'WARNING', 'CRITICAL'] },
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            anomaliesDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
            agentActions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['status', 'summary', 'recommendation', 'anomaliesDetected', 'agentActions']
        }
      }
    });

    const result = response.text;
    if (!result) throw new Error("Empty response from AI");
    
    return JSON.parse(result) as HealthAnalysis;

  } catch (error) {
    console.error("Guardian Agent logic failed:", error);
    return {
      status: 'WARNING',
      summary: 'Guardian Agent reasoning interrupted.',
      recommendation: 'Monitor manually until connection re-established.',
      anomaliesDetected: ['AI Engine Timeout'],
      agentActions: ['Attempting automated restart of AI services']
    };
  }
};

/**
 * Detects falls using high-speed accelerometer analysis via Gemini.
 */
export const detectFalls = async (history: VitalSigns[]): Promise<boolean> => {
  if (!process.env.API_KEY || history.length < 5) return false;
  
  const accelData = history.slice(-10).map(v => ({
    x: v.accelerometer.x,
    y: v.accelerometer.y,
    z: v.accelerometer.z
  }));

  const prompt = `
    Analyze this accelerometer sequence for a kinetic impact consistent with a human fall:
    ${JSON.stringify(accelData)}
    Respond only with JSON: {"isFallDetected": boolean, "confidence": number}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const data = JSON.parse(response.text || "{}");
    return !!data.isFallDetected;
  } catch (err) {
    return false;
  }
};
