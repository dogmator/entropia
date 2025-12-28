/**
 * Entropia 3D — Central registry of deterministic configuration parameters.
 *
 * Re-exports all constants from modular configuration files.
 * This index maintains backward compatibility with existing imports.
 */

// World geometry
export * from './world.constants';

// Population and resources
export * from './population.constants';

// Metabolic processes
export * from './metabolic.constants';

// Reproduction
export * from './reproduction.constants';

// Physics and interactions
export * from './physics.constants';

// Genetics
export * from './genetics.constants';

// Ecological zones
export * from './zones.constants';

// Rendering and visuals
export * from './rendering.constants';

// UI configuration
export * from './ui.constants';

// Engine internals
export * from './engine.constants';

// Performance and optimization
export * from './performance.constants';

// World configuration function
export * from './world.config';
