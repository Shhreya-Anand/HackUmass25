from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI(title="Greedy Single-Unit Path Finder")

class Edge(BaseModel):
    from_node: int
    to_node: int
    capacity: int

class PathRequest(BaseModel):
    num_nodes: int
    edges: List[Edge]
    source: int
    sink: int

def find_greedy_path(num_nodes: int, edges: List[Edge], source: int, sink: int) -> List[int]:
    # Build adjacency list with capacities
    adj = [[] for _ in range(num_nodes)]
    cap = [[0]*num_nodes for _ in range(num_nodes)]
    for e in edges:
        adj[e.from_node].append(e.to_node)
        cap[e.from_node][e.to_node] = e.capacity

    visited = [False]*num_nodes
    path = []

    def dfs(u):
        if u == sink:
            path.append(u)
            return True
        visited[u] = True
        path.append(u)
        # Explore neighbors greedily (could sort by capacity descending for more greedy behavior)
        for v in adj[u]:
            if not visited[v] and cap[u][v] >= 1:
                if dfs(v):
                    return True
        path.pop()
        return False

    found = dfs(source)
    return path if found else []

@app.post("/single_unit_path")
def single_unit_path(request: PathRequest):
    path = find_greedy_path(request.num_nodes, request.edges, request.source, request.sink)
    if not path:
        return {"message": "No valid path found"}
    return {"path": path}
