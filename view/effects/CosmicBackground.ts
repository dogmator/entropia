
/**
 * EVOSIM 3D — Космічний Фон
 *
 * Створює атмосферний космічний фон з:
 * - Зоряним полем (тисячі зірок)
 * - Туманностями (процедурні градієнти)
 * - Анімованим мерехтінням
 * - Глибиною та паралаксом
 */

import * as THREE from 'three';

// ============================================================================
// ШЕЙДЕРИ ДЛЯ ЗІРОК
// ============================================================================

const starVertexShader = /* glsl */ `
  attribute float size;
  attribute float brightness;
  attribute float twinkleSpeed;
  attribute float twinkleOffset;

  uniform float uTime;

  varying float vBrightness;

  void main() {
    // Мерехтіння
    float twinkle = sin(uTime * twinkleSpeed + twinkleOffset) * 0.3 + 0.7;
    vBrightness = brightness * twinkle;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (1000.0 / -mvPosition.z) * vBrightness;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = /* glsl */ `
  varying float vBrightness;

  void main() {
    // Кругла форма з м'якими краями
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    // Центральне яскраве ядро
    float core = 1.0 - smoothstep(0.0, 0.2, dist);
    // М'яке гало
    float halo = 1.0 - smoothstep(0.2, 0.5, dist);

    float alpha = (core * 0.8 + halo * 0.2) * vBrightness;

    // Білий з легким відтінком
    vec3 color = vec3(0.95, 0.97, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// ШЕЙДЕРИ ДЛЯ ТУМАННОСТІ
// ============================================================================

const nebulaVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  varying vec2 vUv;
  varying vec3 vPosition;

  // Simplex noise function
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;

    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  void main() {
    vec3 pos = vPosition * 0.002;
    pos.z += uTime * 0.02;

    // Багатошаровий шум
    float n1 = fbm(pos);
    float n2 = fbm(pos * 2.0 + vec3(100.0));
    float n3 = fbm(pos * 0.5 + vec3(200.0));

    // Комбінування шумів
    float noise = (n1 + n2 * 0.5 + n3 * 0.25) / 1.75;
    noise = noise * 0.5 + 0.5; // Нормалізація до [0, 1]

    // Змішування кольорів
    vec3 color = mix(uColor1, uColor2, noise);
    color = mix(color, uColor3, n2 * 0.5 + 0.5);

    // Затухання до країв
    float edge = 1.0 - length(vUv - 0.5) * 2.0;
    edge = smoothstep(0.0, 0.5, edge);

    float alpha = noise * 0.15 * edge;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// ГОЛОВНИЙ КЛАС
// ============================================================================

/**
 * Космічний фон з зірками та туманностями
 */
export class CosmicBackground {
  private readonly scene: THREE.Scene;

  private starField: THREE.Points | null = null;
  private nebulaMesh: THREE.Mesh | null = null;
  private time: number = 0;

  // Матеріали для оновлення uniform-ів
  private starMaterial: THREE.ShaderMaterial | null = null;
  private nebulaMaterial: THREE.ShaderMaterial | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createStarField();
    this.createNebula();
  }

  // ============================================================================
  // СТВОРЕННЯ ЕЛЕМЕНТІВ
  // ============================================================================

  /**
   * Створити зоряне поле
   */
  private createStarField(): void {
    const starCount = 3000;

    // Буфери
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const brightnesses = new Float32Array(starCount);
    const twinkleSpeeds = new Float32Array(starCount);
    const twinkleOffsets = new Float32Array(starCount);

    // Генерація зірок у сфері
    const radius = 2000;
    for (let i = 0; i < starCount; i++) {
      // Рівномірний розподіл на сфері
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.8 + Math.random() * 0.4);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Розмір: більшість маленькі, декілька великих
      sizes[i] = Math.pow(Math.random(), 3) * 3 + 0.5;

      // Яскравість
      brightnesses[i] = 0.5 + Math.random() * 0.5;

      // Мерехтіння
      twinkleSpeeds[i] = 1 + Math.random() * 3;
      twinkleOffsets[i] = Math.random() * Math.PI * 2;
    }

    // Геометрія
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, 1));
    geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geometry.setAttribute('twinkleOffset', new THREE.BufferAttribute(twinkleOffsets, 1));

    // Матеріал
    this.starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.starField = new THREE.Points(geometry, this.starMaterial);
    this.scene.add(this.starField);
  }

  /**
   * Створити туманність
   */
  private createNebula(): void {
    // Велика сфера для туманності
    const geometry = new THREE.SphereGeometry(1800, 64, 64);

    // Кольори туманності (космічні відтінки)
    const color1 = new THREE.Color(0x1a0a2e); // Глибокий фіолетовий
    const color2 = new THREE.Color(0x16213e); // Темно-синій
    const color3 = new THREE.Color(0x0f3460); // Синій

    this.nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: color1 },
        uColor2: { value: color2 },
        uColor3: { value: color3 },
      },
      vertexShader: nebulaVertexShader,
      fragmentShader: nebulaFragmentShader,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.nebulaMesh = new THREE.Mesh(geometry, this.nebulaMaterial);
    this.scene.add(this.nebulaMesh);
  }

  // ============================================================================
  // ОНОВЛЕННЯ
  // ============================================================================

  /**
   * Оновити анімацію
   */
  update(deltaTime: number): void {
    this.time += deltaTime;

    if (this.starMaterial) {
      this.starMaterial.uniforms.uTime.value = this.time;
    }

    if (this.nebulaMaterial) {
      this.nebulaMaterial.uniforms.uTime.value = this.time;
    }

    // Повільне обертання туманності
    if (this.nebulaMesh) {
      this.nebulaMesh.rotation.y += deltaTime * 0.01;
      this.nebulaMesh.rotation.x += deltaTime * 0.005;
    }
  }

  // ============================================================================
  // ОЧИЩЕННЯ
  // ============================================================================

  /**
   * Знищити фон
   */
  dispose(): void {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      if (this.starMaterial) this.starMaterial.dispose();
    }

    if (this.nebulaMesh) {
      this.scene.remove(this.nebulaMesh);
      this.nebulaMesh.geometry.dispose();
      if (this.nebulaMaterial) this.nebulaMaterial.dispose();
    }
  }
}
