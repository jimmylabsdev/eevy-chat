import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase project used ONLY for phone/OTP verification on the "Save"
 * action (2026-07-19) — nothing else in eevy runs through Firebase; all
 * actual data (assessment_v3, user_journey_events, leads) stays on
 * Supabase via the existing Cloudflare Workers. This config is a public
 * client identifier (not a secret) — safe to commit.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCHwWDxilkjObkCPev84nL1wA93ahap7Lo',
  authDomain: 'eevy-assessments.firebaseapp.com',
  projectId: 'eevy-assessments',
  storageBucket: 'eevy-assessments.firebasestorage.app',
  messagingSenderId: '625926193503',
  appId: '1:625926193503:web:9ef472d4bf3a0b49d9b6ea',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
