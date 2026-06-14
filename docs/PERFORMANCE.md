# Performance & Optimization

Entropia is designed for high-performance biological simulations involving thousands of agents. This document outlines the key optimization strategies implemented in the system.

## 🏎️ Core Strategies

### 1. Zero-Allocation Update Loop
To avoid Garbage Collector (GC) "stutters," we eliminate object allocation in the hot path (Simulation Engine `update` loop).
- **Vector Pooling**: We use pre-allocated vector objects for all physics calculations.
- **TypedArrays**: Simulation data is stored in `Float32Array` buffers, which are transmitted to the UI thread as **Transferable Objects** (zero-copy).

### 2. Web Worker Isolation
The simulation engine runs in a dedicated Web Worker. This ensures that heavy mathematical computations do not block the UI thread, maintaining a smooth 60 FPS for rendering even when the simulation is under heavy load.

### 3. Spatial Hashing
Instead of $O(N^2)$ collision checks, we use a **Spatial Hash Grid**. This reduces neighbor search complexity to $O(1)$ on average.
- **Dynamic Capacity**: The grid automatically adjusts to the population density.
- **Toroidal Support**: The grid handles world-wrapping (toroidal topology) efficiently.

## 📈 Optimization History

### Phase 4 (Current)
- **Render Cadence Split**: The simulation runs at a fixed physical step, while render snapshots are dispatched at a separate (throttleable) frequency.
- **Single-Pass Aggregation**: Population statistics and death processing are performed in a single iteration over the entity map.
- **Buffer Serialization**: `BufferManager` uses upper-bound estimates to avoid double-pass counting before writing to TypedArrays.

### Future Goals
- **SharedArrayBuffer**: Migrating from message-passing to shared memory for even lower latency (pending cross-origin isolation refinements).
- **GPU Physics**: Moving basic physics updates to compute shaders or vertex shaders for massive scale-up.

## 📊 Monitoring
Use the **Performance Tab** in the application to monitor:
- **TPS (Ticks Per Second)**: The actual frequency of simulation updates.
- **Simulation Time**: Time spent on physics and logic calculations per tick.
- **Memory Usage**: Tracking heap stability and buffer allocations.
