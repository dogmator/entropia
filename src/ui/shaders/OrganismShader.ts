/**
 * Entropia 3D: Specialized shader programs for organism visualization.
 *
 * Collection of GLSL shaders with integrated high-precision effects:
 * - Rim Lighting: Advanced contour lighting with intensity adaptation.
 * - Energy Glow: HDR emission based on energy states with dispersion (Bloom).
 * - Specular Highlights: Specular highlights for volume and texture representation.
 * - Improved Lighting Model: Physical light approximation (PBR-inspired).
 * - State-based Effects: Visual modulation according to agent cognitive state.
 * - Dynamic Pulsation: Adaptive geometry pulsation to mimic biological processes.
 */

/**
 * Vertex shader for particle systems (Particle Effects).
 */
export const particleVertexShader = /* glsl */ `
  attribute float size;
  attribute float opacity;
  attribute vec3 color;

  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    vOpacity = opacity;
    vColor = color;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Calculation of particle size attenuation depending on distance to camera
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Fragment shader for particle systems.
 */
export const particleFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Generation of circular particle aperture
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) {
      discard;
    }

    // Soft boundary (Anti-aliasing)
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    alpha *= vOpacity;

    // Brightness concentration in center (Core glow)
    float glow = 1.0 - dist * 2.0;
    vec3 color = vColor + vec3(glow * 0.3);

    gl_FragColor = vec4(color, alpha);
  }
`;
