
'use client';

import { useState } from 'react';
import { mockAuditResult } from './mockData';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'violations' | 'passed' | 'manual' | 'inapplicable'>('violations');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleExport = () => {
    if (!result) return;
    const dataStr = JSON.stringify(result, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `accessibility-audit-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white">
       <div className="w-8 h-8 border-2 border-gray-100 border-t-blue-600 rounded-full animate-spin"></div>
       <h2 className="mt-4 text-sm font-medium text-gray-900 tracking-tight">Analyzing accessibility for {url}...</h2>
    </div>
  );

  if (result) return (
    <div className="flex min-h-screen bg-white text-gray-900 selection:bg-blue-50 selection:text-blue-900">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-50/50 border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-6">
           <div className="text-sm font-semibold flex items-center gap-2 tracking-tight">
              <LogoIcon /> AllAccess
           </div>
        </div>
        
        <div className="px-4 flex flex-col gap-6 overflow-y-auto">
           <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
              <img src={result.screenshot} className="w-full aspect-video object-cover" alt="Preview" />
              <div className="p-3">
                 <span className="text-[10px] text-gray-400 font-mono truncate block mb-1">{result.url}</span>
                 <div className="flex items-center gap-1.5 text-[10px] font-semibold text-red-600 uppercase tracking-wider">
                   Non-Compliant
                 </div>
              </div>
           </div>

           <nav className="flex flex-col gap-0.5">
              <SidebarLink label="Overview" active />
              <SidebarLink label="Compliance" />
              <SidebarLink label="Manual Audits" />
              <SidebarLink label="Settings" />
           </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pl-64">
        <div className="p-12 max-w-6xl mx-auto">
           <header className="mb-10 flex justify-between items-end">
              <div>
                 <h1 className="text-2xl font-semibold tracking-tight">Audit Report</h1>
                 <p className="text-gray-500 text-sm mt-1">{new Date(result.timestamp).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
              </div>
              <button 
                onClick={handleExport}
                className="bg-gray-900 text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-black transition-colors shadow-sm active:scale-95"
              >
                Export Analysis
              </button>
           </header>

           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center">
                 <div className="w-20 h-20 rounded-full border-2 border-gray-900 flex items-center justify-center">
                    <span className="text-2xl font-semibold">{result.score}</span>
                 </div>
                 <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Health Score</p>
              </div>
              
              <div className="md:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-center gap-5">
                 {(() => {
                    const totalRules = result.summary.violations + result.summary.passed + result.summary.manual + result.summary.inapplicable;
                    return (
                       <>
                          <CriteriaItem label="Critical Violations" count={result.summary.violations} total={totalRules} color="bg-red-500" />
                          <CriteriaItem label="Passed Checks" count={result.summary.passed} total={totalRules} color="bg-emerald-500" />
                          <CriteriaItem label="Manual Review" count={result.summary.manual} total={totalRules} color="bg-amber-500" />
                       </>
                    );
                 })()}
              </div>
           </div>

           <div className="flex gap-6 mb-6 border-b border-gray-200">
              {['violations', 'passed', 'manual', 'inapplicable'].map((t: any) => (
                 <button 
                   key={t} 
                   className={`pb-3 px-1 text-xs font-medium tracking-tight relative transition-all ${activeTab === t ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-400 hover:text-gray-600'}`} 
                   onClick={() => setActiveTab(t)}
                 >
                    {t === 'violations' ? 'Issues' : 
                     t === 'passed' ? 'Passed' : 
                     t === 'manual' ? 'Manual' : 'N/A'} ({result.summary[t]})
                 </button>
              ))}
           </div>

           <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-[48px_1fr_180px_120px_100px_40px] p-4 bg-gray-50/50 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                 <div className="pl-1">#</div><div>Requirement</div><div>Disabilities</div><div>Status</div><div>Criteria</div><div></div>
              </div>

              {/* Violations Tab */}
              {activeTab === 'violations' && result.categories.violations?.map((v: any, i: number) => (
                <div key={v.id} className="border-b border-gray-100 last:border-none">
                   <div className={`grid grid-cols-[48px_1fr_180px_120px_100px_40px] px-4 py-5 items-center cursor-pointer hover:bg-gray-50/50 transition-colors ${expandedId === v.id ? 'bg-gray-50/50' : ''}`} onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                      <div className="text-gray-300 font-mono text-xs pl-1">{i + 1}</div>
                      <div className="text-sm font-medium pr-6">{v.help}</div>
                      <div className="flex flex-wrap gap-1 pr-4">
                         {v.disabilities?.map((d: string) => (
                            <span key={d} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-semibold uppercase tracking-wider">
                               {d}
                            </span>
                         ))}
                      </div>
                      <div>
                         <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1.5">
                            {v.nodes.length} Elements
                         </span>
                      </div>
                      <div className="text-[10px] font-medium text-gray-500 font-mono uppercase tracking-tight">{v.wcagCriteria}</div>
                      <div className="flex justify-center text-gray-300">{expandedId === v.id ? <ChevronUp /> : <ChevronDown />}</div>
                   </div>
                   
                   {expandedId === v.id && (
                      <div className="p-10 bg-gray-50/30 border-t border-gray-100">
                         <div className="flex flex-col gap-10 max-w-4xl mx-auto">
                            <div className="flex flex-col gap-4">
                               <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Code Analysis</h4>
                                  <AIFixButton 
                                    violation={v} 
                                    onSuggestion={(s: string) => {
                                      setSuggestions(prev => ({ ...prev, [v.id]: s }));
                                    }} 
                                  />
                               </div>
                               <FailingElementsList nodes={v.nodes} />
                            </div>

                            {suggestions[v.id] && (
                               <div className="bg-white border border-gray-200 rounded-xl shadow-sm relative overflow-hidden group">
                                  <div className="p-6">
                                     <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 flex items-center gap-2">
                                           Suggested Fix
                                        </h4>
                                        <button onClick={() => {
                                           const n = {...suggestions}; delete n[v.id]; setSuggestions(n);
                                        }} className="text-[10px] font-medium uppercase tracking-widest text-gray-400 hover:text-gray-600">Dismiss</button>
                                     </div>
                                     <div className="font-mono text-xs leading-relaxed text-gray-700 overflow-x-auto whitespace-pre p-4 bg-gray-50 rounded-lg border border-gray-100 shadow-inner">
                                        <code dangerouslySetInnerHTML={{ __html: suggestions[v.id].replace(/```(html|jsx)?/g, '').replace(/\n/g, '<br/>') }} />
                                     </div>
                                  </div>
                               </div>
                            )}

                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                               <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Impact</h4>
                               <p className="text-gray-600 text-sm leading-relaxed">{v.description}</p>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              ))}

              {/* Passed Tab */}
              {activeTab === 'passed' && result.categories.passed?.map((p: any, i: number) => (
                <div key={p.id} className="border-b border-gray-100 last:border-none">
                   <div className={`grid grid-cols-[48px_1fr_180px_120px_100px_40px] px-4 py-5 items-center cursor-pointer hover:bg-gray-50/50 transition-colors ${expandedId === p.id ? 'bg-gray-50/50' : ''}`} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                      <div className="text-gray-300 font-mono text-xs pl-1">{i + 1}</div>
                      <div className="text-sm font-medium pr-6">{p.help}</div>
                      <div className="flex flex-wrap gap-1 pr-4">
                         {p.disabilities?.map((d: string) => (
                            <span key={d} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-semibold uppercase tracking-wider">
                               {d}
                            </span>
                         ))}
                      </div>
                      <div>
                         <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1.5">
                            Passed
                         </span>
                      </div>
                      <div className="text-[10px] font-medium text-gray-500 font-mono uppercase tracking-tight">{p.wcagCriteria}</div>
                      <div className="flex justify-center text-gray-300">{expandedId === p.id ? <ChevronUp /> : <ChevronDown />}</div>
                   </div>
                   
                   {expandedId === p.id && (
                      <div className="p-10 bg-gray-50/30 border-t border-gray-100">
                         <div className="max-w-4xl mx-auto">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                               <h4 className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-3">Audit Details</h4>
                               <p className="text-gray-600 text-sm leading-relaxed">{p.description}</p>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              ))}

              {/* Inapplicable Tab */}
              {activeTab === 'inapplicable' && result.categories.inapplicable?.map((p: any, i: number) => (
                <div key={p.id} className="border-b border-gray-100 last:border-none">
                   <div className={`grid grid-cols-[48px_1fr_180px_120px_100px_40px] px-4 py-5 items-center cursor-pointer hover:bg-gray-50/50 transition-colors ${expandedId === p.id ? 'bg-gray-50/50' : ''}`} onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                      <div className="text-gray-300 font-mono text-xs pl-1">{i + 1}</div>
                      <div className="text-sm font-medium pr-6">{p.help}</div>
                      <div className="flex flex-wrap gap-1 pr-4">
                         {p.disabilities?.map((d: string) => (
                            <span key={d} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-semibold uppercase tracking-wider">
                               {d}
                            </span>
                         ))}
                      </div>
                      <div>
                         <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1.5">
                            N/A
                         </span>
                      </div>
                      <div className="text-[10px] font-medium text-gray-500 font-mono uppercase tracking-tight">{p.wcagCriteria}</div>
                      <div className="flex justify-center text-gray-300">{expandedId === p.id ? <ChevronUp /> : <ChevronDown />}</div>
                   </div>
                   
                   {expandedId === p.id && (
                      <div className="p-10 bg-gray-50/30 border-t border-gray-100">
                         <div className="max-w-4xl mx-auto">
                            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm opacity-80">
                               <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Reason</h4>
                               <p className="text-gray-600 text-sm leading-relaxed">{p.description}</p>
                            </div>
                         </div>
                      </div>
                   )}
                </div>
              ))}

              {activeTab === 'manual' && (
                 <div className="p-12 bg-white flex flex-col items-center">
                    <div className="max-w-2xl text-center mb-10">
                       <h2 className="text-lg font-semibold mb-2 tracking-tight">Expert Audit Required</h2>
                       <p className="text-gray-500 text-sm leading-relaxed">
                          The following accessibility areas require human verification or automated procedural checks to ensure full legal compliance.
                       </p>
                    </div>
                    <div className="w-full max-w-4xl flex flex-col gap-10">
                       {/* Automated Procedures Section */}
                       {result.categories.manual.procedures && result.categories.manual.procedures.length > 0 && (
                          <div className="flex flex-col gap-6">
                             <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100 pb-4">Automated Procedures</h3>
                             {result.categories.manual.procedures.map((proc: any) => (
                                <div key={proc.id} className={`border rounded-xl p-6 shadow-sm transition-all ${proc.passed ? 'bg-emerald-50/20 border-emerald-100' : 'bg-amber-50/20 border-amber-100'}`}>
                                   <div className="flex justify-between items-start mb-4">
                                      <div className="flex flex-col gap-1">
                                         <h4 className="font-semibold text-sm flex items-center gap-2">
                                            {proc.title}
                                            {proc.passed ? 
                                               <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Pass</span> : 
                                               <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Issue</span>
                                            }
                                         </h4>
                                         <p className="text-gray-500 text-xs">{proc.purpose}</p>
                                      </div>
                                      <div className="flex gap-2">
                                         {proc.levels.map((l: string) => (
                                            <span key={l} className="text-[9px] font-bold text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded uppercase">{l}</span>
                                         ))}
                                      </div>
                                   </div>

                                   {proc.issues && proc.issues.length > 0 && (
                                      <div className="mt-4 bg-white/50 border border-amber-100 rounded-lg p-4">
                                         <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">Detected Issues:</h5>
                                         <ul className="list-disc list-inside text-xs text-amber-900 flex flex-col gap-1">
                                            {proc.issues.map((issue: string, idx: number) => (
                                               <li key={idx}>{issue}</li>
                                            ))}
                                         </ul>
                                      </div>
                                   )}

                                   <div className="mt-6 pt-4 border-t border-gray-100/50 flex flex-col gap-3">
                                      {proc.criteria.map((c: any, idx: number) => (
                                         <div key={idx} className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                               <span className="text-[10px] font-mono font-bold text-gray-400">{c.code} {c.name}</span>
                                               <span className="text-[9px] font-medium text-gray-400 italic">Target: {c.testing}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-relaxed italic">"{c.description}"</p>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}

                       {/* Manual Verification Section */}
                       {result.categories.manual.verificationRequired && result.categories.manual.verificationRequired.length > 0 && (
                          <div className="flex flex-col gap-6">
                             <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100 pb-4 mt-6">Items Requiring Manual Review</h3>
                             {result.categories.manual.verificationRequired?.map((v: any, i: number) => (
                                <div key={v.id} className="border border-gray-200 rounded-xl p-6 shadow-sm">
                                   <div className="flex justify-between items-start mb-4">
                                      <div className="flex flex-col gap-2">
                                         <h3 className="font-semibold text-sm">{v.help}</h3>
                                         <div className="flex flex-wrap gap-1">
                                            {v.disabilities?.map((d: string) => (
                                               <span key={d} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 text-[9px] font-semibold uppercase tracking-wider">
                                                  {d}
                                               </span>
                                            ))}
                                         </div>
                                      </div>
                                      <span className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-tight">{v.wcagCriteria}</span>
                                   </div>
                                   <p className="text-gray-500 text-sm mb-6 leading-relaxed">{v.description}</p>
                                   <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                      <h4 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Verification Target</h4>
                                      {v.nodes.map((node: any, idx: number) => (
                                         <div key={idx} className="mb-2 last:mb-0">
                                            <code className="text-[11px] text-gray-600">{node.html}</code>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ))}
                          </div>
                       )}
                    </div>
                 </div>
              )}

              {/* Fallback for empty tabs */}
              {((activeTab === 'violations' && !result.categories.violations?.length) ||
                (activeTab === 'passed' && !result.categories.passed?.length) ||
                (activeTab === 'inapplicable' && !result.categories.inapplicable?.length) ||
                (activeTab === 'manual' && !result.categories.manual.verificationRequired?.length)) && (
                 <div className="p-20 text-center flex flex-col items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                       <LogoIcon />
                    </div>
                    <p className="text-gray-400 text-xs font-medium italic">No items found for this section.</p>
                 </div>
              )}
           </div>
        </div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-900 font-sans selection:bg-blue-50 selection:text-blue-900">
       <header className="p-8 flex justify-between items-center max-w-6xl mx-auto w-full">
          <div className="text-lg font-semibold flex items-center gap-2 tracking-tight">
             <LogoIcon /> AllAccess
          </div>
          <div className="hidden md:flex gap-8 text-[11px] font-medium text-gray-500 uppercase tracking-widest">
             <a href="#" className="hover:text-black transition-colors">Documentation</a>
             <a href="#" className="hover:text-black transition-colors">Pricing</a>
          </div>
       </header>

       <main className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
          <div className="max-w-3xl w-full text-center">
             <div className="mb-8 inline-block bg-blue-50 text-blue-700 px-4 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest border border-blue-100/50">
                AI Engine v2.4
             </div>
             <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
                Web accessibility <br/> 
                <span className="text-gray-400">made simple.</span>
             </h1>
             <p className="text-lg text-gray-500 font-medium max-w-xl mx-auto mb-16 leading-relaxed">
                Automatically audit your website and generate production-ready code fixes for critical accessibility failures in seconds.
             </p>

             <form onSubmit={handleScan} className="max-w-xl mx-auto relative group">
                <div className="flex p-1.5 bg-white border border-gray-200 rounded-2xl shadow-xl transition-all group-focus-within:border-gray-900 group-focus-within:ring-4 group-focus-within:ring-gray-100/50">
                   <input 
                      type="text" 
                      placeholder="Enter website URL..." 
                      className="flex-1 px-5 py-4 text-base font-medium outline-none placeholder:text-gray-300" 
                      value={url} 
                      onChange={(e) => setUrl(e.target.value)} 
                   />
                   <button 
                      type="submit" 
                      className="bg-gray-900 text-white px-8 py-4 rounded-xl font-semibold text-sm hover:bg-black transition-all active:scale-95 shadow-sm"
                   >
                      Run Audit
                   </button>
                </div>
             </form>
             
             <button onClick={() => setResult(mockAuditResult)} className="mt-8 text-[11px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-900 transition-all border-b border-transparent hover:border-gray-900 pb-1">
                Load Sample Report
             </button>
          </div>
       </main>

       <footer className="p-8 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
          © 2026 AllAccess • Precise Accessibility Automation
       </footer>
    </div>
  );
}

function SidebarLink({ label, active = false }: any) {
  return (
    <div className={`py-2 px-3 rounded-md font-medium text-[13px] tracking-tight cursor-pointer transition-all ${active ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'bg-transparent text-gray-500 hover:text-gray-900'}`}>
       {label}
    </div>
  );
}

function CriteriaItem({ label, count, total, color }: any) {
  const pct = Math.min(100, (count / total) * 100);
  return (
    <div className="flex flex-col gap-2">
       <div className="flex justify-between items-end">
          <span className="font-semibold text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
          <span className="font-semibold text-xs text-gray-700">{count} / {total}</span>
       </div>
       <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} transition-all duration-1000 ease-in-out`} style={{ width: `${pct}%` }}></div>
       </div>
    </div>
  );
}

function FailingElementsList({ nodes }: { nodes: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayedNodes = showAll ? nodes : nodes.slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      {displayedNodes.map((node: any, idx: number) => (
        <div key={idx} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm">
           <div className="font-mono text-[10px] text-gray-400 mb-3 truncate">{Array.isArray(node.target) ? node.target.join(' > ') : (node.selector || node.target)}</div>
           <div className="font-mono text-[11px] bg-gray-50 p-4 rounded-lg border border-gray-100 break-all text-gray-600 shadow-inner">
              <code>{node.snippet || node.html}</code>
           </div>
           
           {node.colors && (
             <div className="grid grid-cols-2 gap-6 bg-gray-50/50 p-4 rounded-lg border border-gray-100 mt-4">
               <div>
                 <h5 className="text-[9px] font-semibold mb-2 text-gray-400 uppercase tracking-widest">Baseline</h5>
                 <div className="flex flex-col gap-2">
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded border border-gray-200 shadow-sm" style={{ background: node.colors.fgColor || node.colors.foreground }}></div>
                     <span className="text-[10px] font-medium font-mono uppercase tracking-tight">TEXT: {node.colors.fgColor || node.colors.foreground}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded border border-gray-200 shadow-sm" style={{ background: node.colors.bgColor || node.colors.background }}></div>
                     <span className="text-[10px] font-medium font-mono uppercase tracking-tight">BACK: {node.colors.bgColor || node.colors.background}</span>
                   </div>
                 </div>
               </div>
               {node.colors_fixed && (
                 <div>
                   <h5 className="text-[9px] font-semibold mb-2 text-emerald-600 uppercase tracking-widest">Recommended</h5>
                   <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded border border-emerald-100 shadow-sm" style={{ background: node.colors_fixed.fixedFg.foreground }}></div>
                       <span className="text-[10px] font-semibold font-mono uppercase tracking-tight text-emerald-700">TEXT: {node.colors_fixed.fixedFg.foreground}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded border border-emerald-100 shadow-sm" style={{ background: node.colors_fixed.fixedFg.background }}></div>
                       <span className="text-[10px] font-semibold font-mono uppercase tracking-tight text-emerald-700">BACK: {node.colors_fixed.fixedFg.background}</span>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           )}
        </div>
      ))}
      {nodes.length > 3 && (
        <button 
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 border border-gray-200 rounded-xl text-[11px] font-semibold uppercase tracking-widest text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all active:scale-[0.98]"
        >
          {showAll ? 'Show Fewer Elements' : `Show ${nodes.length - 3} More Elements`}
        </button>
      )}
    </div>
  );
}

function AIFixButton({ violation, onSuggestion }: { violation: any, onSuggestion: (s: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleFix = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fix', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ violation }) });
      const data = await res.json();
      onSuggestion(data.suggestion);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <button 
      className="bg-blue-600 text-white px-4 py-1.5 rounded-md font-semibold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm active:scale-95" 
      onClick={handleFix} 
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Generate Fix'}
    </button>
  );
}

const LogoIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-900"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const ChevronDown = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
const ChevronUp = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>;
