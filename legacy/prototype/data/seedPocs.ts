import { PoC } from '../types';
import { TARGET_SOL, SOL_USD_RATE } from '../utils/bondingCurve';

export const SEED_POCS: PoC[] = [
  {
    id: 'poc-nexus-ide',
    title: 'NexusFlow Studio',
    ticker: '$NEXUS',
    tagline: 'Autonomous AI Cloud Code IDE that writes, tests, and self-heals in the browser.',
    description: 'A revolutionary Proof of Concept demonstrating a self-contained autonomous browser IDE. Developers prompt specifications and NexusFlow generates isolated sandbox environments, automatically writes unit tests, and detects runtime exceptions with instant self-patching.',
    category: 'DevTools',
    creator: {
      name: 'Elena Rostova',
      handle: '@elena_builds',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      address: '7XqP3sKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
      graduatedCount: 5,
      badges: ['top_developer', 'high_vol_creator', 'verified_creator'],
    },
    mintAddress: 'NEXUSy2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt8X9p3mK',
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    bondingCurveProgress: 88.4,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 75.14,
    tokensSold: 707_200_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000185,
    marketCapSol: 185.0,
    marketCapUsd: 185.0 * SOL_USD_RATE,
    volume24hSol: 342.5,
    priceChange24h: 312.4,
    isGraduated: false,
    holdersCount: 428,
    prompt: 'Create a browser-based developer IDE sandbox with real-time TypeScript execution, virtual file system tabs, live output console, and an AI Auto-Fix pipeline.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Build a dark-themed online code editor with run button and output terminal.',
        timestamp: Date.now() - 1000 * 60 * 60 * 18,
        changelog: ['Initial prototype sandbox engine', 'Syntax highlighting styling', 'Terminal output buffer'],
        author: '@elena_builds',
      },
      {
        version: 'v1.2',
        prompt: 'Add virtual file explorer, AI code completion simulation, and execution benchmark gauge.',
        timestamp: Date.now() - 1000 * 60 * 60 * 7,
        changelog: ['Added file tree tabs (main.ts, utils.ts, styles.css)', 'Live execution benchmark HUD', 'Simulated AI auto-refactoring button'],
        author: '@elena_builds',
      },
    ],
    problemSolved: 'Developers spend up to 40% of their day debugging boilerplates and configuring local Docker containers. NexusFlow reduces PoC deployment latency from hours to seconds.',
    features: [
      'Zero-dependency in-memory virtual JavaScript/TS runtime',
      'Real-time output stream with ANSI color parsing',
      'AI error interceptor with 1-click self-repair',
      'Instant bundle export to WebContainer',
    ],
    techStack: ['WebAssembly JS Engine', 'Monaco Shims', 'Tailwind CSS', 'Gemini 3.8 Code Agent'],
    iterationIdeas: [
      'Prompt: Add GitHub Gist 1-click publishing',
      'Prompt: Integrate live peer-to-peer WebRTC collaborative cursor stream',
      'Prompt: Add dark high-contrast cyber theme with sound effects',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #07090e; color: #f1f5f9; font-family: ui-monospace, monospace; }
  </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <!-- Top Bar -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-3">
        <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"></span>
        <span class="font-bold text-sm tracking-wide text-white">NexusFlow IDE</span>
        <span class="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">v1.2 Active</span>
      </div>
      <div class="flex items-center gap-2">
        <button id="aiRefactorBtn" class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition">
          ✨ <span>AI Auto-Refactor</span>
        </button>
        <button id="runBtn" class="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs px-4 py-1.5 rounded-lg flex items-center gap-1 transition">
          ▶ <span>RUN CODE</span>
        </button>
      </div>
    </div>

    <!-- IDE Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Editor Column -->
      <div class="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div class="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center gap-3 text-xs text-slate-400">
          <span class="text-white border-b-2 border-emerald-400 pb-1 font-medium cursor-pointer">src/pipeline.ts</span>
          <span class="hover:text-slate-200 cursor-pointer">config.json</span>
          <span class="hover:text-slate-200 cursor-pointer">tests.spec.ts</span>
        </div>
        <textarea id="codeEditor" rows="11" class="w-full bg-slate-900/40 p-4 text-xs font-mono text-emerald-300 focus:outline-none resize-none leading-relaxed">// Prompt-generated Pipeline PoC
function computeDecentralizedConsensus(nodes: number) {
  const quorum = Math.ceil(nodes * 0.67);
  console.log("Evaluating consensus across " + nodes + " active validator nodes...");
  
  let votesApproved = 0;
  for (let i = 1; i <= nodes; i++) {
    const latency = Math.floor(Math.random() * 45) + 12;
    if (latency < 45) votesApproved++;
  }
  
  return {
    quorumNeeded: quorum,
    votesApproved: votesApproved,
    consensusAchieved: votesApproved >= quorum
  };
}

const result = computeDecentralizedConsensus(100);
console.log("FINAL STATUS:", result);
</textarea>
      </div>

      <!-- Execution Terminal & Telemetry -->
      <div class="bg-black/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800 mb-2">
            <span class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span> TERMINAL OUTPUT
            </span>
            <span id="execSpeed" class="text-slate-500 font-mono">Ready</span>
          </div>
          <div id="terminalStream" class="h-44 overflow-y-auto text-xs space-y-1 text-slate-300 font-mono">
            <div class="text-slate-500">// Nexus Virtual Container online. Click 'RUN CODE' to execute.</div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[10px]">
          <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div class="text-slate-400">Memory Allocated</div>
            <div class="text-emerald-400 font-bold font-mono">14.2 MB</div>
          </div>
          <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div class="text-slate-400">Execution Engine</div>
            <div class="text-white font-bold font-mono">WASM V8 Core</div>
          </div>
          <div class="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div class="text-slate-400">Sandbox Isolation</div>
            <div class="text-emerald-400 font-bold font-mono">SECURE</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-4 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
    <span>NexusFlow Proof-of-Concept • Live Prompting Sandbox</span>
    <span>Ape to graduate to Mainnet Incubator</span>
  </div>

  <script>
    const runBtn = document.getElementById('runBtn');
    const aiRefactorBtn = document.getElementById('aiRefactorBtn');
    const terminal = document.getElementById('terminalStream');
    const speed = document.getElementById('execSpeed');
    const editor = document.getElementById('codeEditor');

    runBtn.addEventListener('click', () => {
      const now = new Date().toTimeString().split(' ')[0];
      speed.textContent = 'Running...';
      
      terminal.innerHTML += '<div class="text-slate-500">[' + now + '] $ bun run src/pipeline.ts</div>';
      terminal.innerHTML += '<div class="text-cyan-400">Evaluating consensus across 100 active validator nodes...</div>';
      
      setTimeout(() => {
        const approved = Math.floor(82 + Math.random() * 15);
        terminal.innerHTML += '<div class="text-emerald-400 font-bold">✓ FINAL STATUS: { quorumNeeded: 67, votesApproved: ' + approved + ', consensusAchieved: true }</div>';
        terminal.innerHTML += '<div class="text-slate-400 text-[10px]">Execution completed in 18ms without memory leaks.</div>';
        speed.textContent = 'Last run: 18ms';
        terminal.scrollTop = terminal.scrollHeight;
      }, 350);
    });

    aiRefactorBtn.addEventListener('click', () => {
      aiRefactorBtn.innerHTML = '✨ <span>Refactoring...</span>';
      setTimeout(() => {
        editor.value = \`// [AI Auto-Optimized with Vectorized SIMD]
function computeDecentralizedConsensus(nodes: number) {
  const quorum = Math.ceil(nodes * 0.67);
  // Parallel batch verify with zero-knowledge proof
  const votes = new Uint8Array(nodes).map(() => Math.random() > 0.1 ? 1 : 0);
  const total = votes.reduce((a, b) => a + b, 0);
  return { quorum, total, passed: total >= quorum, latencyReduction: '42%' };
}
console.log("HIGH SPEED BATCH:", computeDecentralizedConsensus(100));\`;
        aiRefactorBtn.innerHTML = '✨ <span>Optimized!</span>';
        terminal.innerHTML += '<div class="text-indigo-400 font-bold">[AI Assistant] Applied vector batching & latency optimization. Click RUN.</div>';
        terminal.scrollTop = terminal.scrollHeight;
        setTimeout(() => { aiRefactorBtn.innerHTML = '✨ <span>AI Auto-Refactor</span>'; }, 2000);
      }, 500);
    });
  </script>
</body>
</html>`,
    trades: [
      {
        id: 't-1',
        pocId: 'poc-nexus-ide',
        type: 'buy',
        user: { address: '3Kx...82M', name: 'SolWhale', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
        solAmount: 4.5,
        tokenAmount: 24_320_000,
        tokenPrice: 0.000000185,
        timestamp: Date.now() - 1000 * 60 * 3,
        txHash: '5K2b918mQv8Yn1x9',
      },
      {
        id: 't-inj-1',
        pocId: 'poc-nexus-ide',
        type: 'injection',
        user: { address: 'Protoco1...Treasury', name: 'PromptPump Protocol Pool', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100' },
        solAmount: 10.0,
        tokenAmount: 0,
        tokenPrice: 0.000000184,
        timestamp: Date.now() - 1000 * 60 * 18,
        txHash: '4Xm91ZpRtL7Wq2',
      },
      {
        id: 't-2',
        pocId: 'poc-nexus-ide',
        type: 'sell',
        user: { address: '9Pa...11Q', name: 'DegenDev', avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100' },
        solAmount: 1.2,
        tokenAmount: 6_480_000,
        tokenPrice: 0.000000184,
        timestamp: Date.now() - 1000 * 60 * 35,
        txHash: '2Nq...38P89K',
      },
      {
        id: 't-3',
        pocId: 'poc-nexus-ide',
        type: 'buy',
        user: { address: '7Kj...44N', name: 'PromptGod', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
        solAmount: 2.8,
        tokenAmount: 15_120_000,
        tokenPrice: 0.000000181,
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
        txHash: '8Jk7...11Lq',
      },
    ],
    comments: [
      {
        id: 'c-1',
        pocId: 'poc-nexus-ide',
        user: { address: '3Kx...82M', name: 'SolWhale', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
        text: 'This PoC is literally 10x faster than StackBlitz. The prompter knows what they are doing. Apeing hard!',
        timestamp: Date.now() - 1000 * 60 * 15,
        likes: 18,
      },
      {
        id: 'c-2',
        pocId: 'poc-nexus-ide',
        user: { address: '8Vx...77Y', name: 'KryptoSage', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100' },
        text: 'Prompt suggestion for v1.3: Add instant WebContainer deployment to Cloudflare Workers!',
        timestamp: Date.now() - 1000 * 60 * 45,
        likes: 24,
        isPromptSuggestion: true,
      },
    ],
    openRouterFuel: {
      totalTokensRemaining: 3_450_000,
      totalTokensSponsored: 8_200_000,
      creditsUsd: 34.50,
      activeModel: 'anthropic/claude-3.7-sonnet',
      apiKeyConfigured: true,
      apiKeyMasked: 'sk-or-v1-••••••••••••••••3a9b',
      sponsorsCount: 38,
      totalPromptsExecuted: 42,
    },
    openRouterSponsorships: [
      {
        id: 'sp-1',
        pocId: 'poc-nexus-ide',
        pocTitle: 'NexusFlow Studio',
        pocTicker: '$NEXUS',
        creatorName: 'Elena Rostova',
        sponsorAddress: '8X9p3mKwA9F7y2bN6p4Kk1m8Zv9Ym2xLq5Q1n4W2e1Rt',
        sponsorName: 'DegenInvestor.sol',
        sponsorRole: 'investor',
        tierTitle: '🔥 Claude 3.7 Vibe Master',
        tokensAmount: 3_000_000,
        costUsd: 22.0,
        costSol: 0.133,
        targetModel: 'anthropic/claude-3.7-sonnet',
        message: 'Elena dale caña al compilador JIT WebAssembly! Aquí tienes fuel para baicodear!',
        timestamp: Date.now() - 1000 * 60 * 35,
        txHash: '5KqM...8Z2p',
      },
      {
        id: 'sp-2',
        pocId: 'poc-nexus-ide',
        pocTitle: 'NexusFlow Studio',
        pocTicker: '$NEXUS',
        creatorName: 'Elena Rostova',
        sponsorAddress: '3Kx82M...sol',
        sponsorName: 'SolWhale',
        sponsorRole: 'investor',
        tierTitle: '🚀 DeepSeek R1 Boost',
        tokensAmount: 1_000_000,
        costUsd: 8.0,
        costSol: 0.048,
        targetModel: 'deepseek/deepseek-r1',
        message: 'Añade la opción de multi-tab con WebWorkers en vivo!',
        timestamp: Date.now() - 1000 * 60 * 95,
        txHash: '4NpQ...1Y7x',
      },
    ],
  },
  {
    id: 'poc-swarm-mind',
    title: 'SwarmMind Arena',
    ticker: '$SWARM',
    tagline: 'Multi-agent adversarial consensus arena where 3 specialized LLMs debate before committing capital.',
    description: 'An autonomous multi-agent deliberation machine. Backers submit an investment or architectural thesis, and three adversarial AI agents—The Bull Analyst, The Risk Sentinel, and The System Architect—debate in real time until reaching mathematically weighted consensus.',
    category: 'Autonomous Agents',
    creator: {
      name: 'Dr. Marcus Vance',
      handle: '@vance_ai',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      address: '2VbK45LmxR8p1y3n7Q5k9Z2sW4tN1m6X8y2P4r7Ws9Tq',
      graduatedCount: 4,
      badges: ['prompt_engineer', 'top_developer', 'verified_creator'],
    },
    mintAddress: 'SWARMn7Q5k9Z2sW4tN1m6X8y2P4r7Ws9Tq7XqP3sKwA9F',
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    bondingCurveProgress: 71.2,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 60.52,
    tokensSold: 569_600_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000152,
    marketCapSol: 152.0,
    marketCapUsd: 152.0 * SOL_USD_RATE,
    volume24hSol: 198.2,
    priceChange24h: 184.2,
    isGraduated: false,
    holdersCount: 314,
    prompt: 'Build a multi-agent debate platform with 3 simulated AI agent personas, dynamic confidence gauges, consensus synthesis, and real-time argumentative chat streams.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Simulate 3 AI agents debating tokenomics with a weighted consensus bar.',
        timestamp: Date.now() - 1000 * 60 * 60 * 26,
        changelog: ['Three persona definitions (Bull, Sentinel, Architect)', 'Confidence metric synthesis', 'Real-time debate simulation stream'],
        author: '@vance_ai',
      },
    ],
    problemSolved: 'DAOs and automated treasuries suffer from blind spot hallucinations when relying on a single AI model. SwarmMind introduces tri-party adversarial verification.',
    features: [
      'Tri-agent consensus synthesis engine',
      'Bayesian probability weight aggregation',
      'Configurable risk tolerance and bias sliders',
      'Exportable cryptographically signed debate logs',
    ],
    techStack: ['Gemini 3.8 Flash', 'Bayesian Synthesis Engine', 'Tailwind CSS', 'Web Workers'],
    iterationIdeas: [
      'Prompt: Allow user to inject custom agent personality instructions',
      'Prompt: Add on-chain automated transaction trigger when consensus > 85%',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #080a10; color: #f8fafc; font-family: ui-sans-serif, system-ui; }
  </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
          🧠
        </div>
        <div>
          <h2 class="font-bold text-sm text-white">SwarmMind Adversarial Arena</h2>
          <p class="text-[10px] text-slate-400">Tri-Agent Real-time Consensus Engine</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400">Consensus:</span>
        <span id="consensusScore" class="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">79.4% APPROVED</span>
      </div>
    </div>

    <!-- Proposition Input -->
    <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl mb-4">
      <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Thesis under Debate</label>
      <div class="flex gap-2">
        <input id="thesisInput" type="text" value="Allocate 35% of treasury into Solana high-yield staking pool" class="flex-1 bg-slate-950 border border-slate-700 text-xs px-3 py-2 rounded-lg text-white focus:outline-none focus:border-indigo-500 font-mono" />
        <button id="debateBtn" class="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-lg shadow-indigo-950 flex items-center gap-1">
          <span>Trigger Debate</span> ⚡
        </button>
      </div>
    </div>

    <!-- 3 Agent Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
      <!-- Agent 1: Bull -->
      <div class="bg-slate-900/60 border border-emerald-500/30 p-3 rounded-xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <span>🟢</span> Bull Analyst
          </span>
          <span id="bullScore" class="text-[11px] font-mono text-emerald-300">92% Yes</span>
        </div>
        <div id="bullText" class="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 min-h-[70px]">
          "Staking yield compounds at 7.8% APY. Historical drawdowns are mitigated by liquid staking tokens."
        </div>
      </div>

      <!-- Agent 2: Risk Sentinel -->
      <div class="bg-slate-900/60 border border-rose-500/30 p-3 rounded-xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-rose-400 flex items-center gap-1.5">
            <span>🔴</span> Risk Sentinel
          </span>
          <span id="riskScore" class="text-[11px] font-mono text-rose-300">58% Caution</span>
        </div>
        <div id="riskText" class="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 min-h-[70px]">
          "Smart contract risk in validator slashing conditions requires capping allocation at 20% max."
        </div>
      </div>

      <!-- Agent 3: Architect -->
      <div class="bg-slate-900/60 border border-cyan-500/30 p-3 rounded-xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
            <span>🔵</span> Sys Architect
          </span>
          <span id="archScore" class="text-[11px] font-mono text-cyan-300">88% Aligned</span>
        </div>
        <div id="archText" class="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 min-h-[70px]">
          "Automated rebalancing script can bridge via multisig with 3-minute emergency stop circuit."
        </div>
      </div>
    </div>

    <!-- Consensus Progress Bar -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="text-slate-400">Bayesian Quorum Threshold</span>
        <span class="text-emerald-400 font-mono font-bold">75.0% Required</span>
      </div>
      <div class="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
        <div id="progressBar" class="bg-gradient-to-r from-indigo-500 via-emerald-400 to-cyan-400 h-2.5 rounded-full transition-all duration-700" style="width: 79.4%"></div>
      </div>
    </div>
  </div>

  <footer class="mt-4 pt-2 border-t border-slate-900 text-center text-[11px] text-slate-500">
    SwarmMind Proof-of-Concept • Real-time AI Consensus
  </footer>

  <script>
    const debateBtn = document.getElementById('debateBtn');
    const input = document.getElementById('thesisInput');
    const bullText = document.getElementById('bullText');
    const riskText = document.getElementById('riskText');
    const archText = document.getElementById('archText');
    const bullScore = document.getElementById('bullScore');
    const riskScore = document.getElementById('riskScore');
    const archScore = document.getElementById('archScore');
    const consensusScore = document.getElementById('consensusScore');
    const progressBar = document.getElementById('progressBar');

    debateBtn.addEventListener('click', () => {
      debateBtn.innerHTML = 'Debating... ⏳';
      const prompt = input.value || 'Decentralized compute dispatch';
      
      bullText.innerHTML = '<span class="text-slate-500 animate-pulse">Synthesizing bullish vectors...</span>';
      riskText.innerHTML = '<span class="text-slate-500 animate-pulse">Running threat analysis model...</span>';
      archText.innerHTML = '<span class="text-slate-500 animate-pulse">Validating execution pipeline...</span>';

      setTimeout(() => {
        const bVal = Math.floor(75 + Math.random() * 20);
        const rVal = Math.floor(45 + Math.random() * 30);
        const aVal = Math.floor(70 + Math.random() * 25);
        const avg = ((bVal * 0.4) + (rVal * 0.3) + (aVal * 0.3)).toFixed(1);

        bullScore.textContent = bVal + '% Yes';
        riskScore.textContent = rVal + '% Risk';
        archScore.textContent = aVal + '% Feasible';

        bullText.textContent = '"High upside on ' + prompt.slice(0, 30) + '... Liquidity depth supports instant deployment."';
        riskText.textContent = '"Simulated stress test shows 12% max drawdown under high volatility. Recommend hedging."';
        archText.textContent = '"Architecture supports parallelized state verification with zero-knowledge sharding."';

        consensusScore.textContent = avg + '% ' + (avg >= 75 ? 'APPROVED' : 'REJECTED');
        consensusScore.className = 'font-mono font-bold text-xs px-2 py-0.5 rounded ' + 
          (avg >= 75 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30');

        progressBar.style.width = avg + '%';
        debateBtn.innerHTML = '<span>Trigger Debate</span> ⚡';
      }, 700);
    });
  </script>
</body>
</html>`,
    trades: [
      {
        id: 't-3',
        pocId: 'poc-swarm-mind',
        type: 'buy',
        user: { address: '5Rm...91P', name: 'AlphaSeeker', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
        solAmount: 2.1,
        tokenAmount: 13_800_000,
        tokenPrice: 0.000000152,
        timestamp: Date.now() - 1000 * 60 * 8,
        txHash: '9Zq7...74B8',
      },
      {
        id: 't-inj-2',
        pocId: 'poc-swarm-mind',
        type: 'injection',
        user: { address: 'DAO...Treasury', name: 'PromptPump Protocol Pool', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100' },
        solAmount: 5.0,
        tokenAmount: 0,
        tokenPrice: 0.000000150,
        timestamp: Date.now() - 1000 * 60 * 42,
        txHash: '3Mn8...92Lq',
      },
      {
        id: 't-4',
        pocId: 'poc-swarm-mind',
        type: 'sell',
        user: { address: '2Lp...55M', name: 'CyberApe', avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100' },
        solAmount: 0.85,
        tokenAmount: 5_590_000,
        tokenPrice: 0.000000148,
        timestamp: Date.now() - 1000 * 60 * 60 * 3,
        txHash: '7Ty...99K8',
      },
    ],
    comments: [
      {
        id: 'c-3',
        pocId: 'poc-swarm-mind',
        user: { address: '5Rm...91P', name: 'AlphaSeeker', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
        text: 'The tri-agent architecture is crazy good. Sent 2.1 SOL, holding until graduation!',
        timestamp: Date.now() - 1000 * 60 * 10,
        likes: 9,
      },
    ],
    openRouterFuel: {
      totalTokensRemaining: 1_850_000,
      totalTokensSponsored: 4_500_000,
      creditsUsd: 18.50,
      activeModel: 'deepseek/deepseek-r1',
      apiKeyConfigured: true,
      apiKeyMasked: 'sk-or-v1-••••••••••••••••7c4e',
      sponsorsCount: 19,
      totalPromptsExecuted: 31,
    },
    openRouterSponsorships: [
      {
        id: 'sp-swarm-1',
        pocId: 'poc-swarm-mind',
        pocTitle: 'SwarmMind Arena',
        pocTicker: '$SWARM',
        creatorName: 'Dr. Marcus Vance',
        sponsorAddress: '5Rm...91P',
        sponsorName: 'AlphaSeeker',
        sponsorRole: 'investor',
        tierTitle: '🚀 DeepSeek R1 Boost',
        tokensAmount: 1_000_000,
        costUsd: 8.0,
        costSol: 0.048,
        targetModel: 'deepseek/deepseek-r1',
        message: 'Para el agente The Risk Sentinel, dale más tokens para stress test!',
        timestamp: Date.now() - 1000 * 60 * 12,
        txHash: '9Zq...74B',
      },
    ],
  },
  {
    id: 'poc-cyber-synth',
    title: 'CyberSynth WebAudio',
    ticker: '$SYNTH',
    tagline: 'Prompt-generated modular synthesizer & live step sequencer inside your browser.',
    description: 'An interactive WebAudio synthesizer born entirely from prompts. Backers can play real-time polyphonic synth notes, modify wave forms, twist resonant filter cutoffs, and watch the real-time canvas frequency visualizer pulse.',
    category: 'Creative AI',
    creator: {
      name: 'Kai Chen',
      handle: '@kaibeats',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
      address: '9QkM11WwxZ8v2m5K7nR3y6bL1tW4sQ9n2X5k8Y1m4P7r',
      badges: ['prompt_engineer', 'verified_creator'],
    },
    mintAddress: 'SYNTH5K7nR3y6bL1tW4sQ9n2X5k8Y1m4P7r2VbK45LmxR8',
    createdAt: Date.now() - 1000 * 60 * 60 * 32,
    bondingCurveProgress: 56.4,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 47.94,
    tokensSold: 451_200_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000122,
    marketCapSol: 122.0,
    marketCapUsd: 122.0 * SOL_USD_RATE,
    volume24hSol: 115.0,
    priceChange24h: 94.6,
    isGraduated: false,
    holdersCount: 205,
    prompt: 'Create a fully functional interactive WebAudio synthesizer with 8 playable piano keys, waveform switcher, low-pass filter slider, and live audio oscilloscope visualizer.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Build a WebAudio keyboard that plays real notes with an oscillator.',
        timestamp: Date.now() - 1000 * 60 * 60 * 32,
        changelog: ['Web Audio API Oscillator & Gain node setup', '8 piano key pads', 'Real-time oscilloscope canvas'],
        author: '@kaibeats',
      },
    ],
    problemSolved: 'DAWs are bloated, expensive, and non-collaborative. CyberSynth delivers instant prompt-to-instrument generation directly accessible on mobile and desktop web.',
    features: [
      'Low-latency WebAudio oscillator engine',
      'Configurable waveforms: Sine, Sawtooth, Triangle, Square',
      'Resonant low-pass biquad filter with cutoff controls',
      'Live 60 FPS Canvas Oscilloscope spectrum analyzer',
    ],
    techStack: ['Web Audio API', 'HTML5 Canvas', 'Tailwind CSS', 'Vectorized DSP'],
    iterationIdeas: [
      'Prompt: Add 16-step drum machine sequencer with kick, snare, hi-hat',
      'Prompt: Add MIDI keyboard hardware controller support',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #07080d; color: #f1f5f9; font-family: ui-sans-serif, system-ui; }
  </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <!-- Top Bar -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-3">
        <span class="text-xl">🎹</span>
        <div>
          <h2 class="font-bold text-sm text-white">CyberSynth WebAudio PoC</h2>
          <p class="text-[10px] text-slate-400">Click any key or use keyboard (A-K) to play real audio</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400">Wave:</span>
        <select id="waveSelect" class="bg-slate-900 border border-slate-700 text-xs px-2 py-1 rounded text-cyan-400 font-mono focus:outline-none">
          <option value="sawtooth">Sawtooth ⚡</option>
          <option value="sine">Sine 🌊</option>
          <option value="square">Square ⬛</option>
          <option value="triangle">Triangle 🔺</option>
        </select>
      </div>
    </div>

    <!-- Live Oscilloscope Canvas -->
    <div class="bg-black/90 border border-slate-800 rounded-xl p-3 mb-4 relative overflow-hidden">
      <div class="flex items-center justify-between text-[11px] text-slate-400 mb-2">
        <span>AUDIO SPECTRUM VISUALIZER</span>
        <span class="text-emerald-400 font-mono text-[10px]">● DSP ENGINE READY</span>
      </div>
      <canvas id="scopeCanvas" width="400" height="90" class="w-full h-24 bg-slate-950 rounded-lg border border-slate-900"></canvas>
    </div>

    <!-- Controls Row -->
    <div class="grid grid-cols-2 gap-3 mb-4">
      <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-slate-400">Filter Cutoff</span>
          <span id="filterVal" class="text-cyan-400 font-mono">1800 Hz</span>
        </div>
        <input id="filterSlider" type="range" min="200" max="6000" value="1800" class="w-full accent-cyan-400 cursor-pointer" />
      </div>

      <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="text-slate-400">Master Gain</span>
          <span id="volVal" class="text-emerald-400 font-mono">50%</span>
        </div>
        <input id="volSlider" type="range" min="0" max="100" value="50" class="w-full accent-emerald-400 cursor-pointer" />
      </div>
    </div>

    <!-- Playable Piano Keys -->
    <div class="grid grid-cols-8 gap-1.5">
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="261.63" data-name="C4">C4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="293.66" data-name="D4">D4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="329.63" data-name="E4">E4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="349.23" data-name="F4">F4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="392.00" data-name="G4">G4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="440.00" data-name="A4">A4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="493.88" data-name="B4">B4</button>
      <button class="key-btn bg-slate-800 hover:bg-cyan-500 hover:text-black text-white font-mono font-bold text-xs py-8 rounded-lg transition active:scale-95 shadow border border-slate-700" data-note="523.25" data-name="C5">C5</button>
    </div>
  </div>

  <footer class="mt-4 pt-2 border-t border-slate-900 text-center text-[11px] text-slate-500">
    CyberSynth Proof-of-Concept • Real-time Web Audio API
  </footer>

  <script>
    let audioCtx = null;
    let masterGain = null;
    let filterNode = null;
    let analyser = null;

    function initAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 1800;

        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.5;

        filterNode.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(audioCtx.destination);

        drawScope();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    const waveSelect = document.getElementById('waveSelect');
    const filterSlider = document.getElementById('filterSlider');
    const filterVal = document.getElementById('filterVal');
    const volSlider = document.getElementById('volSlider');
    const volVal = document.getElementById('volVal');
    const canvas = document.getElementById('scopeCanvas');
    const ctx = canvas.getContext('2d');

    filterSlider.addEventListener('input', (e) => {
      filterVal.textContent = e.target.value + ' Hz';
      if (filterNode) filterNode.frequency.value = e.target.value;
    });

    volSlider.addEventListener('input', (e) => {
      volVal.textContent = e.target.value + '%';
      if (masterGain) masterGain.gain.value = e.target.value / 100;
    });

    function playTone(freq) {
      initAudio();
      const osc = audioCtx.createOscillator();
      const noteGain = audioCtx.createGain();

      osc.type = waveSelect.value;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      noteGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6);

      osc.connect(noteGain);
      noteGain.connect(filterNode);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    }

    document.querySelectorAll('.key-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const freq = parseFloat(btn.getAttribute('data-note'));
        playTone(freq);
      });
    });

    function drawScope() {
      requestAnimationFrame(drawScope);
      if (!analyser) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#07080d';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#06b6d4';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (canvas.height / 2);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
  </script>
</body>
</html>`,
    trades: [],
    comments: [],
  },
  {
    id: 'poc-pump-oracle',
    title: 'PumpOracle AI',
    ticker: '$ORACLE',
    tagline: 'Real-time on-chain sentiment intelligence predicting memecoin bonding curve velocity.',
    description: 'An AI-powered on-chain intelligence oracle scanning social momentum, dev wallet transfers, and bonding curve liquidity depth to output a dynamic Fear/Greed and Velocity Heatmap.',
    category: 'DeFi & Trading',
    creator: {
      name: 'NakamotoX',
      handle: '@nakamotox',
      avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
      address: '4Wz89KpxN1y3bL7vQ5m2Z8xR9sT1n4Q6k8Y2m3P5r7Ws',
      badges: ['high_vol_creator', 'og_builder', 'verified_creator'],
    },
    mintAddress: 'ORACLEvQ5m2Z8xR9sT1n4Q6k8Y2m3P5r7Ws9QkM11WwxZ8',
    createdAt: Date.now() - 1000 * 60 * 60 * 40,
    bondingCurveProgress: 42.0,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 35.7,
    tokensSold: 336_000_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000095,
    marketCapSol: 95.0,
    marketCapUsd: 95.0 * SOL_USD_RATE,
    volume24hSol: 82.4,
    priceChange24h: 46.2,
    isGraduated: false,
    holdersCount: 162,
    prompt: 'Build a crypto market intelligence heatmap with real-time velocity metrics, fear & greed dial, and live ticker alerts.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Create a live crypto sentiment heatmap with fear and greed gauges.',
        timestamp: Date.now() - 1000 * 60 * 60 * 40,
        changelog: ['On-chain sentiment simulation', 'Heatmap tiles with volatility colors', 'Fear & Greed meter'],
        author: '@nakamotox',
      },
    ],
    problemSolved: 'Traders get rugged by bad dev wallet transfers and fake social volume. PumpOracle tracks organic liquidity acceleration.',
    features: [
      'Multi-source sentiment aggregation',
      'Dev wallet rug-detection algorithmic score',
      'Real-time velocity alerts',
      'Pump.fun bonding curve graduation predictor',
    ],
    techStack: ['RPC Stream Indexer', 'Gemini Sentiment Scorer', 'Tailwind CSS'],
    iterationIdeas: [
      'Prompt: Integrate Telegram bot webhook notification simulator',
      'Prompt: Add automated stop-loss limit order mock execution',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style> body { background: #08090e; color: #f8fafc; font-family: ui-sans-serif, system-ui; } </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-2">
        <span class="text-xl">🔮</span>
        <div>
          <h2 class="font-bold text-sm text-white">PumpOracle Intelligence</h2>
          <p class="text-[10px] text-slate-400">Live Memecoin Velocity & Sentiment Index</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span class="text-xs font-mono text-emerald-400">STREAM ACTIVE</span>
      </div>
    </div>

    <!-- Fear & Greed + Top Stats -->
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
        <span class="text-[10px] text-slate-400 uppercase block">Fear & Greed Index</span>
        <span class="text-xl font-bold font-mono text-emerald-400">76</span>
        <span class="text-[10px] text-emerald-300 block">Extreme Greed 🔥</span>
      </div>
      <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
        <span class="text-[10px] text-slate-400 uppercase block">Graduation Velocity</span>
        <span class="text-xl font-bold font-mono text-cyan-400">14.2% / hr</span>
        <span class="text-[10px] text-slate-400 block">Avg to 85 SOL</span>
      </div>
      <div class="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
        <span class="text-[10px] text-slate-400 uppercase block">Rug Risk Flagged</span>
        <span class="text-xl font-bold font-mono text-rose-400">0.4%</span>
        <span class="text-[10px] text-slate-400 block">Low Probability</span>
      </div>
    </div>

    <!-- Heatmap Grid -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
      <div class="text-[11px] text-slate-400 uppercase font-semibold mb-2">Market Velocity Heatmap</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div class="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
          <div class="font-bold">$NEXUS</div>
          <div class="text-[10px] text-emerald-400">+312% • 88% Curve</div>
        </div>
        <div class="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
          <div class="font-bold">$SWARM</div>
          <div class="text-[10px] text-emerald-400">+184% • 71% Curve</div>
        </div>
        <div class="p-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300">
          <div class="font-bold">$SYNTH</div>
          <div class="text-[10px] text-cyan-400">+94% • 56% Curve</div>
        </div>
        <div class="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
          <div class="font-bold">$ORACLE</div>
          <div class="text-[10px] text-indigo-400">+46% • 42% Curve</div>
        </div>
      </div>
    </div>
  </div>
  <footer class="mt-4 pt-2 border-t border-slate-900 text-center text-[11px] text-slate-500">
    PumpOracle Proof-of-Concept • Dynamic Sentiment Pipeline
  </footer>
</body>
</html>`,
    trades: [],
    comments: [],
  },
  {
    id: 'poc-pixel-quest',
    title: 'PromptQuest 2D',
    ticker: '$QUEST',
    tagline: 'Procedurally generated rogue dungeon crawler created and expanded through player prompts.',
    description: 'A working retro pixel dungeon mini-game generated entirely from prompt logic. Move your hero `@`, navigate procedural stone rooms, fight slimes `s`, pick up mana potions `!`, and level up in real time.',
    category: 'Cyberpunk & Gaming',
    creator: {
      name: 'PixelWizard',
      handle: '@pixelwiz',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      address: '6JxL33PpxR7v2n4L8mQ1y3bZ6sT8wN2xP5k9Y1m4R7sT',
      badges: ['prompt_engineer', 'og_builder', 'verified_creator'],
    },
    mintAddress: 'QUEST4L8mQ1y3bZ6sT8wN2xP5k9Y1m4R7sT4Wz89KpxN1y',
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    bondingCurveProgress: 33.8,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 28.73,
    tokensSold: 270_400_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000078,
    marketCapSol: 78.0,
    marketCapUsd: 78.0 * SOL_USD_RATE,
    volume24hSol: 54.0,
    priceChange24h: 31.8,
    isGraduated: false,
    holdersCount: 118,
    prompt: 'Create a playable 2D ASCII/tile dungeon crawler mini-game with arrow button controls, health bar, gold tracker, and combat messages.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Build a playable dungeon grid with player @, items, and slime monsters.',
        timestamp: Date.now() - 1000 * 60 * 60 * 48,
        changelog: ['Tile map rendering', 'Movement logic with collision detection', 'HP & Gold inventory state'],
        author: '@pixelwiz',
      },
    ],
    problemSolved: 'Web3 games spend $20M and 3 years on engines that never launch. PromptQuest proves game mechanics can be verified live on bonding curves in minutes.',
    features: [
      'Zero-download lightweight 2D canvas/grid engine',
      'Procedural enemy and treasure placement',
      'Turn-based tactical combat simulator',
      'Extensible prompt-based quest updates',
    ],
    techStack: ['HTML5 Canvas & DOM', 'Procedural Dungeon Algorithm', 'Tailwind CSS'],
    iterationIdeas: [
      'Prompt: Add boss monster Dragon with fire attack animations',
      'Prompt: Implement on-chain loot NFT minting simulator',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style> body { background: #06070a; color: #f8fafc; font-family: ui-monospace, monospace; } </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <div class="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
      <div class="flex items-center gap-2">
        <span class="text-emerald-400 font-bold text-base">⚔️ PromptQuest</span>
        <span class="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">Level 1 Dungeon</span>
      </div>
      <div class="text-xs font-mono text-slate-300 flex items-center gap-3">
        <span>HP: <strong id="hpVal" class="text-rose-400">100/100</strong></span>
        <span>Gold: <strong id="goldVal" class="text-amber-400">0</strong></span>
      </div>
    </div>

    <!-- Dungeon View -->
    <div class="bg-black border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center mb-3">
      <div id="gridContainer" class="grid grid-cols-10 gap-1 text-center font-mono font-bold text-sm">
        <!-- Rendered by JS -->
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center justify-between gap-4">
      <div class="text-[11px] text-slate-400 font-mono" id="logMsg">
        Use on-screen DPAD or arrow keys to move hero (@).
      </div>
      <div class="grid grid-cols-3 gap-1 w-28">
        <div></div>
        <button id="upBtn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2 rounded text-xs">▲</button>
        <div></div>
        <button id="leftBtn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2 rounded text-xs">◀</button>
        <button id="downBtn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2 rounded text-xs">▼</button>
        <button id="rightBtn" class="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2 rounded text-xs">▶</button>
      </div>
    </div>
  </div>

  <footer class="mt-4 pt-2 border-t border-slate-900 text-center text-[11px] text-slate-500">
    PromptQuest Proof-of-Concept • Procedural Dungeon Engine
  </footer>

  <script>
    const W = 10, H = 6;
    let px = 1, py = 1;
    let hp = 100, gold = 0;
    const items = [{x: 4, y: 2, type: 'gold'}, {x: 8, y: 4, type: 'gold'}, {x: 6, y: 1, type: 'pot'}];
    const enemies = [{x: 5, y: 3, hp: 20}];

    const grid = document.getElementById('gridContainer');
    const hpVal = document.getElementById('hpVal');
    const goldVal = document.getElementById('goldVal');
    const log = document.getElementById('logMsg');

    function render() {
      grid.innerHTML = '';
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cell = document.createElement('div');
          cell.className = 'w-7 h-7 flex items-center justify-center rounded bg-slate-900/60 border border-slate-800/80';
          
          if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
            cell.textContent = '#';
            cell.className += ' text-slate-700';
          } else if (x === px && y === py) {
            cell.textContent = '@';
            cell.className += ' bg-emerald-500/20 text-emerald-400 font-extrabold border-emerald-500/40';
          } else {
            const it = items.find(i => i.x === x && i.y === y);
            const en = enemies.find(e => e.x === x && e.y === y);
            if (en) {
              cell.textContent = 's';
              cell.className += ' text-rose-400 animate-pulse';
            } else if (it) {
              cell.textContent = it.type === 'gold' ? '$' : '+';
              cell.className += it.type === 'gold' ? ' text-amber-300' : ' text-cyan-300';
            } else {
              cell.textContent = '.';
              cell.className += ' text-slate-800';
            }
          }
          grid.appendChild(cell);
        }
      }
    }

    function move(dx, dy) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx <= 0 || nx >= W - 1 || ny <= 0 || ny >= H - 1) return;

      const enIndex = enemies.findIndex(e => e.x === nx && e.y === ny);
      if (enIndex !== -1) {
        enemies[enIndex].hp -= 15;
        hp -= 10;
        hpVal.textContent = Math.max(0, hp) + '/100';
        if (enemies[enIndex].hp <= 0) {
          enemies.splice(enIndex, 1);
          gold += 25;
          goldVal.textContent = gold;
          log.textContent = '⚔️ Defeated slime! +25 Gold';
        } else {
          log.textContent = '⚔️ Struck slime for 15 dmg, took 10 counter dmg!';
        }
        render();
        return;
      }

      px = nx;
      py = ny;

      const itIndex = items.findIndex(i => i.x === px && i.y === py);
      if (itIndex !== -1) {
        const item = items.splice(itIndex, 1)[0];
        if (item.type === 'gold') {
          gold += 15;
          goldVal.textContent = gold;
          log.textContent = '💰 Found a pouch of 15 Gold!';
        } else {
          hp = Math.min(100, hp + 20);
          hpVal.textContent = hp + '/100';
          log.textContent = '🧪 Drank potion! Restored 20 HP.';
        }
      }

      render();
    }

    document.getElementById('upBtn').onclick = () => move(0, -1);
    document.getElementById('downBtn').onclick = () => move(0, 1);
    document.getElementById('leftBtn').onclick = () => move(-1, 0);
    document.getElementById('rightBtn').onclick = () => move(1, 0);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') move(0, -1);
      if (e.key === 'ArrowDown') move(0, 1);
      if (e.key === 'ArrowLeft') move(-1, 0);
      if (e.key === 'ArrowRight') move(1, 0);
    });

    render();
  </script>
</body>
</html>`,
    trades: [],
    comments: [],
  },
  {
    id: 'poc-legal-forge',
    title: 'LegalForge ZK',
    ticker: '$DOCU',
    tagline: 'Zero-knowledge plain-language legal contract decompiler and risk auditor.',
    description: 'An AI-powered smart legal auditor that translates dense smart contract code or token agreements into readable plain Spanish / English clauses with automated risk scoring.',
    category: 'Micro-SaaS',
    creator: {
      name: 'Sofia Martinez',
      handle: '@sofia_legal',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      address: '8Mm91XxK7v2n4L8mQ1y3bZ6sT8wN2xP5k9Y1m4R7sTvW',
      badges: ['top_developer', 'verified_creator'],
    },
    mintAddress: 'DOCUmQ1y3bZ6sT8wN2xP5k9Y1m4R7sTvW6JxL33PpxR7v',
    createdAt: Date.now() - 1000 * 60 * 60 * 60,
    bondingCurveProgress: 19.5,
    targetMarketCapSol: TARGET_SOL,
    currentSolPooled: 16.57,
    tokensSold: 156_000_000,
    totalSupply: 1_000_000_000,
    tokenPriceSol: 0.000000055,
    marketCapSol: 55.0,
    marketCapUsd: 55.0 * SOL_USD_RATE,
    volume24hSol: 22.0,
    priceChange24h: 14.5,
    isGraduated: false,
    holdersCount: 84,
    prompt: 'Build a smart contract decompiler tool that visually highlights hidden mint permissions, liquidation fees, and generates a risk summary score.',
    promptHistory: [
      {
        version: 'v1.0',
        prompt: 'Build a contract risk inspection tool with clause toggle and score.',
        timestamp: Date.now() - 1000 * 60 * 60 * 60,
        changelog: ['Clause scanner', 'Risk score calculation gauge', 'Plain text explanation tabs'],
        author: '@sofia_legal',
      },
    ],
    problemSolved: 'Non-technical investors sign malicious token contracts and approve unlimited drainer permissions.',
    features: [
      'AST-based permissions risk scanner',
      'Automated reentrancy and owner-privilege detection',
      'Plain English and Spanish summaries',
      'Zero-knowledge compliance attestation',
    ],
    techStack: ['AST Parser', 'Gemini 3.8 Flash', 'Tailwind CSS'],
    iterationIdeas: [
      'Prompt: Add 1-click wallet approval revoker simulation',
    ],
    runnableHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style> body { background: #080a11; color: #f8fafc; font-family: ui-sans-serif, system-ui; } </style>
</head>
<body class="p-4 select-none min-h-screen flex flex-col justify-between">
  <div>
    <div class="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
      <div class="flex items-center gap-2">
        <span class="text-xl">📜</span>
        <div>
          <h2 class="font-bold text-sm text-white">LegalForge ZK Auditor</h2>
          <p class="text-[10px] text-slate-400">Plain-Language Smart Contract Risk Scanner</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
        Audit Score: 94/100
      </div>
    </div>

    <!-- Contract Clause Checker -->
    <div class="space-y-2 mb-4">
      <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-white">Owner Mint Privileges</div>
          <div class="text-[11px] text-slate-400">Can the developer mint new tokens after launch?</div>
        </div>
        <span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded font-bold">REVOKED (SAFE)</span>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-white">Liquidity Lock Term</div>
          <div class="text-[11px] text-slate-400">Bonding curve automated migration to Raydium</div>
        </div>
        <span class="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded font-bold">IMMUTABLE (SAFE)</span>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold text-white">Trading Tax & Slippage Cap</div>
          <div class="text-[11px] text-slate-400">Maximum buy/sell transaction fee limit</div>
        </div>
        <span class="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-1 rounded font-bold">0% TAX</span>
      </div>
    </div>
  </div>
  <footer class="mt-4 pt-2 border-t border-slate-900 text-center text-[11px] text-slate-500">
    LegalForge Proof-of-Concept • Automated ZK Inspection
  </footer>
</body>
</html>`,
    trades: [],
    comments: [],
  },
];
