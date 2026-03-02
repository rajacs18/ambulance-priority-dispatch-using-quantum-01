# 🚑 Quantum Priority Ambulance Dispatch

A **Hybrid Quantum-Classical** optimization framework for real-time emergency ambulance dispatch, built with **QUBO formulation** and **QAOA** via IBM Qiskit.

🔗 **Live Demo:** [hackathon-0161.web.app](https://hackathon-0161.web.app)

---

## 🧠 The Problem

In emergency response, assigning **N ambulances** to **N patients** while minimizing total cost is a **combinatorial optimization problem** — complexity grows as **N!** (factorial).

| Ambulances | Possible Assignments |
|:---:|:---:|
| 4 | 24 |
| 10 | 3,628,800 |
| 20 | 2.4 × 10¹⁸ |

Classical brute-force becomes infeasible at scale. **Quantum optimization** offers a fundamentally better approach.

---

## ⚛️ Our Approach

### Cost Model
```
Cost = Distance × Traffic × Severity
```

### Pipeline
```
User Inputs → Cost Matrix → QUBO Formulation → QAOA Solver → Optimal Assignment → Visualization
```

1. **Cost Matrix** — Computed from distance, traffic congestion, and patient severity.
2. **QUBO Formulation** — Quadratic Unconstrained Binary Optimization encoding with penalty-based constraints.
3. **QAOA** — Quantum Approximate Optimization Algorithm (hybrid quantum-classical) solves the QUBO.
4. **Comparison** — Results compared against classical brute-force for validation.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🚑 Dynamic Ambulance Selection | Select 2–4 ambulances, toggle ON/OFF |
| 🏥 Patient Selection with Severity | Choose patients, assign severity 1–5 |
| 🟢🟡🔴 Availability Status | Available / En Route / Busy per ambulance |
| 📊 Cost Heatmap | Color-coded cost matrix with optimal assignment highlighted |
| ⚛️ Quantum Circuit Viewer | Displays the actual QAOA circuit from Qiskit |
| 📈 Scalability Chart | O(N!) classical vs O(N³) quantum comparison |
| 🖥️ vs ⚛️ Comparison | Side-by-side classical and quantum results |

---

## 🛠️ Tech Stack

- **Quantum Engine:** Python, Qiskit, QAOA, COBYLA optimizer
- **Backend API:** FastAPI + Uvicorn
- **Frontend:** HTML, CSS, JavaScript, Chart.js
- **Hosting:** Firebase Hosting
- **Architecture:** Decoupled — JS frontend ↔ Python API backend

---

## 🚀 Quick Start

### 1. Clone & Setup
```bash
git clone https://github.com/rajacs18/ambulance-priority-dispatch-using-quantum-01.git
cd ambulance-priority-dispatch-using-quantum-01
python -m venv venv
venv\Scripts\activate        # Windows
pip install fastapi uvicorn qiskit qiskit-optimization qiskit-algorithms matplotlib
```

### 2. Run the Quantum Engine
```bash
python api.py
# → Uvicorn running on http://0.0.0.0:8000
```

### 3. Serve the Frontend (separate terminal)
```bash
cd public
python -m http.server 3000
# → Open http://localhost:3000
```

### 4. Use It
- Select ambulances & patients
- Set availability and severity
- Click **🚀 Run Optimization**
- View results, heatmap, circuit, and scalability chart

---

## 📁 Project Structure

```
├── api.py                  # FastAPI backend (Qiskit QAOA engine)
├── public/
│   ├── index.html          # Main dashboard UI
│   ├── styles.css          # Datary-style dark theme
│   ├── script.js           # Frontend logic & visualization
│   └── speaker-notes.html  # Presentation speaker notes
├── firebase.json           # Firebase Hosting config
└── README.md
```

---

## 📐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/solve` | Run optimization with dynamic inputs |
| GET | `/circuit` | Get QAOA quantum circuit as base64 PNG |

### POST `/solve` — Request Body
```json
{
  "traffic": 2.0,
  "ambulances": ["A1", "A2", "A3"],
  "patients": ["E1", "E2", "E3"],
  "availability": {"A1": "available", "A2": "busy", "A3": "available"},
  "severity": {"E1": 3, "E2": 5, "E3": 1}
}
```

---

## ⚠️ Honest Limitations

- QAOA runs on a **quantum simulator**, not real quantum hardware
- On a simulator, quantum is **slower** than classical for small N — this is expected
- On **real quantum hardware**, the advantage reverses at scale
- Current demo supports up to **4×4** assignment problems

---

## 🔮 Future Scope

- Real-time traffic API integration
- IBM Quantum hardware execution
- Larger-scale optimization (10+ ambulances)
- Alternative algorithms (VQE, Grover-based)

---

## 👥 Team

Built for **Hackathon 2026** · Quantum Computing Track

---

*Built with ❤️ using Qiskit, FastAPI, and Firebase*
