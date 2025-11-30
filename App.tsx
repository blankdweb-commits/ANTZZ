
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  ShieldCheck, Globe, MapPin, Users, Briefcase, 
  RefreshCw, Plus, Key, ArrowRight, Terminal, DollarSign, Wallet, ChevronLeft, Lock, Target, TrendingUp, Activity, CheckSquare, Square,
  Building, MessageCircle
} from 'lucide-react';

import { Post, UserIdentity, ChannelType, Group } from './types';
import { getOrGenerateIdentity, logoutAndRegenerate, loginAsBusiness, addFunds, deductFunds } from './services/identityService';
import { analyzeTruth } from './services/geminiService';
import { INITIAL_SYSTEM_MESSAGE, SILENCE_THRESHOLD, AMPLIFY_THRESHOLD, TARGETING_INTERESTS, TARGETING_DEMOGRAPHICS } from './constants';

import PostItem from './components/PostItem';
import InputArea from './components/InputArea';

// Helper for Haversine distance
const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
const deg2rad = (deg: number) => deg * (Math.PI / 180);

const EXPIRY_TIME_MS = 100 * 1000; // 100 seconds standard
const RATE_PER_HOUR = 200; // 200 Naira per hour

const App: React.FC = () => {
  // State
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelType>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Group State
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  // Business Login & Logic State
  const [bizName, setBizName] = useState('');
  const [bizDuration, setBizDuration] = useState(1); // Hours
  const [addFundAmount, setAddFundAmount] = useState(1000);
  
  // Advanced Targeting State
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedDemographic, setSelectedDemographic] = useState<string>(TARGETING_DEMOGRAPHICS[0]);

  // --- Initialization ---

  useEffect(() => {
    const user = getOrGenerateIdentity();
    setIdentity(user);

    // Initial System Post
    const systemMsg: Post = {
      id: 'sys-init',
      content: INITIAL_SYSTEM_MESSAGE,
      authorCodename: 'SYSTEM',
      authorType: 'standard',
      timestamp: Date.now(),
      votes: 999,
      status: 'active',
      tags: ['#SECURE'],
      channel: 'global',
    };
    setPosts([systemMsg]);
  }, []);

  // --- Timer Loop for Expiry & Metrics Simulation ---

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPosts(prev => {
        // Filter out expired posts
        const alivePosts = prev.filter(p => {
          if (p.expiresAt && now > p.expiresAt) return false;
          if (p.authorType === 'business') return true; 
          if (p.isKept) return true;
          return true;
        });

        // Simulate Metrics for Active Business Posts
        return alivePosts.map(p => {
          if (p.authorType === 'business' && p.status === 'active' && p.metrics) {
            // Randomly increment views
            const viewInc = Math.floor(Math.random() * 3); // 0-2 views per second
            // Small chance of click if there were views
            const clickInc = viewInc > 0 && Math.random() > 0.9 ? 1 : 0; 
            
            return {
              ...p,
              metrics: {
                ...p.metrics,
                views: p.metrics.views + viewInc,
                clicks: p.metrics.clicks + clickInc
              }
            };
          }
          return p;
        });
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Handlers ---

  const handleLogout = () => {
    const newUser = logoutAndRegenerate();
    setIdentity(newUser);
    setActiveChannel('home');
    setActiveGroupId(null);
    setJoinedGroupIds([]); // Reset joined groups on identity reset
  };

  const handleDisconnect = () => {
    setActiveChannel('home');
    setActiveGroupId(null);
    setShowLocationPrompt(false);
  };

  const handleLocalChannelClick = () => {
    if (userLocation) {
        setActiveChannel('local');
    } else {
        setShowLocationPrompt(true);
    }
  };

  const confirmLocationAccess = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          setShowLocationPrompt(false);
          setActiveChannel('local');
        }, (err) => {
            console.log("Geo access denied", err);
            alert("Location access denied. Cannot join Local Mesh.");
            setShowLocationPrompt(false);
        });
      } else {
          alert("Geolocation not supported.");
          setShowLocationPrompt(false);
      }
  };

  const handleBusinessLogin = () => {
    if (!bizName.trim()) return;
    const bizUser = loginAsBusiness(bizName);
    setIdentity(bizUser);
    setActiveChannel('business'); // Go to dashboard
  };

  const handleAddFunds = () => {
    if (addFundAmount <= 0) return;
    const updatedIdentity = addFunds(addFundAmount);
    if (updatedIdentity) {
      setIdentity(updatedIdentity);
      alert(`₦${addFundAmount} added to wallet.`);
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest) 
        : [...prev, interest]
    );
  };

  const handleCreatePost = async (text: string) => {
    if (!identity) return;
    setIsProcessing(true);

    try {
      const tags = await analyzeTruth(text);

      const newPost: Post = {
        id: uuidv4(),
        content: text,
        authorCodename: identity.codename,
        authorType: identity.type,
        timestamp: Date.now(),
        expiresAt: Date.now() + EXPIRY_TIME_MS, // 100s lifetime for standard
        votes: 0,
        status: 'active',
        tags: tags,
        channel: activeChannel === 'business' ? 'global' : activeChannel, 
        location: userLocation || undefined,
        replies: [],
        groupId: activeChannel === 'group' && activeGroupId ? activeGroupId : undefined
      };

      setPosts(prev => [newPost, ...prev]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePromotePost = async (text: string) => {
    if (!identity || identity.type !== 'business') return;
    
    // Calculate cost
    const cost = bizDuration * RATE_PER_HOUR;
    
    if ((identity.balance || 0) < cost) {
      alert(`Insufficient funds. Campaign requires ₦${cost}. Current Balance: ₦${identity.balance}`);
      return;
    }

    setIsProcessing(true);

    // Deduct Funds
    const updatedIdentity = deductFunds(cost);
    if (updatedIdentity) setIdentity(updatedIdentity);

    // Calculate Expiry
    const durationMs = bizDuration * 60 * 60 * 1000;
    
    const newPost: Post = {
      id: uuidv4(),
      content: text,
      authorCodename: identity.codename,
      authorType: 'business',
      timestamp: Date.now(),
      expiresAt: Date.now() + durationMs, // Expires when subscription elapses
      votes: 0,
      status: 'active',
      tags: ['#PROMOTED'],
      channel: 'global', // Business posts technically live in global but are filtered into views
      campaignConfig: {
        interests: selectedInterests.length > 0 ? selectedInterests : ['General'],
        demographics: selectedDemographic
      },
      metrics: {
        views: 0,
        clicks: 0,
        cost: cost
      }
    };

    setPosts(prev => [newPost, ...prev]);
    setIsProcessing(false);
    alert(`Campaign started! ₦${cost} deducted. Active for ${bizDuration} hour(s).`);
  };

  const handleVote = useCallback((id: string, delta: number) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newVotes = p.votes + delta;
      let status: Post['status'] = 'active';
      if (newVotes <= SILENCE_THRESHOLD) status = 'silenced';
      else if (newVotes >= AMPLIFY_THRESHOLD) status = 'amplified';
      return { ...p, votes: newVotes, status };
    }));
  }, []);

  const handleKeep = useCallback((id: string) => {
    setPosts(prev => prev.map(p => {
      if (p.id === id) return { ...p, isKept: true };
      return p;
    }));
  }, []);

  const handleReply = useCallback((parentId: string, text: string) => {
    if (!identity) return;
    setPosts(prev => prev.map(p => {
      if (p.id !== parentId) return p;
      
      const reply: Post = {
        id: uuidv4(),
        content: text,
        authorCodename: identity.codename,
        authorType: identity.type,
        timestamp: Date.now(),
        expiresAt: Date.now() + EXPIRY_TIME_MS,
        votes: 0,
        status: 'active',
        tags: [],
        channel: p.channel
      };
      
      return {
        ...p,
        replies: [...(p.replies || []), reply]
      };
    }));
  }, [identity]);

  // --- Group Handlers ---

  const handleCreateGroup = () => {
    if (!newGroupName.trim() || !identity) return;
    
    const newGroup: Group = {
      id: uuidv4(),
      name: newGroupName,
      creatorHash: identity.sessionHash,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: Date.now()
    };

    setGroups(prev => [...prev, newGroup]);
    setJoinedGroupIds(prev => [...prev, newGroup.id]);
    setNewGroupName('');
    setShowCreateGroup(false);
    setActiveGroupId(newGroup.id); // Auto-enter
  };

  const handleJoinGroup = () => {
    const group = groups.find(g => g.inviteCode === joinCode.trim().toUpperCase());
    if (group) {
      if (!joinedGroupIds.includes(group.id)) {
        setJoinedGroupIds(prev => [...prev, group.id]);
      }
      setActiveGroupId(group.id);
      setJoinCode('');
    } else {
      alert("Invalid Access Code");
    }
  };

  // --- Filter Logic ---
  
  const visiblePosts = posts.filter(post => {
    // 1. Business Logic
    if (post.authorType === 'business') {
        const pDem = post.campaignConfig?.demographics;
        // Simple simulation: Business posts appear everywhere if targeting is general or matches simulation
        // Real logic would filter based on viewing user's data (which we don't really have)
        return true; 
    }

    // 2. Channel Filtering (Standard Posts)
    if (activeChannel === 'global') return post.channel === 'global';
    
    if (activeChannel === 'local') {
      if (post.channel !== 'local') return false;
      if (!userLocation || !post.location) return false; 
      const dist = getDistanceFromLatLonInKm(
        userLocation.lat, userLocation.lng,
        post.location.lat, post.location.lng
      );
      return dist <= 32; // 20 miles approx
    }

    if (activeChannel === 'group') {
      if (!activeGroupId) return false; // Must be in a specific group
      return post.channel === 'group' && post.groupId === activeGroupId;
    }

    return false;
  });

  const activeGroupData = activeChannel === 'group' && activeGroupId 
    ? groups.find(g => g.id === activeGroupId) 
    : null;

  // --- Common Header for Feeds ---
  const FeedHeader = () => (
    <div className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-terminal-border px-4 py-3 flex justify-between items-center">
       {/* Left: Navigation & Context */}
       <div className="flex items-center gap-4">
         <button 
           onClick={handleDisconnect}
           className="text-terminal-dim hover:text-white transition-colors group"
           title="Disconnect from Channel"
         >
           <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
         </button>
         
         <div className="flex items-center gap-2">
           {activeChannel === 'local' && <MapPin size={14} className="text-terminal-accent" />}
           {activeChannel === 'global' && <Globe size={14} className="text-terminal-accent" />}
           {activeChannel === 'group' && <Users size={14} className="text-terminal-accent" />}
           {activeChannel === 'business' && <Briefcase size={14} className="text-terminal-highlight" />}
           <span className="font-bold font-mono text-xs uppercase tracking-tight text-white hidden sm:inline-block">
             {activeChannel === 'group' && activeGroupData ? activeGroupData.name : `${activeChannel}`}
           </span>
         </div>
       </div>

       {/* Right: Identity Menu (Only visible here) */}
       <div className="flex items-center gap-3 pl-4 border-l border-terminal-border/30">
          <div className="flex flex-col items-end leading-none">
             <span className="text-[8px] text-gray-500 font-mono uppercase tracking-wider">ID_MASK</span>
             <span className="text-[10px] font-mono text-terminal-accent font-bold tracking-wider">{identity?.sessionHash.substring(0,8)}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="text-terminal-dim hover:text-red-500 transition-colors p-1"
            title="Regenerate Identity & Disconnect"
          >
            <RefreshCw size={14} />
          </button>
       </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#e5e5e5] font-sans overflow-hidden">
      
      {/* MAIN CONTENT AREA - FULL WIDTH */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* --- LANDING PAGE (SELECTION SCREEN) --- */}
        {activeChannel === 'home' && (
           <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative overflow-hidden bg-[#050505]">
             
             {/* Background decoration */}
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-terminal-accent to-transparent opacity-50"></div>
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>

             {/* Location Privacy Prompt Modal */}
             {showLocationPrompt && (
                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
                     <div className="bg-terminal-surface border border-terminal-accent/50 p-6 max-w-sm w-full mx-4 rounded shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                         <div className="text-center mb-4">
                             <MapPin size={32} className="mx-auto text-terminal-accent mb-2" />
                             <h3 className="font-mono text-lg font-bold text-white">LOCATION_REQ</h3>
                         </div>
                         <p className="font-mono text-xs text-gray-400 text-center mb-6 leading-relaxed">
                             LOCAL_NET requires geolocation to identify nearby nodes. Your coordinates are processed ephemerally and hashed. <br/><br/>
                             <span className="text-white">ANONYMITY PRESERVED. NO HISTORY STORED.</span>
                         </p>
                         <div className="flex gap-3">
                             <button 
                               onClick={() => setShowLocationPrompt(false)}
                               className="flex-1 py-2 text-xs font-mono uppercase text-gray-500 hover:text-white transition-colors"
                             >
                               Abort
                             </button>
                             <button 
                               onClick={confirmLocationAccess}
                               className="flex-1 bg-terminal-accent text-white py-2 font-mono uppercase text-xs font-bold rounded hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
                             >
                               Connect
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             <div className="max-w-4xl w-full z-10 flex flex-col items-center">
               
               {/* LOGO SECTION */}
               <div className="mb-12 relative text-center">
                  <div className="relative w-32 h-32 mx-auto mb-4 flex items-center justify-center">
                      {/* Glow */}
                      <div className="absolute inset-0 bg-terminal-accent/20 rounded-full blur-3xl"></div>
                      
                      {/* Main Building */}
                      <Building size={80} className="text-terminal-accent relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" strokeWidth={1} />
                      
                      {/* Talking Elements */}
                      <div className="absolute top-0 right-0 animate-[bounce_3s_infinite]">
                          <MessageCircle size={32} className="text-terminal-highlight fill-terminal-highlight/10 drop-shadow-[0_0_10px_rgba(249,115,22,0.5)]" strokeWidth={2} />
                      </div>
                      <div className="absolute bottom-4 -left-4 animate-[pulse_4s_infinite]">
                          <Users size={32} className="text-white fill-white/5" strokeWidth={1.5} />
                      </div>
                       <div className="absolute top-8 -left-2 animate-[bounce_4s_infinite_0.5s]">
                          <MessageCircle size={20} className="text-blue-300 fill-blue-300/10" />
                      </div>
                  </div>

                  <h1 className="text-6xl md:text-7xl font-black font-mono tracking-tighter mb-2 text-white flex items-center justify-center gap-2 drop-shadow-2xl">
                    TOWNHALL<span className="text-terminal-highlight animate-pulse">_</span>
                  </h1>
                  
                  {/* Anonymity Indicator - Replaces Description */}
                  <div className="font-mono text-terminal-dim text-[10px] tracking-[0.2em] uppercase mt-2 flex items-center justify-center gap-2 border border-terminal-border/50 px-3 py-1 rounded-full bg-black/50">
                     <div className="w-1.5 h-1.5 bg-terminal-success rounded-full animate-pulse"></div>
                     ENCRYPTED_CONNECTION // ANONYMOUS
                  </div>
               </div>

               {/* BUTTONS SECTION */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl px-4">
                 
                 {/* LOCAL */}
                 <button 
                    onClick={handleLocalChannelClick}
                    className="group relative h-32 bg-terminal-surface border-l-4 border-l-terminal-accent border-y border-r border-terminal-border hover:border-r-terminal-accent hover:bg-terminal-surface/80 transition-all duration-300 flex items-center px-6 overflow-hidden hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]"
                 >
                   <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-terminal-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="bg-terminal-accent/10 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform duration-300">
                     <MapPin size={32} className="text-terminal-accent" />
                   </div>
                   <div className="text-left flex-1 relative z-10">
                     <h2 className="font-mono font-black text-2xl text-white italic">LOCAL_MESH</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-wider mt-1">Join your vicinity (20mi)</p>
                   </div>
                   <ArrowRight className="text-terminal-accent opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                 </button>

                 {/* GROUP */}
                 <button 
                    onClick={() => setActiveChannel('group')}
                    className="group relative h-32 bg-terminal-surface border-l-4 border-l-purple-500 border-y border-r border-terminal-border hover:border-r-purple-500 hover:bg-terminal-surface/80 transition-all duration-300 flex items-center px-6 overflow-hidden hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]"
                 >
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="bg-purple-500/10 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform duration-300">
                     <Users size={32} className="text-purple-500" />
                   </div>
                   <div className="text-left flex-1 relative z-10">
                     <h2 className="font-mono font-black text-2xl text-white italic">PRIVATE_NODE</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-wider mt-1">Encrypted Group Chat</p>
                   </div>
                   <ArrowRight className="text-purple-500 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                 </button>

                 {/* GLOBAL */}
                 <button 
                    onClick={() => setActiveChannel('global')}
                    className="group relative h-32 bg-terminal-surface border-l-4 border-l-green-500 border-y border-r border-terminal-border hover:border-r-green-500 hover:bg-terminal-surface/80 transition-all duration-300 flex items-center px-6 overflow-hidden hover:shadow-[0_0_30px_rgba(34,197,94,0.15)] md:col-span-2 lg:col-span-1"
                 >
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="bg-green-500/10 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform duration-300">
                     <Globe size={32} className="text-green-500" />
                   </div>
                   <div className="text-left flex-1 relative z-10">
                     <h2 className="font-mono font-black text-2xl text-white italic">GLOBAL_FEED</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-wider mt-1">World Wide Broadcast</p>
                   </div>
                   <ArrowRight className="text-green-500 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                 </button>

                 {/* BUSINESS */}
                 <button 
                    onClick={() => setActiveChannel('business')}
                    className="group relative h-32 bg-terminal-surface border-l-4 border-l-terminal-highlight border-y border-r border-terminal-border hover:border-r-terminal-highlight hover:bg-terminal-surface/80 transition-all duration-300 flex items-center px-6 overflow-hidden hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] md:col-span-2 lg:col-span-1"
                 >
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-terminal-highlight/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                   <div className="bg-terminal-highlight/10 p-4 rounded-full mr-5 group-hover:scale-110 transition-transform duration-300">
                     <Briefcase size={32} className="text-terminal-highlight" />
                   </div>
                   <div className="text-left flex-1 relative z-10">
                     <h2 className="font-mono font-black text-2xl text-white italic">BUSINESS</h2>
                     <p className="font-mono text-xs text-gray-500 uppercase tracking-wider mt-1">Targeted Promotion</p>
                   </div>
                   <ArrowRight className="text-terminal-highlight opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-300" />
                 </button>
               </div>
               
               {/* REMOVED BOTTOM IDENTITY MENU TO SATISFY "Remove menu if no account is selected" */}
             </div>
           </div>
        )}

        {/* --- GROUP SELECTION VIEW --- */}
        {activeChannel === 'group' && !activeGroupId && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
             <FeedHeader />
             <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4">
               <div className="max-w-xl mx-auto">
                 <div className="flex justify-between items-center mb-6">
                   <h2 className="text-sm font-bold flex items-center gap-2 font-mono tracking-tight text-white/50">
                     SELECT_NODE
                   </h2>
                   <button 
                     onClick={() => setShowCreateGroup(!showCreateGroup)}
                     className="bg-terminal-surface hover:bg-terminal-border text-white border border-terminal-border px-3 py-1.5 rounded flex items-center gap-2 text-[10px] font-mono transition-colors"
                   >
                     <Plus size={12} /> CREATE_NODE
                   </button>
                 </div>

                 {/* Create Group Form */}
                 {showCreateGroup && (
                   <div className="mb-6 p-4 bg-terminal-surface border border-terminal-accent rounded-lg animate-in fade-in slide-in-from-top-4 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                     <h3 className="font-bold font-mono text-[10px] mb-3 uppercase text-terminal-accent">Init New Channel</h3>
                     <div className="flex gap-2">
                       <input 
                         className="flex-1 bg-black border border-terminal-border p-2 rounded text-white focus:outline-none focus:border-white font-mono text-sm"
                         placeholder="CHANNEL_NAME"
                         value={newGroupName}
                         onChange={e => setNewGroupName(e.target.value)}
                       />
                       <button 
                         onClick={handleCreateGroup}
                         className="bg-terminal-accent text-white font-bold px-4 rounded hover:bg-white hover:text-black transition-colors font-mono text-xs"
                       >
                         INIT
                       </button>
                     </div>
                   </div>
                 )}

                 {/* Join Group Form */}
                 <div className="mb-6 p-4 bg-terminal-surface border border-terminal-border rounded-lg group hover:border-terminal-accent/30 transition-colors">
                   <label className="block text-[10px] font-mono text-gray-500 mb-2 uppercase">Input Access Key</label>
                   <div className="flex gap-2">
                     <div className="relative flex-1">
                       <Key className="absolute left-3 top-2.5 text-gray-500" size={14} />
                       <input 
                         className="w-full bg-black border border-terminal-border pl-9 p-2 rounded text-white focus:outline-none focus:border-white font-mono uppercase text-sm"
                         placeholder="XXXXXX"
                         value={joinCode}
                         onChange={e => setJoinCode(e.target.value)}
                       />
                     </div>
                     <button 
                       onClick={handleJoinGroup}
                       className="bg-white/5 border border-terminal-border text-white font-bold px-4 rounded hover:bg-white/10 transition-colors font-mono text-xs"
                     >
                       CONNECT
                     </button>
                   </div>
                 </div>

                 {/* Group List */}
                 <div className="space-y-2">
                   <h3 className="text-[10px] font-mono text-gray-500 uppercase mb-2">Available Nodes</h3>
                   {joinedGroupIds.length === 0 ? (
                     <p className="text-gray-600 italic text-xs font-mono border border-dashed border-gray-800 p-4 text-center rounded">NO CHANNELS CONNECTED</p>
                   ) : (
                     groups.filter(g => joinedGroupIds.includes(g.id)).map(group => (
                       <div 
                         key={group.id}
                         onClick={() => setActiveGroupId(group.id)}
                         className="p-3 bg-terminal-surface border border-terminal-border rounded hover:border-terminal-accent cursor-pointer flex justify-between items-center group transition-all hover:translate-x-1"
                       >
                         <div>
                           <h4 className="font-bold text-white group-hover:text-terminal-accent transition-colors font-mono text-sm">{group.name}</h4>
                           <span className="text-[10px] text-gray-500 font-mono">ID: {group.id.substring(0,8)}...</span>
                         </div>
                         <ArrowRight className="text-gray-600 group-hover:text-terminal-accent transition-colors" size={16} />
                       </div>
                     ))
                   )}
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* --- BUSINESS DASHBOARD --- */}
        {activeChannel === 'business' && (
           <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
              <FeedHeader />
              <div className="flex-1 overflow-y-auto p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 font-mono uppercase">
                    <Briefcase className="text-terminal-highlight" size={20} />
                    Business Portal
                  </h2>

                  {identity?.type !== 'business' ? (
                    <div className="bg-terminal-surface border border-terminal-border p-5 rounded-lg shadow-lg">
                      <h3 className="text-lg mb-3 font-mono text-terminal-highlight">INIT_BUSINESS_PROTOCOL</h3>
                      <p className="text-gray-500 mb-5 text-xs font-mono leading-relaxed">
                        WARNING: Professional accounts are permanent. <br/>
                        Wallet required for signal boost.
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-mono uppercase text-gray-400 mb-1">Organization Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-black border border-terminal-border p-2.5 rounded text-white focus:border-terminal-highlight outline-none font-mono text-sm"
                            placeholder="ENTER_NAME"
                            value={bizName}
                            onChange={e => setBizName(e.target.value)}
                          />
                        </div>
                        <button 
                          onClick={handleBusinessLogin}
                          className="w-full bg-orange-700 hover:bg-orange-600 text-black font-bold py-2.5 rounded transition-colors font-mono uppercase text-xs"
                        >
                          Initialize Account
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* LEFT COLUMN - Wallet & Campaigns */}
                        <div className="md:col-span-1 space-y-6">
                           {/* Wallet Section */}
                           <div className="bg-terminal-surface border border-terminal-border p-5 rounded-lg relative overflow-hidden group hover:border-terminal-highlight/30 transition-colors">
                              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                  <Wallet size={80} />
                              </div>
                              <div className="flex justify-between items-center mb-4">
                                <div>
                                  <h3 className="text-lg font-bold text-white">{identity.codename}</h3>
                                  <span className="text-[10px] font-mono text-green-500">VERIFIED_BUSINESS</span>
                                </div>
                              </div>
                              <div className="text-left mb-4">
                                  <div className="text-3xl font-mono text-terminal-highlight font-bold">₦{(identity.balance || 0).toLocaleString()}</div>
                                  <div className="text-[9px] text-gray-500 uppercase tracking-wider">Available Credits</div>
                              </div>
                              
                              <div className="bg-black/40 p-3 rounded flex items-center gap-3">
                                  <DollarSign className="text-gray-500" size={16} />
                                  <input 
                                    type="number"
                                    value={addFundAmount}
                                    onChange={(e) => setAddFundAmount(Number(e.target.value))}
                                    className="bg-transparent border-none focus:outline-none text-white font-mono flex-1 text-sm"
                                    placeholder="AMOUNT"
                                  />
                                  <button 
                                    onClick={handleAddFunds}
                                    className="bg-terminal-border hover:bg-terminal-highlight hover:text-black px-3 py-1.5 rounded text-[10px] font-bold transition-colors font-mono"
                                  >
                                    ADD_FUNDS
                                  </button>
                              </div>
                           </div>
                           
                           {/* Campaign Form */}
                           <div className="bg-terminal-surface border border-terminal-border p-5 rounded-lg">
                              <h4 className="font-mono text-xs uppercase text-gray-400 mb-4 border-b border-white/10 pb-2">New Promotion</h4>
                              
                              {/* Duration */}
                              <div className="mb-4">
                                <label className="block text-[9px] uppercase text-gray-500 mb-1 font-mono">Duration (Hours)</label>
                                <input 
                                  type="number" 
                                  min="1"
                                  max="24"
                                  className="w-full bg-black border border-terminal-border p-2 rounded text-white focus:border-terminal-highlight outline-none font-mono text-sm"
                                  value={bizDuration}
                                  onChange={e => setBizDuration(Math.max(1, Number(e.target.value)))}
                                />
                                <div className="mt-1 text-[9px] text-terminal-highlight/70 font-mono">RATE: ₦{RATE_PER_HOUR}/HR</div>
                              </div>

                              {/* Demographics */}
                              <div className="mb-4">
                                <label className="block text-[9px] uppercase text-gray-500 mb-1 font-mono">Demographics</label>
                                <div className="grid grid-cols-1 gap-1">
                                  <select 
                                    className="w-full bg-black border border-terminal-border p-2 rounded text-white text-xs font-mono outline-none"
                                    value={selectedDemographic}
                                    onChange={(e) => setSelectedDemographic(e.target.value)}
                                  >
                                    {TARGETING_DEMOGRAPHICS.map(demo => (
                                      <option key={demo} value={demo}>{demo}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Interests */}
                              <div className="mb-4">
                                <label className="block text-[9px] uppercase text-gray-500 mb-2 font-mono">Interests (Select Multiple)</label>
                                <div className="flex flex-wrap gap-2">
                                  {TARGETING_INTERESTS.map(interest => {
                                    const isSelected = selectedInterests.includes(interest);
                                    return (
                                      <button 
                                        key={interest}
                                        onClick={() => toggleInterest(interest)}
                                        className={`
                                          text-[10px] font-mono border px-2 py-1 rounded transition-colors flex items-center gap-1
                                          ${isSelected 
                                            ? 'bg-terminal-highlight text-black border-terminal-highlight' 
                                            : 'bg-transparent text-gray-500 border-terminal-border hover:border-terminal-highlight/50'}
                                        `}
                                      >
                                        {isSelected ? <CheckSquare size={10} /> : <Square size={10} />}
                                        {interest}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex justify-between items-center mb-4 text-xs font-mono border-t border-terminal-border pt-3">
                                <span>ESTIMATED COST:</span>
                                <span className="text-terminal-highlight font-bold">₦{(bizDuration * RATE_PER_HOUR).toLocaleString()}</span>
                              </div>

                              <InputArea 
                                onSubmit={handlePromotePost} 
                                isProcessing={isProcessing} 
                              />
                           </div>
                        </div>

                        {/* RIGHT COLUMN - Analytics Table */}
                        <div className="md:col-span-2">
                           <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden h-full">
                              <div className="p-4 border-b border-terminal-border bg-black/20 flex justify-between items-center">
                                 <h4 className="font-mono text-xs uppercase text-white flex items-center gap-2">
                                   <TrendingUp size={14} className="text-terminal-highlight" />
                                   Live Campaign Analytics
                                 </h4>
                                 <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                   REALTIME
                                 </div>
                              </div>
                              
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-terminal-border text-[9px] font-mono text-gray-500 uppercase">
                                      <th className="p-3">Campaign Content</th>
                                      <th className="p-3">Targeting</th>
                                      <th className="p-3">Status</th>
                                      <th className="p-3 text-right">Views</th>
                                      <th className="p-3 text-right">Clicks</th>
                                      <th className="p-3 text-right">Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-terminal-border/30">
                                    {posts
                                      .filter(p => p.authorCodename === identity.codename && p.authorType === 'business')
                                      .length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="p-8 text-center text-xs font-mono text-gray-600 italic">
                                            NO ACTIVE CAMPAIGNS
                                          </td>
                                        </tr>
                                      ) : (
                                        posts
                                          .filter(p => p.authorCodename === identity.codename && p.authorType === 'business')
                                          .map(p => {
                                            const isActive = p.expiresAt && p.expiresAt > Date.now();
                                            return (
                                              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 text-xs font-sans text-white max-w-[200px] truncate">
                                                  {p.content}
                                                </td>
                                                <td className="p-3 text-[10px] font-mono text-gray-400">
                                                  {p.campaignConfig ? (
                                                    <div className="flex flex-col">
                                                      <span>{p.campaignConfig.demographics}</span>
                                                      <span className="opacity-50">{p.campaignConfig.interests.slice(0,2).join(', ')}{p.campaignConfig.interests.length>2 && '...'}</span>
                                                    </div>
                                                  ) : '-'}
                                                </td>
                                                <td className="p-3">
                                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${isActive ? 'text-green-500 border-green-900 bg-green-900/20' : 'text-red-500 border-red-900 bg-red-900/10'}`}>
                                                    {isActive ? 'ACTIVE' : 'EXPIRED'}
                                                  </span>
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-white">
                                                  {p.metrics?.views.toLocaleString() || 0}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-terminal-highlight">
                                                  {p.metrics?.clicks.toLocaleString() || 0}
                                                </td>
                                                <td className="p-3 text-right font-mono text-xs text-gray-400">
                                                  ₦{p.metrics?.cost.toLocaleString() || 0}
                                                </td>
                                              </tr>
                                            )
                                          })
                                      )}
                                  </tbody>
                                </table>
                              </div>
                           </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
           </div>
        )}

        {/* --- STANDARD / GROUP FEED --- */}
        {(activeChannel === 'local' || activeChannel === 'global' || (activeChannel === 'group' && activeGroupId)) && (
          <div className="flex-1 flex flex-col overflow-hidden">
             <FeedHeader />
             
             {/* Sub-header info for specific channels */}
             <div className="px-4 py-2 border-b border-terminal-border/30 bg-[#0a0a0a]/50">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                   <div className="flex items-center gap-2 text-terminal-dim">
                       {activeChannel === 'local' && !userLocation && (
                        <span className="text-red-500 text-[10px] font-mono animate-pulse">LOCATING_SIGNAL...</span>
                       )}
                       {activeChannel === 'group' && activeGroupData && (
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            {identity?.sessionHash === activeGroupData.creatorHash && (
                              <span className="text-terminal-accent border border-terminal-accent/30 px-1 rounded">
                                ACCESS KEY: {activeGroupData.inviteCode}
                              </span>
                            )}
                          </div>
                       )}
                   </div>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-3 md:p-6 relative animate-in fade-in duration-500">
               <div className="max-w-3xl mx-auto pb-24">
                 {visiblePosts.length === 0 ? (
                    <div className="text-center py-16 opacity-30 font-mono border-2 border-dashed border-terminal-border rounded-lg">
                       <p className="text-sm">NO SIGNAL DETECTED.</p>
                       <p className="text-[10px] mt-1">BROADCAST_TRUTH_NOW.</p>
                    </div>
                 ) : (
                   visiblePosts.map(post => (
                     <PostItem 
                        key={post.id} 
                        post={post} 
                        onVote={handleVote} 
                        onKeep={activeChannel === 'group' ? handleKeep : undefined}
                        onReply={activeChannel === 'group' ? handleReply : undefined}
                      />
                   ))
                 )}
               </div>
            </div>

            {/* Input Area */}
            <div className="bg-[#0a0a0a]/90 backdrop-blur border-t border-terminal-border p-3">
               <div className="max-w-3xl mx-auto">
                 <InputArea 
                   onSubmit={handleCreatePost} 
                   isProcessing={isProcessing} 
                 />
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
