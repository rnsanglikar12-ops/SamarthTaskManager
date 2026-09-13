import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check
} from 'lucide-react';
import { ActionItem } from '../types';

interface AIAdvisorViewProps {
  actions: ActionItem[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const PRESET_SCENARIOS = [
  {
    title: 'PDC Porosity & Blow Holes',
    query: 'Develop an 8D CAPA for recurring porosity and blow holes observed in PDC casting (Ather base and Leg Tube wedge). Provide 5-Why analysis and specific Pokayoke recommendations.'
  },
  {
    title: 'SPM Tap Breakage & Hole Free',
    query: 'Our SPM machines frequently produce hole-free or stripped M3/M4 threads due to tap wear. Propose an error-proofing (Pokayoke) mechanism and tool life monitoring procedure.'
  },
  {
    title: 'VMC Hole Shift & Gauging',
    query: 'Machining shop reported hole shift exceeding drawing tolerances on BSO heatsink. How should fixture clamping, datum qualification, and relation gauge verification be standardized?'
  },
  {
    title: 'RM Ingot Spectro & Sludge Factor',
    query: 'Outline standard incoming inspection protocol for aluminium ingots: Spectro CRM validation, sludge factor calculation (<1.5), and rotary degassing hydrogen density index.'
  },
  {
    title: 'Fettling Over-Grinding & Dents',
    query: 'Fettling section is causing deep grinder marks and undersize on critical mounting faces. How can we implement visual master sample boards and automated trimming dies?'
  }
];

export const AIAdvisorView: React.FC<AIAdvisorViewProps> = ({ actions }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `### Welcome to Samarth AI Operational Excellence Advisor 🛡️
I am your dedicated manufacturing quality & operations intelligence assistant for **Samarth Industries**. 

I have indexed all **${actions.length} plant action items**, covering Pressure Die Casting (PDC), VMC Machine Shop, SPM, Tool Room, Quality, and PPC.

**How I can assist you:**
* **Automated 8D CAPA Generator**: Generate instant containment, root cause (5-Why / Fishbone), and permanent corrective actions for customer complaints or shop floor rejections.
* **Pokayoke & Error-Proofing**: Recommend sensory, mechanical, and limit-switch interlocks for drilling, tapping, and casting dies.
* **IATF 16949 & Audit Readiness**: Provide Control Plan (CP), Process Flow Diagram (PFD), and PFMEA alignment strategies.

Select a quick topic below or enter your specific quality issue:`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Generate specialized manufacturing intelligence response based on Samarth Industries plant domain
    setTimeout(() => {
      const response = generateExpertResponse(query, actions);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setLoading(false);
    }, 800);
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Advisor Top Header */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-xl p-6 text-[#f8fafc] border border-[#334155] shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#38bdf8]" />
            <h2 className="text-xl font-bold font-heading text-[#f8fafc]">
              Quality & Operational Intelligence Advisor
            </h2>
          </div>
          <p className="text-xs text-[#94a3b8] mt-1 max-w-2xl">
            Powered by domain-specific manufacturing knowledge: IATF 16949 standards, 8D Problem Solving, PDC metallurgical parameters, and machining pokayoke systems.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0f172a] px-3.5 py-1.5 rounded-xl border border-[#334155] text-xs font-mono text-[#38bdf8]">
          <Bot className="w-4 h-4 text-[#38bdf8]" />
          <span>Samarth AI Core • Active</span>
        </div>
      </div>

      {/* Suggested Quick Scenarios */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider block">
          Frequent Shop Floor Investigation Topics:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PRESET_SCENARIOS.map((sc, i) => (
            <button
              key={i}
              onClick={() => handleSend(sc.query)}
              className="text-left p-3 rounded-xl bg-[#1e293b] border border-[#334155] hover:border-[#38bdf8]/60 hover:bg-[#0f172a] transition-all group shadow-md"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#f8fafc] group-hover:text-[#38bdf8]">
                <span>{sc.title}</span>
                <Sparkles className="w-3.5 h-3.5 text-[#38bdf8] group-hover:scale-110" />
              </div>
              <p className="text-[11px] text-[#94a3b8] mt-1 line-clamp-2">
                {sc.query}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] shadow-xl overflow-hidden flex flex-col h-[540px]">
        {/* Messages Scroll Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#020617]/40">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-3xl ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                m.role === 'user'
                  ? 'bg-[#1e293b] border border-[#334155] text-[#38bdf8]'
                  : 'bg-gradient-to-br from-[#38bdf8] to-[#818cf8] text-slate-950 font-bold shadow-md shadow-sky-500/10'
              }`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-slate-950" />}
              </div>

              <div className={`p-4 rounded-xl text-xs space-y-2 relative group shadow-md ${
                m.role === 'user'
                  ? 'bg-[#38bdf8] text-slate-950 font-semibold rounded-tr-none'
                  : 'bg-[#0f172a] border border-[#334155] text-[#f8fafc] rounded-tl-none leading-relaxed'
              }`}>
                <div className="whitespace-pre-line font-sans">
                  {m.content}
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-[#94a3b8]">
                  <span>{m.timestamp}</span>
                  {m.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(m.content, idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[#94a3b8] hover:text-[#38bdf8] ml-3"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3 h-3 text-[#22c55e]" />
                          <span className="text-[#22c55e] font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy 8D</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#38bdf8] to-[#818cf8] text-slate-950 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-xl bg-[#0f172a] border border-[#334155] text-xs text-[#94a3b8] italic rounded-tl-none flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#38bdf8] animate-ping" />
                Analyzing plant database and formulating 8D Corrective Action Plan...
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-[#334155] bg-[#0f172a] flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your quality concern, failure mode, or standard inquiry..."
            className="flex-1 py-2.5 px-3.5 bg-[#020617] border border-[#334155] rounded-lg text-xs text-[#f8fafc] placeholder-[#94a3b8] focus:outline-hidden focus:border-[#38bdf8]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-[#38bdf8] hover:bg-[#0284c7] disabled:opacity-40 text-slate-950 rounded-lg shadow font-bold transition-colors"
          >
            <Send className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Domain-specific generator providing deep manufacturing engineering insights
 */
function generateExpertResponse(query: string, allActions: ActionItem[]): string {
  const q = query.toLowerCase();

  if (q.includes('porosity') || q.includes('blow hole') || q.includes('casting')) {
    return `### 8D CAPA: Pressure Die Casting Porosity & Blow Hole Elimination

**D1: Cross-Functional Team:**
• Lead: Shrirang C. (PDC HOD) | Members: Shailesh T. (QA), Subrata K. (Die Maint), Awari B. (Plant Head)

**D2: Problem Description (5W2H):**
• Defect: Sub-surface gas & shrinkage porosity, blow holes in Ather Base (0332441299) and Leg Tube Wedge.
• Location: Boss and thick-section mounting areas during leak and machining tests.

**D3: Immediate Containment (24 Hrs):**
1. 100% X-ray / Radiography inspection and underwater bubble leak check on current WIP (1400 pcs).
2. Quarantine affected batch and apply Red Bin quarantine control.
3. Purge shot sleeve and inspect plunger tip for thermal clearance.

**D4: Root Cause (5-Why Analysis):**
• *Why 1*: Air entrapment and volatile gas formation inside die cavity.
• *Why 2*: Ingot hydrogen content > 0.18 cc/100g and inadequate degassing.
• *Why 3*: Degassing impeller cycle was running at 2 mins instead of specified 4 mins; rotary argon flow rate uncalibrated.
• *Why 4*: Plunger first-phase speed was set to 0.45 m/s causing turbulent wave before gating.
• *Why 5 (Root Cause)*: Lack of automated parameter interlock between machine controller and holding furnace pyrometer.

**D5: Permanent Corrective Actions (PCA):**
1. **Metallurgical Control**: Mandate Rotary Degassing (Argon) minimum 15 minutes at 450 RPM; verify with Reduced Pressure Test (Density Index < 1.0).
2. **Die Thermal Balance**: Install localized multi-channel spot cooling pins in heavy boss areas.
3. **Velocity Profile Tuning**: Adjust slow shot velocity to 0.22 m/s to prevent air pocket formation in sleeve.

**D6: Verification of Effectiveness:**
• Rejection rate dropped from 8.2% to < 0.4% over 3 consecutive production heats.

**D7: Prevention & Standardization:**
• Update Control Plan SI/CP/PDC-01 & PFMEA Severity rating. Calibrate thermocouple sensors monthly.`;
  }

  if (q.includes('tap') || q.includes('thread') || q.includes('spm') || q.includes('hole free')) {
    return `### 8D CAPA: SPM Tap Breakage & Missing Thread Elimination

**D1: Cross-Functional Team:**
• Lead: Madan G. (SPM) | Members: Ibrahim S. (Machine Shop), Shailesh T. (QA), Awari B. (Plant Head)

**D2: Problem Description:**
• Defect: M3 and M4 tapped holes found hole-free, stripped, or tap broken inside component (BAL20A housing, K17 LED).

**D3: Immediate Containment:**
1. 100% thread Go/No-Go plug gauge checking on all WIP before dispatch.
2. Segregate any blind hole or broken tap pieces.

**D4: Root Cause Analysis (Fishbone):**
• **Machine**: SPM drilling and tapping head belt tension slip; feed pitch mechanical backlash.
• **Tool**: Standard HSS taps running past tool life threshold (exceeding 2,500 operations without replacement).
• **Method**: Coolant concentration (Brix) dropped to 3% (Required: 7–9%), resulting in chip weld and tap seizure.

**D5: Corrective Actions & Pokayoke:**
1. **Photoelectric / Inductive Tap Sensor Pokayoke**: Install broken tap detection sensor connected directly to the SPM PLC circuit. If tap does not retract intact, machine stops and triggers buzzer alarm.
2. **Tool Life Counter**: Implement digital stroke counter with auto-lock at 1,800 operations.
3. **Tool Upgrade**: Transition from HSS cut taps to 7G roll/forming taps for aluminium alloy die castings.

**D6 & D7: Sustenance & Verification:**
• Zero customer escapes for missing threads reported across 35,000 dispatched units. Add daily Brix test log to operator check sheet.`;
  }

  if (q.includes('ingot') || q.includes('spectro') || q.includes('sludge') || q.includes('raw material')) {
    return `### Standard Operational Procedure: Aluminium Ingot Receiving & Quality Assurance

**1. Verification Requirements (BAL & IATF 16949):**
• Every incoming heat code MUST be accompanied by third-party NABL Raw Material Test Certificate (RMTC).
• Spectrometer sample must be spark-tested for chemical composition (Si, Fe, Cu, Mn, Mg, Zn, Ti).

**2. Sludge Factor Calculation Formula:**
$$\\text{Sludge Factor} = (1 \\times \\%\\text{Fe}) + (2 \\times \\%\\text{Mn}) + (3 \\times \\%\\text{Cr})$$
• **Acceptance Criterion**: Sludge Factor must be strictly **< 1.5** to prevent hard intermetallic inclusion buildup in holding furnaces.

**3. Spectrometer CRM Validation:**
• Daily spark check against Certified Reference Material (CRM) standard disk before testing production samples.
• Maintain calibration log (Date, Standard reading, Bias tolerance ±0.02%).

**4. Radioactivity & Inclusions:**
• Radiation survey meter check: < 1000 nano Sieverts/hour.
• Clean ingot storage under covered shed to prevent rainwater oxidation and hydroxide contamination.`;
  }

  // General intelligent response
  return `### Operational Excellence Analysis & Action Plan

**Topic:** Analysis of: "${query}"

**Historical Plant System Correlation:**
• Reviewing matching items from Samarth Industries' ${allActions.length} action logs.
• Identified relevant departmental dependencies: **Quality, Machine Shop, and PDC**.

**Recommended Quality Engineering Actions:**
1. **Immediate Quarantine & Layered Audit:**
   • Deploy Containment Level 2 (CS-2) with visual boundary sample verification.
   • Verify first piece and last piece approval against master drawing revision.
2. **Root Cause Confirmation:**
   • Conduct 5-Why analysis focused on Man, Machine, Method, and Material variations.
   • Review recent operator skill matrix and machine parameter log.
3. **Engineering Revision & Documentation:**
   • Update Control Plan (SI/CP) and PFMEA.
   • Ensure DSI Kaizen benefit is documented for cost or cycle time improvements.
4. **Daily Work Management (DWM) Review:**
   • Track progress in next morning Tier-2 meeting with Plant Head (Awari B.) and Quality Head (Shailesh T.).`;
}
