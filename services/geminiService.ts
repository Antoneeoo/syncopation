import { GoogleGenAI, Type } from "@google/genai";
import { VitalSigns, HealthAnalysis } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeVitals = async (history: VitalSigns[]): Promise<HealthAnalysis> => {
  if (!process.env.API_KEY) {
    return {
      status: 'NORMAL',
      summary: 'API Key missing. Cannot perform AI analysis.',
      recommendation: 'Please configure the environment.',
      anomaliesDetected: [],
    };
  }

  // Take the last 20 data points to avoid token overflow and focus on recent trends
  const recentHistory = history.slice(-20);
  
  const prompt = `
    Analyze the following time-series health data collected from a wearable device.
    Determine the user's health status, identify any patterns, and detect anomalies.
    
    Data Context:
    - Resting Heart Rate: Normal is 60-100 bpm.
    - SpO2: Below 95% is concerning.
    - Body Temperature: Normal is 36.1C - 37.2C. Above 38C is fever.
    - Blood Pressure: Normal is around 120/80 mmHg. 
      - Hypertension: Systolic > 140 or Diastolic > 90.
      - Hypotension: Systolic < 90 or Diastolic < 60.
    - Stress Level: > 80 is high.
    
    Task:
    1. Analyze trends in Heart Rate, Blood Pressure, and Temperature.
    2. Check for correlation between vitals (e.g., rising temp + high HR = possible infection).
    3. Flag specific anomalies.

    Data: ${JSON.stringify(recentHistory)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, enum: ['NORMAL', 'WARNING', 'CRITICAL'] },
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING },
            anomaliesDetected: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['status', 'summary', 'recommendation', 'anomaliesDetected']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as HealthAnalysis;

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return {
      status: 'WARNING',
      summary: 'Unable to connect to AI Analysis service.',
      recommendation: 'Check network connection.',
      anomaliesDetected: ['AI Service Unavailable']
    };
  }
};