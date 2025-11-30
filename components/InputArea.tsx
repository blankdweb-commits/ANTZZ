import React, { useState, useRef } from 'react';
import { Send, Loader2, Lock } from 'lucide-react';
import { MAX_CHAR_COUNT } from '../constants';

interface InputAreaProps {
  onSubmit: (text: string) => Promise<void>;
  isProcessing: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSubmit, isProcessing }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!text.trim() || isProcessing) return;
    await onSubmit(text);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const charsLeft = MAX_CHAR_COUNT - text.length;

  return (
    <div className="w-full max-w-2xl mx-auto mb-6 relative z-10">
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-terminal-accent to-blue-900 rounded-none opacity-10 group-hover:opacity-30 transition duration-1000 blur"></div>
        <div className="relative bg-terminal-surface border border-terminal-border p-3 transition-colors hover:border-terminal-accent/50">
          
          <label className="flex items-center gap-2 text-terminal-accent text-[10px] font-mono uppercase tracking-widest mb-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
            <Lock size={10} />
            Encrypted Channel
          </label>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            maxLength={MAX_CHAR_COUNT}
            placeholder="What is weighing on your soul?"
            disabled={isProcessing}
            rows={1}
            className="w-full bg-transparent text-white placeholder-gray-600 font-sans text-base outline-none resize-none overflow-hidden"
          />

          <div className="flex justify-between items-center mt-2 border-t border-terminal-border pt-2">
             <span className={`text-[10px] font-mono ${charsLeft < 20 ? 'text-red-500' : 'text-gray-500'}`}>
               {charsLeft}
             </span>

             <button
                onClick={handleSubmit}
                disabled={!text.trim() || isProcessing}
                className={`
                  flex items-center gap-2 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all rounded
                  ${!text.trim() || isProcessing 
                    ? 'text-gray-600 cursor-not-allowed' 
                    : 'bg-terminal-accent text-white hover:bg-white hover:text-black hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]'}
                `}
             >
               {isProcessing ? (
                 <>
                   <Loader2 size={12} className="animate-spin" />
                   ...
                 </>
               ) : (
                 <>
                   Broadcast
                   <Send size={12} />
                 </>
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputArea;