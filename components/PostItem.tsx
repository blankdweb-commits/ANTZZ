import React, { useCallback, useEffect, useState } from 'react';
import { Post } from '../types';
import { ChevronUp, ChevronDown, Clock, Pin, MessageSquare, ShieldCheck, Target } from 'lucide-react';

interface PostItemProps {
  post: Post;
  onVote: (id: string, delta: number) => void;
  onKeep?: (id: string) => void;
  onReply?: (id: string, text: string) => void;
}

const PostItem: React.FC<PostItemProps> = ({ post, onVote, onKeep, onReply }) => {
  const { content, authorCodename, timestamp, votes, status, tags, authorType, expiresAt, isKept, replies, campaignConfig } = post;
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');

  // Countdown Logic
  useEffect(() => {
    if (!expiresAt || isKept) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        // Optional: Could trigger a refresh or removal callback here if strict sync is needed
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isKept]);

  const handleAmplify = useCallback(() => onVote(post.id, 1), [post.id, onVote]);
  const handleSilence = useCallback(() => onVote(post.id, -1), [post.id, onVote]);

  const handleReplySubmit = () => {
    if (onReply && replyText.trim()) {
      onReply(post.id, replyText);
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  const isBusiness = authorType === 'business';
  const isAmplified = status === 'amplified';
  const isSilenced = status === 'silenced';

  // Calculate hours left for business posts for display
  const hoursLeft = isBusiness && timeLeft ? (timeLeft / 3600).toFixed(1) : null;

  return (
    <div 
      className={`
        relative mb-3 p-4 transition-all duration-300 ease-out group rounded border hover:border-opacity-50
        ${isBusiness ? 'border-orange-500/50 bg-orange-900/10 animate-phantom shadow-[0_0_15px_rgba(249,115,22,0.1)]' : ''}
        ${!isBusiness && isAmplified ? 'border-terminal-accent bg-terminal-accentDim/10 hover:shadow-[0_0_10px_rgba(59,130,246,0.1)]' : ''}
        ${!isBusiness && !isAmplified ? 'border-terminal-border bg-terminal-surface hover:border-terminal-accent/50' : ''}
        ${isSilenced ? 'opacity-30 hover:opacity-100 grayscale' : 'opacity-100'}
      `}
    >
      {/* Meta Header */}
      <div className="flex justify-between items-start mb-2 font-mono text-[10px] text-terminal-dim">
        <div className="flex items-center gap-2">
          {isBusiness && <ShieldCheck size={12} className="text-terminal-highlight" />}
          <span className={`uppercase tracking-wider ${isBusiness ? 'text-terminal-highlight font-bold' : isAmplified ? 'text-terminal-accent animate-pulse' : 'text-gray-400'}`}>
            {authorCodename}
          </span>
          <span className="opacity-50">
            {new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Timer Display */}
          {timeLeft !== null && !isBusiness && (
            <span className={`flex items-center gap-1 ${timeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-terminal-dim'}`}>
              <Clock size={10} />
              {timeLeft}s
            </span>
          )}
           {/* Business Timer Display */}
           {isBusiness && timeLeft !== null && (
            <span className="text-terminal-highlight flex items-center gap-1 text-[9px]">
              <Clock size={10} />
              {hoursLeft} HR
            </span>
          )}
          {isKept && <span className="text-terminal-success flex items-center gap-1"><Pin size={10} /> KEPT</span>}
          {isBusiness && <span className="bg-terminal-highlight text-black text-[8px] font-bold px-1 py-0.5 rounded tracking-widest">PROMOTED</span>}
        </div>
      </div>

      {/* Content */}
      <div className={`
        font-sans text-sm leading-relaxed mb-3
        ${isAmplified ? 'text-white font-medium' : 'text-gray-200'}
        ${isSilenced ? 'line-through text-gray-500' : ''}
        ${isBusiness ? 'text-orange-100' : ''}
      `}>
        {content}
      </div>

      {/* Footer / Actions */}
      <div className="flex justify-between items-end pt-2 border-t border-white/5">
        <div className="flex gap-2 flex-wrap items-center">
          {campaignConfig && isBusiness && (
             <span className="flex items-center gap-1 text-[8px] font-mono text-terminal-highlight border border-terminal-highlight/30 px-1 py-0.5 rounded uppercase">
               <Target size={8} />
               {campaignConfig.demographics} • {campaignConfig.interests.slice(0, 2).join(', ')}{campaignConfig.interests.length > 2 ? '...' : ''}
             </span>
          )}
          {tags.map((tag, i) => (
            <span key={i} className="flex items-center text-[9px] font-mono text-terminal-dim border border-terminal-border px-1.5 py-0.5 rounded uppercase hover:text-terminal-accent hover:border-terminal-accent/50 transition-colors cursor-default">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Keep Feature */}
          {onKeep && !isKept && !isBusiness && (
            <button onClick={() => onKeep(post.id)} className="text-terminal-dim hover:text-terminal-success transition-colors flex items-center gap-1 text-[10px]">
              <Pin size={12} /> Keep
            </button>
          )}

          {/* Reply Feature */}
          {onReply && (
            <button onClick={() => setShowReplyInput(!showReplyInput)} className="text-terminal-dim hover:text-white transition-colors flex items-center gap-1 text-[10px]">
              <MessageSquare size={12} /> {replies?.length || 0}
            </button>
          )}

          {/* Voting */}
          <div className="flex items-center gap-1 bg-black/20 rounded px-1.5 py-0.5 border border-transparent hover:border-terminal-border transition-colors">
            <button onClick={handleAmplify} className="text-terminal-dim hover:text-terminal-accent transition-colors p-0.5">
              <ChevronUp size={14} />
            </button>
            <span className={`font-mono text-[10px] font-bold min-w-[12px] text-center ${votes > 0 ? 'text-terminal-accent' : votes < 0 ? 'text-red-500' : 'text-gray-500'}`}>
              {votes}
            </span>
            <button onClick={handleSilence} className="text-terminal-dim hover:text-red-500 transition-colors p-0.5">
              <ChevronDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Reply Section */}
      {showReplyInput && (
        <div className="mt-2 pl-3 border-l border-terminal-border animate-in slide-in-from-left-2 fade-in">
           <div className="flex gap-2">
             <input 
               type="text" 
               value={replyText}
               onChange={(e) => setReplyText(e.target.value)}
               placeholder="Reply..."
               className="flex-1 bg-black/30 border border-terminal-border rounded px-2 py-1 text-xs text-white focus:border-terminal-accent outline-none"
               onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
             />
             <button onClick={handleReplySubmit} className="text-[10px] bg-terminal-accent text-white px-2 py-1 rounded font-bold hover:bg-white hover:text-black transition-colors">
               SEND
             </button>
           </div>
        </div>
      )}

      {/* Threaded Replies */}
      {replies && replies.length > 0 && (
        <div className="mt-3 space-y-2 pl-3 border-l border-terminal-border/30">
          {replies.map(reply => (
             <div key={reply.id} className="bg-white/5 p-2 rounded text-xs">
                <div className="flex justify-between text-[9px] text-terminal-dim mb-1 font-mono uppercase">
                  <span>{reply.authorCodename}</span>
                  <span>{new Date(reply.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <p className="text-gray-300">{reply.content}</p>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostItem;