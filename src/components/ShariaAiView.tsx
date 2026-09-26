import React, { useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';

interface ShariaAiViewProps {
  aiMessages: Array<{ sender: 'user' | 'bot'; text: string }>;
  onSendMessage: (text: string) => void;
  aiLoading: boolean;
}

export const ShariaAiView: React.FC<ShariaAiViewProps> = ({
  aiMessages,
  onSendMessage,
  aiLoading
}) => {
  const [input, setInput] = useState<string>('');

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="space-y-3.5 max-w-xl mx-auto p-4 flex-1 flex flex-col">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-teal-800 flex items-center justify-center gap-1.5">
          <Sparkles className="w-5 h-5 text-teal-600" />
          فەتوای شەرعیی زیرەک (٤ مەزهەبەکە)
        </h2>
        <p className="text-xs text-slate-500">وەڵامدانەوە بەپێی قورئان و سوننەت + ناردن بۆ مامۆستایان</p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-4 space-y-3 min-h-[350px] max-h-[500px] overflow-y-auto shadow-xs">
        {aiMessages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[88%] whitespace-pre-line ${
              msg.sender === 'user' 
                ? 'bg-amber-600 text-white mr-auto rounded-tl-none' 
                : 'bg-slate-50 text-slate-800 ml-auto border border-slate-200 rounded-tr-none'
            }`}
          >
            {msg.text}
          </div>
        ))}
        {aiLoading && (
          <div className="p-3 bg-slate-50 text-teal-800 rounded-xl text-xs flex items-center gap-2 border border-slate-200">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>یاریدەدەر خەریکی پشکنینی بەڵگە شەرعییەکانە...</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="پرسیارە شەرعییەکەت لێرە بنووسە..."
          className="flex-1 bg-white text-slate-800 text-xs p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:border-teal-500 shadow-xs"
        />
        <button
          onClick={handleSend}
          className="p-3.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md"
        >
          <Send className="w-4 h-4 transform rotate-180" />
        </button>
      </div>
    </div>
  );
};
