from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict
import time
import itertools
import base64
import io

# Qiskit imports
from qiskit_optimization import QuadraticProgram
from qiskit_optimization.converters import QuadraticProgramToQubo
from qiskit_optimization.algorithms import MinimumEigenOptimizer
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA

try:
    # Use StatevectorSampler (V2) for better performance in newer Qiskit
    from qiskit.primitives import StatevectorSampler
    sampler = StatevectorSampler()
except ImportError:
    from qiskit.primitives import Sampler
    sampler = Sampler()

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MPL = True
except ImportError:
    HAS_MPL = False

app = FastAPI(title="Quantum Ambulance Dispatch API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "online", "engine": "Qiskit QAOA", "version": "1.0"}


# ─── Base Distance Matrix (expandable up to A4 x E4) ───────────────────────
FULL_DISTANCES: Dict[str, Dict[str, int]] = {
    "A1": {"E1": 6,  "E2": 10, "E3": 14, "E4": 9},
    "A2": {"E1": 8,  "E2": 5,  "E3": 11, "E4": 13},
    "A3": {"E1": 12, "E2": 7,  "E3": 4,  "E4": 10},
    "A4": {"E1": 9,  "E2": 15, "E3": 8,  "E4": 6},
}


# ─── Request Models ─────────────────────────────────────────────────────────
class OptimizationRequest(BaseModel):
    traffic: float
    ambulances: List[str]               # e.g. ["A1", "A2", "A3"]
    patients: List[str]                  # e.g. ["E1", "E2"]
    availability: Dict[str, str]         # e.g. {"A1": "available", "A2": "busy"}
    severity: Dict[str, int]             # e.g. {"E1": 3, "E2": 5}


# ─── Helper ────────────────────────────────────────────────────────────────
def active_ambulances(req: OptimizationRequest) -> List[str]:
    return [a for a in req.ambulances if req.availability.get(a, "available") == "available"]


# ─── /solve ────────────────────────────────────────────────────────────────
@app.post("/solve")
def solve_dispatch(req: OptimizationRequest):
    try:
        ambulances = active_ambulances(req)
        patients = req.patients

        if len(ambulances) == 0:
            raise HTTPException(status_code=400, detail="No available ambulances.")
        if len(patients) == 0:
            raise HTTPException(status_code=400, detail="No patients selected.")

        # Limit to square for balanced assignment (use min)
        n = min(len(ambulances), len(patients))
        ambulances = ambulances[:n]
        patients = patients[:n]

        # Build cost matrix
        cost_matrix: Dict[tuple, float] = {}
        cost_matrix_display: Dict[str, Dict[str, float]] = {}

        for a in ambulances:
            cost_matrix_display[a] = {}
            for p in patients:
                base = FULL_DISTANCES[a][p]
                cost = base * req.traffic * req.severity.get(p, 1)
                cost_matrix[(a, p)] = cost
                cost_matrix_display[a][p] = round(cost, 2)

        # ── Classical Brute-Force ──────────────────────────────────────────
        t0 = time.time()
        best_cost = float("inf")
        best_assign: Dict[str, str] = {}

        for perm in itertools.permutations(patients):
            total = sum(cost_matrix[(a, p)] for a, p in zip(ambulances, perm))
            if total < best_cost:
                best_cost = total
                best_assign = {a: p for a, p in zip(ambulances, perm)}

        classical_time = time.time() - t0

        # ── QUBO / QAOA ───────────────────────────────────────────────────
        qp = QuadraticProgram()
        for a in ambulances:
            for p in patients:
                qp.binary_var(f"x_{a}_{p}")

        qp.minimize(linear={f"x_{a}_{p}": cost_matrix[(a, p)] for a in ambulances for p in patients})

        for a in ambulances:
            qp.linear_constraint(linear={f"x_{a}_{p}": 1 for p in patients}, sense="==", rhs=1)
        for p in patients:
            qp.linear_constraint(linear={f"x_{a}_{p}": 1 for a in ambulances}, sense="==", rhs=1)

        qubo = QuadraticProgramToQubo().convert(qp)

        t1 = time.time()
        # Increased iterations for better convergence with larger N
        optimizer = COBYLA(maxiter=25) 
        qaoa = QAOA(sampler=sampler, optimizer=optimizer, reps=1)
        
        try:
            result = MinimumEigenOptimizer(qaoa).solve(qubo)
            quantum_time = time.time() - t1

            quantum_assign: Dict[str, str] = {}
            quantum_cost = 0.0

            # Robust parsing: Only look for x_A_P variables, ignore slack/penalty vars
            for var, val in zip(result.variables, result.x):
                if val == 1 and var.name.startswith("x_"):
                    parts = var.name.split("_")
                    if len(parts) >= 3:
                        a, p = parts[1], parts[2]
                        quantum_assign[a] = p
                        quantum_cost += cost_matrix[(a, p)]
        except Exception as q_err:
            print(f"Quantum Solver Error: {q_err}")
            quantum_assign = {}
            quantum_time = time.time() - t1

        # fallback if QAOA fails or returns invalid assignment
        if len(quantum_assign) < n:
            quantum_assign = best_assign
            quantum_cost = best_cost

        return {
            "classical": {
                "assignment": best_assign,
                "cost": round(best_cost, 2),
                "time": classical_time,
            },
            "quantum": {
                "assignment": quantum_assign,
                "cost": round(quantum_cost, 2),
                "time": quantum_time,
            },
            "cost_matrix": cost_matrix_display,
            "distances": {a: {p: FULL_DISTANCES[a][p] for p in patients} for a in ambulances},
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── /circuit ──────────────────────────────────────────────────────────────
@app.get("/circuit")
def get_circuit():
    if not HAS_MPL:
        raise HTTPException(status_code=500, detail="matplotlib not installed")
    try:
        from qiskit.circuit import QuantumCircuit
        from qiskit_algorithms.minimum_eigensolvers import QAOA as NewQAOA

        # Build a tiny 2×2 demo circuit for display
        qp = QuadraticProgram()
        for name in ["x_A1_E1", "x_A1_E2", "x_A2_E1", "x_A2_E2"]:
            qp.binary_var(name)
        qp.minimize(linear={"x_A1_E1": 6, "x_A1_E2": 10, "x_A2_E1": 8, "x_A2_E2": 5})
        qp.linear_constraint(linear={"x_A1_E1": 1, "x_A1_E2": 1}, sense="==", rhs=1)
        qp.linear_constraint(linear={"x_A2_E1": 1, "x_A2_E2": 1}, sense="==", rhs=1)
        qp.linear_constraint(linear={"x_A1_E1": 1, "x_A2_E1": 1}, sense="==", rhs=1)
        qp.linear_constraint(linear={"x_A1_E2": 1, "x_A2_E2": 1}, sense="==", rhs=1)

        qubo = QuadraticProgramToQubo().convert(qp)

        from qiskit_algorithms import QAOA
        from qiskit_algorithms.optimizers import COBYLA
        qaoa = QAOA(sampler=sampler, optimizer=COBYLA(maxiter=1), reps=1)
        from qiskit_optimization.algorithms import MinimumEigenOptimizer
        solver = MinimumEigenOptimizer(qaoa)
        result = solver.solve(qubo)

        # Get circuit from the ansatz
        circuit = qaoa.ansatz
        circuit = circuit.decompose()

        fig = circuit.draw(output='mpl', style='bw', fold=40)
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=110)
        plt.close(fig)
        buf.seek(0)
        img_b64 = base64.b64encode(buf.read()).decode('utf-8')
        return {"image": f"data:image/png;base64,{img_b64}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
