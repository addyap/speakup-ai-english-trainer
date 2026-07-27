import React, { useState } from "react";
import { Check, ChevronLeft, Sparkles } from "lucide-react";

export default function BoldPremium() {
  const [mode, setMode] = useState(0);
  const [scenario, setScenario] = useState(0);
  const [level, setLevel] = useState(0);

  const modes = [
    {
      icon: "🌱",
      title: "Friendly Coach",
      desc: "Gentle guidance, natural conversation",
      color: "border-emerald-500",
      bg: "bg-emerald-500/10",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    },
    {
      icon: "🔥",
      title: "Demanding Coach",
      desc: "Push your limits",
      color: "border-orange-500",
      bg: "bg-orange-500/10",
      glow: "shadow-[0_0_15px_rgba(249,115,22,0.3)]",
    },
    {
      icon: "🎓",
      title: "Strict Examiner",
      desc: "Exam-grade precision",
      color: "border-violet-500",
      bg: "bg-violet-500/10",
      glow: "shadow-[0_0_15px_rgba(124,58,237,0.3)]",
    },
  ];

  const scenarios = [
    { emoji: "💼", name: "Job Interview" },
    { emoji: "💻", name: "Tech Talk" },
    { emoji: "📊", name: "Presentation" },
    { emoji: "🤝", name: "Networking" },
    { emoji: "☕", name: "Coffee Chat" },
    { emoji: "💬", name: "Small Talk" },
    { emoji: "✈️", name: "Airport" },
    { emoji: "🏨", name: "Hotel Check-in" },
    { emoji: "🍽️", name: "Restaurant" },
    { emoji: "🛍️", name: "Shopping" },
    { emoji: "🏥", name: "Doctor" },
    { emoji: "📞", name: "Phone Call" },
    { emoji: "🏦", name: "Banking" },
    { emoji: "🏙️", name: "City Tour" },
    { emoji: "🎬", name: "Movies" },
    { emoji: "📰", name: "News Debate" },
    { emoji: "🚨", name: "Emergency" },
    { emoji: "👨‍🍳", name: "Cooking" },
    { emoji: "⚖️", name: "Legal" },
    { emoji: "🏋️", name: "Gym" },
    { emoji: "🏠", name: "Real Estate" },
    { emoji: "🏡", name: "Neighbors" },
  ];

  const levels = ["⚡ Auto", "A1-A2", "B1-B2", "C1-C2"];

  return (
    <div className="flex justify-center bg-black min-h-screen py-8 overflow-hidden font-sans">
      <div className="w-[390px] h-[844px] bg-[#08080f] rounded-[40px] overflow-hidden shadow-2xl relative flex flex-col border border-white/10">
        
        {/* Header */}
        <div className="px-6 pt-12 pb-4 flex items-center justify-between sticky top-0 bg-[#08080f]/90 backdrop-blur-md z-10 border-b border-zinc-800">
          <button className="w-10 h-10 rounded-full bg-[#12121e] flex items-center justify-center border border-zinc-800 text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="text-violet-500" size={18} />
            <h1 className="text-white font-bold text-lg tracking-tight">SpeakUp AI</h1>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-32" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          
          <div className="mt-6 mb-8">
            <h2 className="text-3xl font-black text-white leading-tight mb-2">New Session</h2>
            <p className="text-zinc-400 font-medium">Configure your AI speaking partner.</p>
          </div>

          {/* Mode Selection */}
          <div className="mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 mb-4">Select Mode</h3>
            <div className="flex flex-col gap-3">
              {modes.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setMode(i)}
                  className={`relative overflow-hidden w-full text-left rounded-2xl transition-all duration-300 ${
                    mode === i 
                      ? `${m.bg} ${m.glow} border-l-[4px] ${m.color}` 
                      : "bg-[#12121e] border-l-[4px] border-zinc-800 hover:bg-[#1a1a2e]"
                  } flex items-center p-4`}
                >
                  <div className="text-2xl mr-4">{m.icon}</div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-base mb-0.5">{m.title}</div>
                    <div className="text-zinc-400 text-xs font-medium">{m.desc}</div>
                  </div>
                  {mode === i && (
                    <div className={`w-6 h-6 rounded-full bg-black/40 flex items-center justify-center`}>
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-zinc-800 my-8"></div>

          {/* Scenario Picker */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">Scenario</h3>
              <button className="text-xs font-bold text-violet-400 hover:text-violet-300">SEE ALL</button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {scenarios.slice(0, 9).map((s, i) => (
                <button
                  key={i}
                  onClick={() => setScenario(i)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all border ${
                    scenario === i
                      ? "bg-violet-600 border-violet-500 shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                      : "bg-[#12121e] border-violet-900/40 hover:border-violet-700/50"
                  }`}
                >
                  <span className="text-3xl mb-2">{s.emoji}</span>
                  <span className={`text-[10px] font-bold text-center leading-tight ${scenario === i ? "text-white" : "text-zinc-300"}`}>
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-zinc-800 my-8"></div>

          {/* Level Chips */}
          <div className="mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400 mb-4">Proficiency Level</h3>
            <div className="flex flex-wrap gap-2">
              {levels.map((l, i) => (
                <button
                  key={i}
                  onClick={() => setLevel(i)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                    level === i
                      ? "bg-violet-600 text-white border-violet-500 shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                      : "bg-[#12121e] text-zinc-400 border-violet-900/40 hover:text-white"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#08080f] via-[#08080f] to-transparent pt-12">
          <button className="w-full bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold text-lg py-4 shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all flex items-center justify-center gap-2">
            Start Session
            <Sparkles size={18} />
          </button>
        </div>
        
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>
  );
}
