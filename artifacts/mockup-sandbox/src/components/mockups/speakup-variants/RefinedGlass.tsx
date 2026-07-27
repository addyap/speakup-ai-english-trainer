import React, { useState } from "react";
import { ChevronLeft, Volume2, Sparkles, Zap, GraduationCap, Flame, Target } from "lucide-react";

export default function RefinedGlass() {
  const [selectedMode, setSelectedMode] = useState("Friendly Coach");
  const [selectedCategory, setSelectedCategory] = useState("Work");
  const [selectedScenario, setSelectedScenario] = useState("Job Interview");
  const [selectedLevel, setSelectedLevel] = useState("Smart Adapt");

  const modes = [
    { name: "Friendly Coach", icon: "🌱" },
    { name: "Demanding Coach", icon: "🔥" },
    { name: "Strict Examiner", icon: "🎓" },
  ];

  const categories = ["Work", "Social", "Travel", "Life"];

  const scenarios: Record<string, { name: string; icon: string; desc: string }[]> = {
    Work: [
      { name: "Job Interview", icon: "💼", desc: "Practice answering tough questions." },
      { name: "Business Meeting", icon: "📊", desc: "Lead or participate in discussions." },
      { name: "Tech Support", icon: "💻", desc: "Help a client with a technical issue." },
      { name: "Networking", icon: "🤝", desc: "Make connections at an event." },
      { name: "Legal", icon: "⚖️", desc: "Discuss contracts and negotiations." },
    ],
    Social: [
      { name: "Small Talk", icon: "☕", desc: "Casual chats with friends." },
      { name: "Dating", icon: "💬", desc: "Go on a blind date." },
      { name: "Entertainment", icon: "🎬", desc: "Discuss movies and books." },
      { name: "Sports", icon: "🏋️", desc: "Talk about your favorite team." },
      { name: "News & Debate", icon: "📰", desc: "Discuss current events." },
    ],
    Travel: [
      { name: "Travel", icon: "✈️", desc: "General travel situations." },
      { name: "Airport", icon: "🛫", desc: "Check-in and security." },
      { name: "Hotel", icon: "🏨", desc: "Book a room and complain." },
      { name: "Apartment", icon: "🏠", desc: "Rent a place abroad." },
      { name: "Real Estate", icon: "🗺️", desc: "Buy property." },
    ],
    Life: [
      { name: "Daily Life", icon: "🏙️", desc: "Everyday routines." },
      { name: "Restaurant", icon: "🍽️", desc: "Order food and pay." },
      { name: "Shopping", icon: "🛍️", desc: "Buy clothes and groceries." },
      { name: "Medical", icon: "🏥", desc: "Visit a doctor." },
      { name: "Academic", icon: "🎓", desc: "University lectures." },
      { name: "Phone Call", icon: "📞", desc: "Make appointments." },
      { name: "Banking", icon: "🏦", desc: "Open an account." },
      { name: "Emergency", icon: "🚨", desc: "Call for help." },
      { name: "Cooking", icon: "👨‍🍳", desc: "Follow a recipe." },
    ]
  };

  const levels = [
    { name: "Smart Adapt", icon: "⚡", desc: "Auto-adjusts to you" },
    { name: "Beginner", icon: "A1-A2", desc: "Simple sentences" },
    { name: "Intermediate", icon: "B1-B2", desc: "Daily conversations" },
    { name: "Advanced", icon: "C1-C2", desc: "Complex discussions" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-black/90 p-4 font-sans selection:bg-indigo-500/30">
      <div className="w-[390px] h-[844px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 rounded-[40px] shadow-2xl overflow-hidden relative border-[8px] border-black/80 flex flex-col ring-1 ring-white/10 text-slate-200">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-4 flex items-center justify-between z-10">
          <button className="w-10 h-10 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
            <Volume2 size={14} className="text-indigo-300" />
            <span className="text-xs font-medium text-indigo-200">SpeakUp AI</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-32 scrollbar-hide">
          <div className="px-6 space-y-8">
            
            {/* Title Section */}
            <div>
              <h1 className="text-3xl font-light tracking-tight text-white mb-2">New Session</h1>
              <p className="text-sm text-indigo-200/60">Configure your AI speaking partner</p>
            </div>

            {/* Mode Selector */}
            <section>
              <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Coach Persona</h2>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                {modes.map((mode) => (
                  <button
                    key={mode.name}
                    onClick={() => setSelectedMode(mode.name)}
                    className={`flex-none flex items-center gap-2 px-4 py-2.5 rounded-full transition-all duration-300 border ${
                      selectedMode === mode.name
                        ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)] text-indigo-100"
                        : "bg-white/5 border-white/5 hover:bg-white/10 text-white/70"
                    }`}
                  >
                    <span className="text-base">{mode.icon}</span>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {mode.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* Scenario Picker */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Scenario</h2>
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                        selectedCategory === cat ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex overflow-x-auto gap-3 pb-4 -mx-6 px-6 scrollbar-hide snap-x">
                {scenarios[selectedCategory].map((scenario) => (
                  <button
                    key={scenario.name}
                    onClick={() => setSelectedScenario(scenario.name)}
                    className={`flex-none w-[140px] p-4 rounded-3xl transition-all duration-300 border snap-start text-left ${
                      selectedScenario === scenario.name
                        ? "bg-white/10 backdrop-blur-xl border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                        : "bg-white/5 backdrop-blur-md border-white/5 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="text-3xl mb-3">{scenario.icon}</div>
                    <h3 className="font-semibold text-sm text-white mb-1">{scenario.name}</h3>
                    <p className="text-[10px] text-white/50 leading-snug line-clamp-2">{scenario.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Level Selector */}
            <section>
              <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Proficiency Level</h2>
              <div className="grid grid-cols-2 gap-3">
                {levels.map((level) => (
                  <button
                    key={level.name}
                    onClick={() => setSelectedLevel(level.name)}
                    className={`p-4 rounded-3xl transition-all duration-300 border text-left ${
                      selectedLevel === level.name
                        ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                        : "bg-white/5 border-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className={`text-xs font-bold mb-2 ${selectedLevel === level.name ? "text-indigo-400" : "text-white/40"}`}>
                      {level.icon}
                    </div>
                    <h3 className={`font-medium text-sm mb-0.5 ${selectedLevel === level.name ? "text-indigo-50" : "text-white/80"}`}>
                      {level.name}
                    </h3>
                    <p className="text-[10px] text-white/40">{level.desc}</p>
                  </button>
                ))}
              </div>
            </section>

          </div>
        </div>

        {/* Sticky CTA */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pt-12 pointer-events-none">
          <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium shadow-[0_0_30px_rgba(99,102,241,0.4)] pointer-events-auto hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <Sparkles size={18} className="text-indigo-100" />
            Start Speaking
          </button>
        </div>

      </div>
    </div>
  );
}
