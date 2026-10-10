/**
 * Grant & Internship AI Scout - Web Dashboard Logic
 * Powered by Supabase JavaScript Client v2
 */

// ==========================================
// 1. Supabase Configuration Placeholders
// Replace these values with your Supabase Project details
// ==========================================
let SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
let SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Check if user set local overrides via Config Modal
if (localStorage.getItem("SCOUT_SUPABASE_URL")) {
    SUPABASE_URL = localStorage.getItem("SCOUT_SUPABASE_URL");
}
if (localStorage.getItem("SCOUT_SUPABASE_ANON_KEY")) {
    SUPABASE_ANON_KEY = localStorage.getItem("SCOUT_SUPABASE_ANON_KEY");
}

// Global State
let opportunitiesData = [];
let selectedTag = "All";
let searchQuery = "";

// Sample / Mock Dataset for Fallback & Immediate Visual Demonstration
const DEMO_OPPORTUNITIES = [
    {
        id: "demo-1",
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        title: "Software Engineering Intern 2025/2026",
        company: "Google Cloud",
        description: "Join Google Cloud engineering to build scalable distributed systems, developer tools, and next-gen infrastructure APIs. open for CS & CE undergraduates.",
        link: "https://careers.google.com/jobs/results/",
        tags: ["Software", "Python", "Cloud", "C++"],
        deadline: "Nov 30, 2025"
    },
    {
        id: "demo-2",
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        title: "Hardware & Circuit Systems Innovation Grant",
        company: "IEEE Circuits and Systems Society",
        description: "Student grant supporting undergraduate research projects in microelectronics, FPGA prototyping, PCB design, and IoT embedded hardware applications.",
        link: "https://ieee-cas.org/",
        tags: ["Electronics", "Hardware", "Grant", "Embedded"],
        deadline: "Dec 15, 2025"
    },
    {
        id: "demo-3",
        created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        title: "Open Source AI Fellowships 2026",
        company: "Hugging Face & Linux Foundation",
        description: "A 6-month paid fellowship program for open-source AI developers building transformers, fine-tuning infrastructure, and computer vision models.",
        link: "https://huggingface.co/",
        tags: ["Software", "AI", "Fellowship", "Python"],
        deadline: "Jan 10, 2026"
    },
    {
        id: "demo-4",
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        title: "Frontend Engineering Intern (React & Next.js)",
        company: "Vercel",
        description: "Work on Next.js core framework, edge rendering engines, and developer dashboard UI components. Remote opportunity for tech students.",
        link: "https://vercel.com/careers",
        tags: ["Software", "React", "TypeScript"],
        deadline: "Rolling Admission"
    },
    {
        id: "demo-5",
        created_at: new Date(Date.now() - 3600000 * 36).toISOString(),
        title: "Robotics & Embedded Firmware Research Grant",
        company: "NVIDIA Robotics Lab",
        description: "Research sponsorship for university students developing Jetson Orin micro-controller firmware, ROS2 drivers, and autonomous navigation.",
        link: "https://developer.nvidia.com/academic-grants",
        tags: ["Electronics", "Hardware", "Grant", "AI"],
        deadline: "Dec 01, 2025"
    },
    {
        id: "demo-6",
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        title: "Full Stack Developer Fellowship",
        company: "Major League Hacking (MLH)",
        description: "12-week fellowship program where students contribute to real open-source software repositories mentored by production software engineers.",
        link: "https://fellowship.mlh.io/",
        tags: ["Software", "Fellowship", "React", "Python"],
        deadline: "TBD"
    }
];

// Initialize Dashboard on Load
document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    setupEventListeners();
});

/**
 * Main initialization logic: Attempts to fetch from Supabase, falls back to demo data if unconfigured.
 */
async function initDashboard() {
    showLoading(true);
    
    // Check if valid Supabase credentials provided
    const isConfigured = SUPABASE_URL && 
                         SUPABASE_ANON_KEY && 
                         !SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_URL") &&
                         !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");

    if (!isConfigured) {
        console.warn("[Scout] Supabase credentials not set. Rendering demo dataset for preview.");
        updateConnectionBadge("Demo Dataset (Configure Supabase in Config)", "demo");
        opportunitiesData = DEMO_OPPORTUNITIES;
        renderDashboard();
        showLoading(false);
        return;
    }

    try {
        const { createClient } = window.supabase;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // Fetch records ordered by created_at DESC
        const { data, error } = await supabase
            .from('opportunities')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            opportunitiesData = data;
            updateConnectionBadge("Live Supabase Sync", "connected");
        } else {
            console.log("[Scout] Supabase returned 0 items. Falling back to demo data for demonstration.");
            opportunitiesData = DEMO_OPPORTUNITIES;
            updateConnectionBadge("Live DB Empty (Demo View)", "demo");
        }

        renderDashboard();
    } catch (err) {
        console.error("[Scout] Supabase Fetch Error:", err);
        showError("Failed to fetch opportunities from Supabase: " + (err.message || err));
        // Fallback to demo data
        opportunitiesData = DEMO_OPPORTUNITIES;
        renderDashboard();
    } finally {
        showLoading(false);
    }
}

/**
 * Setup Search & Filter Listeners
 */
function setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            const clearBtn = document.getElementById("clearSearchBtn");
            if (clearBtn) {
                clearBtn.classList.toggle("hidden", searchQuery === "");
            }
            filterAndRender();
        });
    }

    // Populate Config Modal inputs if stored
    const cfgUrl = document.getElementById("cfgUrl");
    const cfgKey = document.getElementById("cfgKey");
    if (cfgUrl && localStorage.getItem("SCOUT_SUPABASE_URL")) cfgUrl.value = localStorage.getItem("SCOUT_SUPABASE_URL");
    if (cfgKey && localStorage.getItem("SCOUT_SUPABASE_ANON_KEY")) cfgKey.value = localStorage.getItem("SCOUT_SUPABASE_ANON_KEY");
}

/**
 * Extract all unique tags and populate tag filter pill buttons
 */
function renderTagFilters() {
    const tagContainer = document.getElementById("tagFilters");
    if (!tagContainer) return;

    // Collect all unique tags
    const allTagsSet = new Set(["All", "Software", "Electronics", "Hardware", "Grant", "Fellowship"]);
    opportunitiesData.forEach(item => {
        if (Array.isArray(item.tags)) {
            item.tags.forEach(t => allTagsSet.add(t));
        }
    });

    const tagsList = Array.from(allTagsSet);

    tagContainer.innerHTML = tagsList.map(tag => {
        const isActive = tag === selectedTag;
        const activeClass = isActive 
            ? "bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-600/30 font-semibold" 
            : "bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white";

        return `
            <button 
                onclick="selectTag('${tag}')"
                class="px-4 py-2 rounded-xl border text-xs whitespace-nowrap transition-all duration-200 flex items-center space-x-1.5 ${activeClass}">
                <span>${tag === 'All' ? '✨ All' : tag}</span>
            </button>
        `;
    }).join("");
}

/**
 * Filter opportunities based on search query & selected tag
 */
function filterAndRender() {
    const filtered = opportunitiesData.filter(item => {
        const matchesTag = selectedTag === "All" || (Array.isArray(item.tags) && item.tags.includes(selectedTag));
        const matchesSearch = !searchQuery || 
            item.title.toLowerCase().includes(searchQuery) ||
            item.company.toLowerCase().includes(searchQuery) ||
            (item.description && item.description.toLowerCase().includes(searchQuery));
        
        return matchesTag && matchesSearch;
    });

    renderCards(filtered);
    updateMetrics(filtered);
}

/**
 * Render Opportunity Cards
 */
function renderCards(items) {
    const grid = document.getElementById("opportunitiesGrid");
    const emptyState = document.getElementById("emptyState");

    if (!grid || !emptyState) return;

    if (items.length === 0) {
        grid.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    grid.classList.remove("hidden");

    grid.innerHTML = items.map(item => {
        const companyInitial = item.company ? item.company.charAt(0).toUpperCase() : "O";
        const tags = Array.isArray(item.tags) ? item.tags : [];
        const formattedDate = formatDate(item.created_at);

        const tagsHtml = tags.map(tag => {
            let colorStyle = "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
            if (tag.toLowerCase() === "grant") colorStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            if (tag.toLowerCase() === "electronics" || tag.toLowerCase() === "hardware") colorStyle = "bg-purple-500/10 text-purple-400 border-purple-500/20";
            if (tag.toLowerCase() === "fellowship") colorStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";

            return `<span class="px-2.5 py-1 rounded-lg text-[11px] font-medium border ${colorStyle}">${tag}</span>`;
        }).join("");

        return `
            <div class="glass-card p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 transform hover:-translate-y-1">
                <div>
                    <!-- Card Top Header -->
                    <div class="flex items-start justify-between gap-3 mb-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-display font-bold text-white text-lg shadow-inner">
                                ${companyInitial}
                            </div>
                            <div>
                                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${escapeHtml(item.company)}</h4>
                                <span class="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <i class="fa-regular fa-clock text-[10px]"></i> Scraped ${formattedDate}
                                </span>
                            </div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                            ${escapeHtml(item.deadline || 'TBD')}
                        </span>
                    </div>

                    <!-- Job Title & Description -->
                    <h3 class="text-lg font-display font-bold text-white mb-2 line-clamp-2 leading-snug hover:text-brand-400 transition-colors">
                        ${escapeHtml(item.title)}
                    </h3>
                    <p class="text-slate-400 text-xs sm:text-sm line-clamp-3 mb-4 leading-relaxed">
                        ${escapeHtml(item.description || 'No description provided.')}
                    </p>
                </div>

                <!-- Card Bottom Footer (Tags + Link Button) -->
                <div class="pt-4 border-t border-slate-800/80">
                    <div class="flex flex-wrap gap-1.5 mb-4">
                        ${tagsHtml}
                    </div>
                    <a 
                        href="${escapeHtml(item.link || '#')}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-colors flex items-center justify-center space-x-2 group shadow-lg shadow-brand-600/20"
                    >
                        <span>Apply Now</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"></i>
                    </a>
                </div>
            </div>
        `;
    }).join("");
}

/**
 * Update Stats Numbers
 */
function updateMetrics(items) {
    const statTotal = document.getElementById("statTotal");
    const statSoftware = document.getElementById("statSoftware");
    const statHardware = document.getElementById("statHardware");
    const statGrants = document.getElementById("statGrants");

    if (statTotal) statTotal.textContent = items.length;

    const countSoftware = items.filter(i => Array.isArray(i.tags) && i.tags.some(t => t.toLowerCase().includes("software") || t.toLowerCase().includes("react") || t.toLowerCase().includes("python"))).length;
    const countHardware = items.filter(i => Array.isArray(i.tags) && i.tags.some(t => t.toLowerCase().includes("hardware") || t.toLowerCase().includes("electronics") || t.toLowerCase().includes("embedded"))).length;
    const countGrants = items.filter(i => Array.isArray(i.tags) && i.tags.some(t => t.toLowerCase().includes("grant") || t.toLowerCase().includes("fellowship"))).length;

    if (statSoftware) statSoftware.textContent = countSoftware;
    if (statHardware) statHardware.textContent = countHardware;
    if (statGrants) statGrants.textContent = countGrants;
}

/**
 * Master Render
 */
function renderDashboard() {
    renderTagFilters();
    filterAndRender();
}

/**
 * UI State Helpers
 */
function selectTag(tag) {
    selectedTag = tag;
    renderDashboard();
}

function clearSearch() {
    searchQuery = "";
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";
    const clearBtn = document.getElementById("clearSearchBtn");
    if (clearBtn) clearBtn.classList.add("hidden");
    filterAndRender();
}

function resetFilters() {
    selectedTag = "All";
    clearSearch();
}

function showLoading(isLoading) {
    const skeleton = document.getElementById("loadingSkeleton");
    const grid = document.getElementById("opportunitiesGrid");
    if (skeleton && grid) {
        if (isLoading) {
            skeleton.classList.remove("hidden");
            grid.classList.add("hidden");
        } else {
            skeleton.classList.add("hidden");
        }
    }
}

function showError(msg) {
    const alert = document.getElementById("errorAlert");
    const msgEl = document.getElementById("errorMessage");
    if (alert && msgEl) {
        msgEl.textContent = msg;
        alert.classList.remove("hidden");
    }
}

function updateConnectionBadge(text, type) {
    const badge = document.getElementById("connectionStatus");
    const badgeText = document.getElementById("connectionText");
    if (!badge || !badgeText) return;

    badgeText.textContent = text;
    badge.classList.remove("hidden");

    if (type === "connected") {
        badge.className = "hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    } else if (type === "demo") {
        badge.className = "hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20";
    }
}

function formatDate(isoStr) {
    if (!isoStr) return "recently";
    try {
        const d = new Date(isoStr);
        const now = new Date();
        const diffHours = Math.floor((now - d) / (1000 * 60 * 60));
        if (diffHours < 1) return "just now";
        if (diffHours < 24) return `${diffHours}h ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
        return "recently";
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* Config Modal Functions */
function toggleConfigModal() {
    const modal = document.getElementById("configModal");
    if (modal) modal.classList.toggle("hidden");
}

function saveCustomConfig() {
    const url = document.getElementById("cfgUrl").value.trim();
    const key = document.getElementById("cfgKey").value.trim();

    if (url) localStorage.setItem("SCOUT_SUPABASE_URL", url);
    if (key) localStorage.setItem("SCOUT_SUPABASE_ANON_KEY", key);

    toggleConfigModal();
    window.location.reload();
}

function resetCustomConfig() {
    localStorage.removeItem("SCOUT_SUPABASE_URL");
    localStorage.removeItem("SCOUT_SUPABASE_ANON_KEY");
    toggleConfigModal();
    window.location.reload();
}
