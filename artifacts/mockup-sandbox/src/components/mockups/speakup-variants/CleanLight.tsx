import React, { useState } from "react";
import { ArrowLeft, Settings, Mic, ChevronRight } from "lucide-react";

const MODES = [
  { id: "friendly", label: "🌱 Friendly Coach" },
  { id: "demanding", label: "🔥 Demanding Coach" },
  { id: "strict", label: "🎓 Strict Examiner" },
];

const SCENARIOS = [
  { id: "interview", icon: "💼", label: "Interview" },
  { id: "meeting", icon: "📊", label: "Meeting" },
  { id: "smalltalk", icon: "☕", label: "Small Talk" },
  { id: "travel", icon: "✈️", label: "Travel" },
  { id: "restaurant", icon: "🍽️", label: "Restaurant" },
  { id: "shopping", icon: "🛍️", label: "Shopping" },
  { id: "medical", icon: "🏥", label: "Medical" },
  { id: "academic", icon: "🎓", label: "Academic" },
  { id: "phone", icon: "📞", label: "Phone Call" },
  { id: "hotel", icon: "🏨", label: "Hotel" },
  { id: "banking", icon: "🏦", label: "Banking" },
  { id: "tech", icon: "💻", label: "Tech Support" },
  { id: "debate", icon: "📰", label: "Debate" },
  { id: "entertainment", icon: "🎬", label: "Entertainment" },
  { id: "networking", icon: "🤝", label: "Networking" },
  { id: "more", icon: "➕", label: "+9 more" },
];

const LEVELS = [
  { id: "auto", label: "Auto ⚡" },
  { id: "a1a2", label: "Beginner A1-A2" },
  { id: "b1b2", label: "Intermediate B1-B2" },
  { id: "c1c2", label: "Advanced C1-C2" },
];

export default function CleanLightMockup() {
  const [activeMode, setActiveMode] = useState("friendly");
  const [activeScenario, setActiveScenario] = useState("interview");
  const [activeLevel, setActiveLevel] = useState("auto");

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 font-sans text-gray-900">
      <div className="w-[390px] h-[844px] bg-white relative overflow-hidden shadow-2xl ring-1 ring-gray-200 sm:rounded-[40px] flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 pt-12 pb-4 bg-white z-10 sticky top-0">
          <button className="p-2 -ml-2 text-gray-900 hover:bg-gray-50 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">New Session</h1>
          <button className="p-2 -mr-2 text-gray-900 hover:bg-gray-50 rounded-full transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-32">
          <div className="px-6 space-y-10 py-4">
            
            {/* Mode Section */}
            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Select Persona</h2>
                <p className="text-sm text-gray-500">Choose who you want to practice with today.</p>
              </div>
              <div className="flex flex-col gap-2">
                {MODES.map((mode) => {
                  const isActive = activeMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setActiveMode(mode.id)}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-50 border-indigo-200 shadow-sm"
                          : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
                      }`}
                    >
                      <span className={`text-base font-medium ${isActive ? "text-indigo-600" : "text-gray-900"}`}>
                        {mode.label}
                      </span>
                      {isActive && <div className="w-2 h-2 rounded-full bg-indigo-600"></div>}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Scenario Section */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Scenario</h2>
                  <p className="text-sm text-gray-500">What do you want to talk about?</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SCENARIOS.map((scenario) => {
                  const isActive = activeScenario === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      onClick={() => setActiveScenario(scenario.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 text-left ${
                        isActive
                          ? "bg-indigo-600 border-indigo-600 shadow-sm"
                          : "bg-white border-gray-200 hover:border-gray-300 shadow-sm"
                      }`}
                    >
                      <span className="text-xl">{scenario.icon}</span>
                      <span className={`text-sm font-medium truncate ${isActive ? "text-white" : "text-gray-900"}`}>
                        {scenario.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Level Section */}
            <section>
              <div className="mb-4">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">Your Level</h2>
                <p className="text-sm text-gray-500">We'll adjust the difficulty to match.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((level) => {
                  const isActive = activeLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => setActiveLevel(level.id)}
                      className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {level.label}
                    </button>
                  );
                })}
              </div>
            </section>

          </div>
        </main>

        {/* Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent pt-12 border-t border-gray-100">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-6 flex items-center justify-center gap-2 font-bold text-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]">
            <Mic className="w-5 h-5" />
            Start Speaking
          </button>
        </div>
      </div>
    </div>
  );
}
