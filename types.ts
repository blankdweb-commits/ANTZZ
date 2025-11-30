
export type ChannelType = 'home' | 'local' | 'group' | 'global' | 'business';

export interface Group {
  id: string;
  name: string;
  creatorHash: string;
  inviteCode: string; // Only visible to creator
  createdAt: number;
}

export interface CampaignMetrics {
  views: number;
  clicks: number;
  cost: number;
}

export interface CampaignConfig {
  interests: string[];
  demographics: string;
}

export interface Post {
  id: string;
  content: string;
  authorCodename: string;
  authorType: 'standard' | 'business';
  timestamp: number;
  expiresAt?: number; // For the 100s rule
  votes: number;
  status: 'active' | 'amplified' | 'silenced';
  tags: string[];
  channel: ChannelType;
  location?: { lat: number; lng: number }; // For local posts
  replies?: Post[]; // For group chat threading
  isKept?: boolean; // For the "Keep" feature
  targetAudience?: string; // Legacy string, kept for compatibility
  groupId?: string; // For private groups
  
  // New Business Features
  campaignConfig?: CampaignConfig;
  metrics?: CampaignMetrics;
}

export interface UserIdentity {
  codename: string;
  sessionHash: string;
  createdAt: number;
  type: 'standard' | 'business';
  balance?: number; // For business simulation
}

export enum AnalysisType {
  TAGS = 'TAGS',
  SENTIMENT = 'SENTIMENT'
}