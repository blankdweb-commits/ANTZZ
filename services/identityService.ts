import { UserIdentity } from '../types';
import { ADJECTIVES, NOUNS } from '../constants';

const IDENTITY_KEY = 'townhall_identity_v2';

export const getOrGenerateIdentity = (): UserIdentity => {
  const stored = localStorage.getItem(IDENTITY_KEY);
  
  if (stored) {
    const identity: UserIdentity = JSON.parse(stored);
    return identity;
  }

  const newIdentity = generateIdentity();
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
};

export const logoutAndRegenerate = (): UserIdentity => {
  localStorage.removeItem(IDENTITY_KEY);
  return getOrGenerateIdentity();
};

export const loginAsBusiness = (businessName: string): UserIdentity => {
  const businessIdentity: UserIdentity = {
    codename: businessName,
    sessionHash: 'BIZ_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    createdAt: Date.now(),
    type: 'business',
    balance: 0
  };
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(businessIdentity));
  return businessIdentity;
};

export const addFunds = (amount: number): UserIdentity | null => {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (stored) {
    const identity: UserIdentity = JSON.parse(stored);
    if (identity.type === 'business') {
      identity.balance = (identity.balance || 0) + amount;
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      return identity;
    }
  }
  return null;
};

export const deductFunds = (amount: number): UserIdentity | null => {
  const stored = localStorage.getItem(IDENTITY_KEY);
  if (stored) {
    const identity: UserIdentity = JSON.parse(stored);
    if (identity.type === 'business' && (identity.balance || 0) >= amount) {
      identity.balance = (identity.balance || 0) - amount;
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      return identity;
    }
  }
  return null;
}

const generateIdentity = (): UserIdentity => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const codename = `${adj} ${noun}`;
  
  // Simulated hash for visual privacy effect
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  const sessionHash = Array.from(array).map(n => n.toString(16)).join('').substring(0, 12).toUpperCase();

  return {
    codename,
    sessionHash,
    createdAt: Date.now(),
    type: 'standard'
  };
};