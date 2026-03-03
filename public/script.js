// ============================================================
// NAVBAR & MOBILE MENU
// ============================================================
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.querySelector('.nav-links');

const heroSection = document.getElementById('hero');

// Scroll event listener for navbar
window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
        navbar.style.display = 'none';
    } else {
        navbar.style.display = ''; // Reset to default when at top
    }
});

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        navToggle.textContent = navLinks.classList.contains('active') ? '✕' : '☰';
    });

    // Close menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            navToggle.textContent = '☰';
        });
    });
}

// ============================================================
// LIVE ENGINE STATUS CHECK
// ============================================================
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const statusHint = document.getElementById('status-hint');
const engineStatus = document.getElementById('engine-status');
let apiOnline = false;

async function checkHealth() {
    try {
        const res = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const data = await res.json();
            apiOnline = true;
            statusDot.className = 'status-dot online';
            statusLabel.textContent = '✅ Quantum Engine Online';
            statusHint.innerHTML = `${data.engine} · Ready`;
            engineStatus.className = 'engine-status online';
        } else { throw new Error(); }
    } catch {
        apiOnline = false;
        statusDot.className = 'status-dot offline';
        statusLabel.textContent = '⚠️ Engine Offline';
        statusHint.innerHTML = 'Run <code>python api.py</code>';
        engineStatus.className = 'engine-status offline';
    }
}

// Check immediately, then every 3 seconds
checkHealth();
setInterval(checkHealth, 3000);

// ============================================================
// UNIT CARD TOGGLE (click to select/deselect)
// ============================================================
document.querySelectorAll('.unit-card').forEach(card => {
    card.addEventListener('click', (e) => {
        // Don't toggle if clicking the select/input inside
        if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
        card.classList.toggle('selected');
        // Update visual style on status selects based on selected state
        updateCardOpacity(card);
    });
});

function updateCardOpacity(card) {
    const isSelected = card.classList.contains('selected');
    card.style.opacity = isSelected ? '1' : '0.4';
}

// ============================================================
// SLIDERS
// ============================================================
const trafficInput = document.getElementById('traffic');
const trafficVal = document.getElementById('traffic-val');
trafficInput.addEventListener('input', (e) => trafficVal.textContent = parseFloat(e.target.value).toFixed(1));

// ============================================================
// STATE READERS
// ============================================================
function getSelectedAmbulances() {
    const selected = [];
    document.querySelectorAll('.amb-card.selected').forEach(c => selected.push(c.dataset.id));
    return selected;
}

function getSelectedPatients() {
    const selected = [];
    document.querySelectorAll('.pat-card.selected').forEach(c => selected.push(c.dataset.id));
    return selected;
}

function getAvailability() {
    const map = {};
    document.querySelectorAll('.status-select').forEach(sel => {
        map[sel.dataset.unit] = sel.value;
    });
    return map;
}

function getSeverity() {
    const map = {};
    document.querySelectorAll('.sev-input').forEach(inp => {
        map[inp.dataset.patient] = parseInt(inp.value) || 3;
    });
    return map;
}

// ============================================================
// CHART & GRAPH INSTANCES
// ============================================================
let timeChartInstance = null;
let scalabilityChartInstance = null;

// ============================================================
// COLOR HELPERS
// ============================================================
function gradientColor(value, min, max) {
    const norm = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
    return `hsl(${(1 - norm) * 120}, 75%, 48%)`;
}

// ============================================================
// DRAW DISPATCH GRAPH (Canvas)
// ============================================================
function drawGraph(costMatrix, quantumAssign, classicalAssign) {
    const canvas = document.getElementById('graphCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ambulances = Object.keys(costMatrix);
    const patients = ambulances.length > 0 ? Object.keys(costMatrix[ambulances[0]]) : [];

    // Dynamic positions
    const positions = {};
    const leftX = 60, rightX = 440;
    const buildYs = (list, totalH) => list.map((_, i) => 30 + (i * ((totalH - 60) / Math.max(list.length - 1, 1))));

    const ambYs = buildYs(ambulances, canvas.height);
    const patYs = buildYs(patients, canvas.height);
    ambulances.forEach((a, i) => { positions[a] = { x: leftX, y: ambYs[i] }; });
    patients.forEach((p, i) => { positions[p] = { x: rightX, y: patYs[i] }; });

    // Get distance range for color gradient
    const allCosts = ambulances.flatMap(a => patients.map(p => costMatrix[a][p]));
    const minD = Math.min(...allCosts), maxD = Math.max(...allCosts);

    // Draw all edges
    for (const a of ambulances) {
        for (const p of patients) {
            const cost = costMatrix[a][p];
            const p1 = positions[a], p2 = positions[p];

            const isQuantum = quantumAssign[a] === p;
            const isClassical = classicalAssign[a] === p;

            // Glow for selected routes
            if (isQuantum) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = 'rgba(68, 138, 255, 0.25)';
                ctx.lineWidth = 14;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = isQuantum ? '#448aff' : gradientColor(cost, minD, maxD);
            ctx.lineWidth = isQuantum ? 3.5 : 2;
            ctx.setLineDash(isQuantum ? [] : [5, 3]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label
            const aIndex = ambulances.indexOf(a);
            const pIndex = patients.indexOf(p);
            const t = 0.5 + Math.max(-0.4, Math.min(0.4, (aIndex - pIndex) * 0.08));
            const midX = p1.x + (p2.x - p1.x) * t;
            const midY = p1.y + (p2.y - p1.y) * t - 8;
            const label = `${a}→${p}:${cost.toFixed(1)}`;
            ctx.font = '11px Inter';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(midX - tw / 2 - 3, midY - 9, tw + 6, 18);
            ctx.fillStyle = isQuantum ? '#000000' : '#6B5D61';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, midX, midY);
        }
    }

    // Draw nodes
    for (const [node, pos] of Object.entries(positions)) {
        const isAmb = ambulances.includes(node);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 22, 0, 2 * Math.PI);
        ctx.fillStyle = isAmb ? '#448aff' : '#ff7043';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node, pos.x, pos.y);
    }
}

// ============================================================
// RENDER COST HEATMAP
// ============================================================
function renderHeatmap(costMatrix, quantumAssign) {
    const patients = Object.keys(Object.values(costMatrix)[0] || {});
    const ambulances = Object.keys(costMatrix);
    const allVals = ambulances.flatMap(a => patients.map(p => costMatrix[a][p]));
    const minV = Math.min(...allVals), maxV = Math.max(...allVals);

    let html = `<table class="heatmap-table"><thead><tr><th>Ambulance \\ Patient</th>`;
    patients.forEach(p => { html += `<th>${p}</th>`; });
    html += `</tr></thead><tbody>`;

    ambulances.forEach(a => {
        html += `<tr><td class="row-header">${a}</td>`;
        patients.forEach(p => {
            const val = costMatrix[a][p];
            const norm = (val - minV) / (maxV - minV || 1);
            const r = Math.round(norm * 200 + 30);
            const g = Math.round((1 - norm) * 180 + 20);
            const b = 60;
            const isOptimal = quantumAssign[a] === p;
            html += `<td class="heatmap-cell ${isOptimal ? 'optimal-cell' : ''}" style="background:rgba(${r},${g},${b},0.6)">
                ${val.toFixed(1)} ${isOptimal ? '✓' : ''}
            </td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('heatmap-table-wrapper').innerHTML = html;
}

// ============================================================
// SCALABILITY CHART
// ============================================================
function drawScalabilityChart() {
    const ctx = document.getElementById('scalabilityChart').getContext('2d');
    if (scalabilityChartInstance) scalabilityChartInstance.destroy();

    const ns = [1, 2, 3, 4, 5, 6, 7, 8];
    const classical = ns.map(n => {
        let f = 1; for (let i = 2; i <= n; i++) f *= i;
        return f;
    });
    const quantum = ns.map(n => Math.pow(n, 3));

    scalabilityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ns.map(n => `N=${n}`),
            datasets: [
                {
                    label: 'Classical O(N!)',
                    data: classical,
                    borderColor: '#FF4D6D',
                    backgroundColor: 'rgba(255, 77, 109, 0.1)',
                    borderWidth: 2.5,
                    pointRadius: 4,
                    tension: 0.3,
                    fill: true,
                },
                {
                    label: 'Quantum ~O(N³)',
                    data: quantum,
                    borderColor: '#000000',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 2.5,
                    pointRadius: 4,
                    tension: 0.3,
                    fill: true,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Steps (log scale)', color: '#7a8aaa' },
                    ticks: { color: '#7a8aaa' },
                    grid: { color: '#1a2440' }
                },
                x: { ticks: { color: '#7a8aaa' }, grid: { color: '#1a2440' } }
            },
            plugins: {
                legend: { labels: { color: '#e8f0fe' } },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}

// ============================================================
// EXECUTION TIME CHART
// ============================================================
function updateTimeChart(classicalTime, quantumTime) {
    const ctx = document.getElementById('timeChart').getContext('2d');
    if (timeChartInstance) timeChartInstance.destroy();
    timeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Classical', 'Quantum'],
            datasets: [{
                label: 'Execution Time (s)',
                data: [classicalTime, quantumTime],
                backgroundColor: ['rgba(255, 183, 197, 0.8)', 'rgba(0, 0, 0, 0.8)'],
                borderColor: ['#FFB7C5', '#000000'],
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    type: 'logarithmic',
                    title: { display: true, text: 'Time (s)', color: '#6B5D61' },
                    ticks: { color: '#6B5D61' },
                    grid: { color: '#EDD2D8' }
                },
                x: { ticks: { color: '#6B5D61' }, grid: { display: false } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ============================================================
// FETCH QUANTUM CIRCUIT IMAGE
// ============================================================
async function fetchCircuitImage() {
    const wrapper = document.getElementById('circuit-img-wrapper');
    wrapper.innerHTML = '<div class="circuit-spinner">⏳ Generating quantum circuit from Qiskit...</div>';
    try {
        const res = await fetch('http://localhost:8000/circuit');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        wrapper.innerHTML = `<img src="${data.image}" alt="QAOA Quantum Circuit" class="circuit-img">`;
    } catch {
        wrapper.innerHTML = `<div class="circuit-error">⚠️ Circuit image unavailable — ensure <code>api.py</code> is running and matplotlib is installed.</div>`;
    }
}

// ============================================================
// MAIN SOLVE FUNCTION
// ============================================================
const runBtn = document.getElementById('run-btn');
const mainContent = document.getElementById('main-content');

async function solve() {
    const ambulances = getSelectedAmbulances();
    const patients = getSelectedPatients();

    if (ambulances.length === 0 || patients.length === 0) {
        alert('Please select at least one ambulance and one patient!');
        return;
    }

    const payload = {
        traffic: parseFloat(trafficInput.value),
        ambulances,
        patients,
        availability: getAvailability(),
        severity: getSeverity()
    };

    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running Quantum Engine...';

    try {
        const res = await fetch('http://localhost:8000/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || `API Error ${res.status}`);
        }

        const data = await res.json();

        // Update metric cards
        document.getElementById('classical-cost').textContent = data.classical.cost.toFixed(2);
        document.getElementById('classical-assign').textContent = Object.entries(data.classical.assignment).map(([k, v]) => `${k}→${v}`).join(', ');
        document.getElementById('classical-time').textContent = data.classical.time.toFixed(4);

        document.getElementById('quantum-cost').textContent = data.quantum.cost.toFixed(2);
        document.getElementById('quantum-assign').textContent = Object.entries(data.quantum.assignment).map(([k, v]) => `${k}→${v}`).join(', ');
        document.getElementById('quantum-time').textContent = data.quantum.time.toFixed(4);

        // Show results
        mainContent.classList.remove('hidden');

        // Draw visuals
        updateTimeChart(data.classical.time, data.quantum.time);
        drawGraph(data.cost_matrix, data.quantum.assignment, data.classical.assignment);
        renderHeatmap(data.cost_matrix, data.quantum.assignment);
        drawScalabilityChart();
        fetchCircuitImage();

    } catch (err) {
        alert(`Failed to connect to the Quantum Engine.\n\nError: ${err.message}\n\nIs python api.py running locally?`);
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = '🚀 Run Optimization';
    }
}

runBtn.addEventListener('click', solve);

// ============================================================
// COLLAPSIBLE SECTIONS
// ============================================================
window.toggleSection = function (headerElement) {
    const container = headerElement.closest('.collapsible-section');
    if (container) {
        container.classList.toggle('collapsed');
    }
};
