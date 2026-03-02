import networkx as nx
import itertools
import time
import matplotlib.pyplot as plt

from qiskit_optimization import QuadraticProgram
from qiskit_optimization.converters import QuadraticProgramToQubo
from qiskit_algorithms import QAOA
from qiskit_algorithms.optimizers import COBYLA
from qiskit.primitives import StatevectorSampler
from qiskit_optimization.algorithms import MinimumEigenOptimizer

# =====================================================
# 1. CREATE CITY ROAD NETWORK
# =====================================================

G = nx.Graph()

locations = {
    0: {"pos": (0, 0)},
    1: {"pos": (4, 0)},
    2: {"pos": (2, 3)},
    3: {"pos": (6, 3)},
    4: {"pos": (4, 5)},
    5: {"pos": (8, 1)}
}

for node_id, data in locations.items():
    G.add_node(node_id, pos=data["pos"])

roads = [
    (0, 1, 8),
    (0, 2, 10),
    (1, 2, 6),
    (1, 3, 7),
    (2, 4, 9),
    (3, 4, 8),
    (3, 5, 6),
    (1, 5, 5)
]

for u, v, time_w in roads:
    G.add_edge(u, v, weight=time_w)

def shortest_time(start, end):
    return nx.shortest_path_length(G, start, end, weight="weight")

# =====================================================
# 2. AMBULANCES & EMERGENCIES (3x3)
# =====================================================

ambulances = {
    "A1": 0,
    "A2": 1,
    "A3": 2
}

emergencies = {
    "E1": {"location": 4, "severity": 1},  # Critical
    "E2": {"location": 3, "severity": 2},  # Moderate
    "E3": {"location": 5, "severity": 3}   # Low
}

# =====================================================
# 3. CLASSICAL SOLUTION
# =====================================================

start_classical = time.time()

best_cost = float("inf")
best_assignment = None

ambulance_list = list(ambulances.keys())
emergency_list = list(emergencies.keys())

for perm in itertools.permutations(emergency_list):
    total = 0
    current = {}

    for amb, emerg in zip(ambulance_list, perm):
        t = shortest_time(ambulances[amb], emergencies[emerg]["location"])
        severity = emergencies[emerg]["severity"]
        total += t * severity
        current[amb] = emerg

    if total < best_cost:
        best_cost = total
        best_assignment = current

classical_time = time.time() - start_classical

# =====================================================
# 4. BUILD QUBO
# =====================================================

qp = QuadraticProgram()

for amb in ambulances:
    for emerg in emergencies:
        qp.binary_var(f"x_{amb}_{emerg}")

linear = {}
for amb in ambulances:
    for emerg in emergencies:
        t = shortest_time(ambulances[amb], emergencies[emerg]["location"])
        severity = emergencies[emerg]["severity"]
        linear[f"x_{amb}_{emerg}"] = t * severity

qp.minimize(linear=linear)

for amb in ambulances:
    qp.linear_constraint(
        linear={f"x_{amb}_{e}": 1 for e in emergencies},
        sense="==",
        rhs=1,
        name=f"assign_{amb}"
    )

for emerg in emergencies:
    qp.linear_constraint(
        linear={f"x_{a}_{emerg}": 1 for a in ambulances},
        sense="==",
        rhs=1,
        name=f"cover_{emerg}"
    )

converter = QuadraticProgramToQubo()
qubo = converter.convert(qp)

# =====================================================
# 5. RUN QAOA
# =====================================================

start_quantum = time.time()

optimizer = COBYLA(maxiter=200)
qaoa = QAOA(sampler=StatevectorSampler(), optimizer=optimizer, reps=1)
solver = MinimumEigenOptimizer(qaoa)
result = solver.solve(qubo)

quantum_time = time.time() - start_quantum

# =====================================================
# 6. DECODE QUANTUM RESULT
# =====================================================

quantum_assignment = {}
quantum_cost = 0

for var, value in zip(result.variables, result.x):
    if value == 1:
        parts = var.name.split("_")
        amb = parts[1]
        emerg = parts[2]
        quantum_assignment[amb] = emerg

        t = shortest_time(ambulances[amb], emergencies[emerg]["location"])
        severity = emergencies[emerg]["severity"]
        quantum_cost += t * severity

# =====================================================
# 7. PRINT RESULTS
# =====================================================

print("\n===== CLASSICAL RESULT =====")
print(best_assignment)
print("Cost:", best_cost)
print("Runtime:", classical_time)

print("\n===== QUANTUM RESULT =====")
print(quantum_assignment)
print("Cost:", quantum_cost)
print("Runtime:", quantum_time)

# =====================================================
# 8. VISUALIZATION WITH PRIORITY COLORS
# =====================================================

def visualize_solution(title, assignment):
    pos = nx.get_node_attributes(G, "pos")
    plt.figure(figsize=(8,6))

    nx.draw(G, pos, with_labels=True,
            node_size=1200, node_color="lightgray")

    labels = nx.get_edge_attributes(G, "weight")
    nx.draw_networkx_edge_labels(G, pos, edge_labels=labels)

    severity_colors = {
        1: "red",      # Critical
        2: "orange",   # Moderate
        3: "green"     # Low
    }

    for amb, emerg in assignment.items():
        start = ambulances[amb]
        end = emergencies[emerg]["location"]
        severity = emergencies[emerg]["severity"]

        path = nx.shortest_path(G, start, end, weight="weight")
        path_edges = [(path[i], path[i+1]) for i in range(len(path)-1)]

        nx.draw_networkx_edges(G, pos,
                               edgelist=path_edges,
                               edge_color=severity_colors[severity],
                               width=4)

    plt.title(title)
    plt.show()

visualize_solution("Classical Dispatch (3x3)", best_assignment)
visualize_solution("Quantum Dispatch (3x3)", quantum_assignment)

# =====================================================
# 9. COST COMPARISON CHART
# =====================================================

plt.bar(["Classical", "Quantum"], [best_cost, quantum_cost])
plt.ylabel("Total Dispatch Cost")
plt.title("Cost Comparison (3x3)")
plt.show()