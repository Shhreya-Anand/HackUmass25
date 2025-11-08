import cv2
import numpy as np
from scipy import ndimage
from skimage.morphology import skeletonize
from collections import deque

class MapToGraph:
    def __init__(self, image_path):
        """Initialize with map image path"""
        self.img = cv2.imread(image_path)
        self.gray = cv2.cvtColor(self.img, cv2.COLOR_BGR2GRAY)
        self.nodes = []
        self.edges = []
        self.adj_matrix = None
        self.skeleton = None
        
    def preprocess_image(self, road_color='dark', threshold=127):
        """Convert map to binary road network
        
        Args:
            road_color: 'dark' for dark roads on light bg, 'light' for light roads on dark bg
            threshold: threshold value for binarization (0-255)
        """
        # Adaptive thresholding often works better for maps
        binary = cv2.adaptiveThreshold(
            self.gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV if road_color == 'dark' else cv2.THRESH_BINARY,
            11, 2
        )
        
        # Clean up noise
        kernel = np.ones((3,3), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)
        
        # Skeletonize to single pixel width
        skeleton = skeletonize(binary // 255).astype(np.uint8) * 255
        
        # Save for debugging
        cv2.imwrite('debug_skeleton.png', skeleton)
        print("Saved skeleton to debug_skeleton.png")
        
        return skeleton
    
    def count_neighbors(self, skeleton, y, x):
        """Count the number of road neighbors for a pixel"""
        if skeleton[y, x] == 0:
            return 0
        
        count = 0
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dy == 0 and dx == 0:
                    continue
                ny, nx = y + dy, x + dx
                if 0 <= ny < skeleton.shape[0] and 0 <= nx < skeleton.shape[1]:
                    if skeleton[ny, nx] > 0:
                        count += 1
        return count
    
    def detect_junctions(self, skeleton):
        """Find junction points where roads meet"""
        junctions = []
        h, w = skeleton.shape
        
        # Scan for pixels that are part of roads
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if skeleton[y, x] == 0:
                    continue
                
                # Count 8-connected neighbors
                neighbors = self.count_neighbors(skeleton, y, x)
                
                # Junction: 3 or more neighbors (intersection)
                # Endpoint: exactly 1 neighbor
                if neighbors >= 3 or neighbors == 1:
                    junctions.append((x, y))
        
        print(f"Found {len(junctions)} raw junction pixels")
        
        # Cluster nearby junctions
        junctions = self._cluster_junctions(junctions, threshold=15)
        
        return junctions
    
    def _cluster_junctions(self, junctions, threshold=15):
        """Merge junctions that are close together"""
        if not junctions:
            return []
        
        visited = set()
        clusters = []
        
        for i, pt in enumerate(junctions):
            if i in visited:
                continue
            
            # Start new cluster
            cluster = [pt]
            visited.add(i)
            queue = [i]
            
            while queue:
                curr_idx = queue.pop(0)
                curr_pt = junctions[curr_idx]
                
                # Find nearby points
                for j, other_pt in enumerate(junctions):
                    if j in visited:
                        continue
                    
                    dist = np.sqrt((curr_pt[0] - other_pt[0])**2 + 
                                 (curr_pt[1] - other_pt[1])**2)
                    
                    if dist < threshold:
                        cluster.append(other_pt)
                        visited.add(j)
                        queue.append(j)
            
            clusters.append(cluster)
        
        # Get centroid of each cluster
        merged = []
        for cluster in clusters:
            cx = int(np.mean([p[0] for p in cluster]))
            cy = int(np.mean([p[1] for p in cluster]))
            merged.append((cx, cy))
        
        return merged
    
    def find_edges_simple(self, skeleton, nodes):
        """Simplified edge detection - trace paths between nodes"""
        edges = set()
        
        # Create a working copy
        skel_copy = skeleton.copy()
        
        # Mark all node regions (larger radius to ensure coverage)
        node_mask = np.zeros_like(skeleton)
        node_radius = 8
        
        for idx, (x, y) in enumerate(nodes):
            cv2.circle(node_mask, (x, y), node_radius, idx + 1, -1)
        
        # For each pixel on the skeleton
        visited = np.zeros_like(skeleton, dtype=bool)
        
        for start_idx, (sx, sy) in enumerate(nodes):
            # Find road pixels near this node
            for dy in range(-node_radius-2, node_radius+3):
                for dx in range(-node_radius-2, node_radius+3):
                    px, py = sx + dx, sy + dy
                    
                    if (py < 0 or py >= skeleton.shape[0] or 
                        px < 0 or px >= skeleton.shape[1]):
                        continue
                    
                    # If this is a road pixel not in a node region
                    if skeleton[py, px] > 0 and node_mask[py, px] == 0:
                        # Trace from here
                        end_idx = self._trace_path_simple(
                            skeleton, px, py, node_mask, start_idx, nodes
                        )
                        
                        if end_idx is not None and end_idx != start_idx:
                            edge = tuple(sorted([start_idx, end_idx]))
                            edges.add(edge)
        
        # Alternative: direct distance check for nearby nodes
        print("Checking direct connections...")
        for i in range(len(nodes)):
            for j in range(i + 1, len(nodes)):
                if self._has_path(skeleton, nodes[i], nodes[j], max_dist=200):
                    edge = tuple(sorted([i, j]))
                    edges.add(edge)
                    print(f"Found connection: {i} <-> {j}")
        
        return list(edges)
    
    def _trace_path_simple(self, skeleton, start_x, start_y, node_mask, start_idx, nodes):
        """Trace from a point until hitting another node"""
        visited = set()
        queue = deque([(start_x, start_y)])
        visited.add((start_x, start_y))
        
        max_steps = 5000
        steps = 0
        
        while queue and steps < max_steps:
            steps += 1
            x, y = queue.popleft()
            
            # Check if we hit a different node
            if node_mask[y, x] > 0:
                hit_idx = int(node_mask[y, x]) - 1
                if hit_idx != start_idx:
                    return hit_idx
            
            # Explore neighbors
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dy == 0 and dx == 0:
                        continue
                    
                    nx, ny = x + dx, y + dy
                    
                    if (0 <= ny < skeleton.shape[0] and 
                        0 <= nx < skeleton.shape[1] and
                        (nx, ny) not in visited and 
                        skeleton[ny, nx] > 0):
                        
                        visited.add((nx, ny))
                        queue.append((nx, ny))
        
        return None
    
    def _has_path(self, skeleton, node1, node2, max_dist=200):
        """Check if there's a path between two nodes"""
        dist = np.sqrt((node1[0] - node2[0])**2 + (node1[1] - node2[1])**2)
        if dist > max_dist:
            return False
        
        # BFS to find path
        visited = set()
        queue = deque([node1])
        visited.add(node1)
        
        # Expand search area around start
        for dy in range(-10, 11):
            for dx in range(-10, 11):
                px, py = node1[0] + dx, node1[1] + dy
                if (0 <= py < skeleton.shape[0] and 0 <= px < skeleton.shape[1] and
                    skeleton[py, px] > 0):
                    queue.append((px, py))
                    visited.add((px, py))
        
        max_steps = int(dist * 3)  # Allow some wiggle room
        steps = 0
        
        while queue and steps < max_steps:
            steps += 1
            x, y = queue.popleft()
            
            # Check if we reached target node
            dist_to_target = np.sqrt((x - node2[0])**2 + (y - node2[1])**2)
            if dist_to_target < 10:
                return True
            
            # Explore neighbors
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dy == 0 and dx == 0:
                        continue
                    
                    nx, ny = x + dx, y + dy
                    
                    if (0 <= ny < skeleton.shape[0] and 
                        0 <= nx < skeleton.shape[1] and
                        (nx, ny) not in visited and 
                        skeleton[ny, nx] > 0):
                        
                        visited.add((nx, ny))
                        queue.append((nx, ny))
        
        return False
    
    def create_adjacency_matrix(self):
        """Build adjacency matrix from nodes and edges"""
        n = len(self.nodes)
        self.adj_matrix = np.zeros((n, n), dtype=int)
        
        for edge in self.edges:
            i, j = edge
            self.adj_matrix[i, j] = 1
            self.adj_matrix[j, i] = 1
        
        return self.adj_matrix
    
    def process(self, road_color='dark', threshold=127):
        """Run full pipeline
        
        Args:
            road_color: 'dark' for dark roads on light bg, 'light' for light roads
            threshold: threshold value for binarization
        """
        print("Preprocessing image...")
        self.skeleton = self.preprocess_image(road_color=road_color, threshold=threshold)
        
        print("Detecting junctions...")
        self.nodes = self.detect_junctions(self.skeleton)
        print(f"Found {len(self.nodes)} junctions")
        
        print("Finding edges...")
        self.edges = self.find_edges_simple(self.skeleton, self.nodes)
        print(f"Found {len(self.edges)} edges")
        
        print("Creating adjacency matrix...")
        self.adj_matrix = self.create_adjacency_matrix()
        
        return self.nodes, self.edges, self.adj_matrix
    
    def visualize(self, output_path='output.png'):
        """Draw nodes and edges on original image"""
        vis = self.img.copy()
        
        # Draw edges
        for edge in self.edges:
            node1 = self.nodes[edge[0]]
            node2 = self.nodes[edge[1]]
            cv2.line(vis, node1, node2, (0, 255, 0), 3)
        
        # Draw nodes
        for idx, node in enumerate(self.nodes):
            cv2.circle(vis, node, 10, (0, 0, 255), -1)
            cv2.circle(vis, node, 11, (255, 255, 255), 2)
            cv2.putText(vis, str(idx), (node[0]+15, node[1]+5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
        
        cv2.imwrite(output_path, vis)
        print(f"Visualization saved to {output_path}")
        return vis


# Example usage
if __name__ == "__main__":
    map_graph = MapToGraph('Map2.png')
    
    # Try 'dark' for dark roads, 'light' for light roads
    nodes, edges, adj_matrix = map_graph.process(road_color='dark')
    
    # Visualize results
    map_graph.visualize('output.png')
    
    # Print results
    print("\nNodes (junctions):")
    for i, node in enumerate(nodes):
        print(f"Node {i}: {node}")
    
    print("\nEdges (roads):")
    for edge in edges:
        print(f"Node {edge[0]} <-> Node {edge[1]}")
    
    print("\nAdjacency Matrix:")
    print(adj_matrix)
    
    # Save adjacency matrix
    if len(nodes) > 0:
        np.savetxt('adjacency_matrix.csv', adj_matrix, fmt='%d', delimiter=',')
        print("\nAdjacency matrix saved to adjacency_matrix.csv")