
/**
 * Entropia 3D — Компонент візуалізації космічного фону.
 *
 * Забезпечує створення атмосферного візуального контексту, що включає:
 * - Масив зірок (багатокомпонентне зоряне поле)
 * - Процедурні туманності (динамічні градієнти на основі фрактального шуму)
 * - Анімовані ефекти мерехтіння
 * - Ефекти просторової глибини та паралакса
 */

import * as THREE from 'three';

import { COSMIC_BACKGROUND_CONSTANTS } from '@/config';

// ============================================================================
// ОПИС ШЕЙДЕРНИХ ПРОГРАМ ДЛЯ ВІЗУАЛІЗАЦІЇ ЗІРОК
// ============================================================================

const starVertexShader = /* glsl */ `
  attribute float size;
  attribute float brightness;
  attribute float twinkleSpeed;
  attribute float twinkleOffset;

  uniform float uTime;

  varying float vBrightness;

  void main() {
    // Математична модель мерехтіння на основі гармонічних коливань
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
    // Формування кругової геометрії з градієнтним розмиттям країв
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) discard;

    // Визначення центрального ядра високої інтенсивності
    float core = 1.0 - smoothstep(0.0, 0.2, dist);
    // Розрахунок периферійного гало
    float halo = 1.0 - smoothstep(0.2, 0.5, dist);

    float alpha = (core * 0.8 + halo * 0.2) * vBrightness;

    // Колірна схема: спектральний білий з хроматичною аберацією в блакитний
    vec3 color = vec3(0.95, 0.97, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// ОПИС ШЕЙДЕРНИХ ПРОГРАМ ДЛЯ ВІЗУАЛІЗАЦІЇ ТУМАННОСТЕЙ
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

  // Реалізація функції шуму Simplex (Simplex Noise)
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

  // Розрахунок фрактального броунівського руху (fBm)
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

    // Генерація багатошарового фрактального шуму
    float n1 = fbm(pos);
    float n2 = fbm(pos * 2.0 + vec3(100.0));
    float n3 = fbm(pos * 0.5 + vec3(200.0));

    // Синтез результуючого значення шуму
    float noise = (n1 + n2 * 0.5 + n3 * 0.25) / 1.75;
    noise = noise * 0.5 + 0.5; // Нормалізація в діапазон [0, 1]

    // Колірна інтерполяція (мікшування спектральних компонент)
    vec3 color = mix(uColor1, uColor2, noise);
    color = mix(color, uColor3, n2 * 0.5 + 0.5);

    // Розрахунок градієнтного затухання до периферичних областей
    float edge = 1.0 - length(vUv - 0.5) * 2.0;
    edge = smoothstep(0.0, 0.5, edge);

    float alpha = noise * 0.15 * edge;

    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// ОСНОВНА ПРЕДСТАВНИЦЬКА ЛОГІКА КЛАСУ
// ============================================================================

/**
 * Клас управління космічним фоном (зірки та туманності).
 */
export class CosmicBackground {
  private readonly scene: THREE.Scene;

  private starField: THREE.Points | null = null;
  private nebulaMesh: THREE.Mesh | null = null;
  private time: number = 0;

  // Посилання на дескриптори матеріалів для динамічного оновлення параметрів
  private starMaterial: THREE.ShaderMaterial | null = null;
  private nebulaMaterial: THREE.ShaderMaterial | null = null;

  // Nebula palette constants
  private static readonly NEBULA_COLORS = {
    PURPLE: 0x1a0a2e,
    INDIGO: 0x16213e,
    BLUE: 0x0f3460,
  } as const;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createStarField();
    this.createNebula();
  }

  // ============================================================================
  // МЕТОДИ ІНІЦІАЛІЗАЦІЇ КОМПОНЕНТІВ
  // ============================================================================

  /**
   * Створення та конфігурація зоряного поля.
   */
  private createStarField(): void {
    const starCount = COSMIC_BACKGROUND_CONSTANTS.STAR_COUNT;

    // Ініціалізація типізованих буферів даних
    const positions = new Float32Array(starCount * COSMIC_BACKGROUND_CONSTANTS.VECTOR3_COMPONENTS);
    const sizes = new Float32Array(starCount);
    const brightnesses = new Float32Array(starCount);
    const twinkleSpeeds = new Float32Array(starCount);
    const twinkleOffsets = new Float32Array(starCount);

    // Процедурна генерація просторового розміщення зірок у сферичному домені
    const radius = COSMIC_BACKGROUND_CONSTANTS.STAR_RADIUS;
    for (let i = 0; i < starCount; i++) {
      // Побудова рівномірного розподілу на сфері з використанням полярних координат
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const theta = Math.random() * COSMIC_BACKGROUND_CONSTANTS.TWO_PI;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const phi = Math.acos(COSMIC_BACKGROUND_CONSTANTS.VECTOR2_MULTIPLIER * Math.random() - COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT);
      /* eslint-disable-next-line sonarjs/pseudo-random */
      const r = radius * (COSMIC_BACKGROUND_CONSTANTS.STAR_RADIUS_MIN_FACTOR + Math.random() * COSMIC_BACKGROUND_CONSTANTS.STAR_RADIUS_VARIATION);

      positions[i * COSMIC_BACKGROUND_CONSTANTS.VECTOR3_COMPONENTS] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * COSMIC_BACKGROUND_CONSTANTS.VECTOR3_COMPONENTS + COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * COSMIC_BACKGROUND_CONSTANTS.VECTOR3_COMPONENTS + COSMIC_BACKGROUND_CONSTANTS.VECTOR2_MULTIPLIER] = r * Math.cos(phi);

      // Визначення масштабу: експоненціальний розподіл (домінування малих об'єктів)
      /* eslint-disable-next-line sonarjs/pseudo-random */
      sizes[i] = Math.pow(Math.random(), COSMIC_BACKGROUND_CONSTANTS.STAR_SIZE_POWER) * COSMIC_BACKGROUND_CONSTANTS.STAR_SIZE_MULTIPLIER + COSMIC_BACKGROUND_CONSTANTS.STAR_SIZE_BASE;

      // Встановлення базової фотометричної яскравості
      /* eslint-disable-next-line sonarjs/pseudo-random */
      brightnesses[i] = COSMIC_BACKGROUND_CONSTANTS.STAR_BRIGHTNESS_BASE + Math.random() * COSMIC_BACKGROUND_CONSTANTS.STAR_BRIGHTNESS_VARIATION;

      // Параметризація характеристик мерехтіння
      /* eslint-disable-next-line sonarjs/pseudo-random */
      twinkleSpeeds[i] = COSMIC_BACKGROUND_CONSTANTS.STAR_TWINKLE_BASE + Math.random() * COSMIC_BACKGROUND_CONSTANTS.STAR_TWINKLE_VARIATION;
      /* eslint-disable-next-line sonarjs/pseudo-random */
      twinkleOffsets[i] = Math.random() * COSMIC_BACKGROUND_CONSTANTS.TWO_PI;
    }

    // Формування буферної геометрії
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, COSMIC_BACKGROUND_CONSTANTS.VECTOR3_COMPONENTS));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT));
    geometry.setAttribute('brightness', new THREE.BufferAttribute(brightnesses, COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT));
    geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT));
    geometry.setAttribute('twinkleOffset', new THREE.BufferAttribute(twinkleOffsets, COSMIC_BACKGROUND_CONSTANTS.SINGLE_COMPONENT));

    // Конфігурація шейдерного матеріалу
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
   * Створення та налаштування візуалізації туманності.
   */
  private createNebula(): void {
    // Ініціалізація сферичного домену великого радіуса для проекції туманності
    const geometry = new THREE.SphereGeometry(COSMIC_BACKGROUND_CONSTANTS.NEBULA_RADIUS, COSMIC_BACKGROUND_CONSTANTS.NEBULA_SEGMENTS, COSMIC_BACKGROUND_CONSTANTS.NEBULA_SEGMENTS);

    // Визначення спектральної палітри туманності
    const color1 = new THREE.Color(CosmicBackground.NEBULA_COLORS.PURPLE); // Спектральний фіолетовий
    const color2 = new THREE.Color(CosmicBackground.NEBULA_COLORS.INDIGO); // Глибокий індиго
    const color3 = new THREE.Color(CosmicBackground.NEBULA_COLORS.BLUE); // Насичений небесно-синій

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
  // МЕТОДИ ОНОВЛЕННЯ СТАНУ
  // ============================================================================

  /**
   * Оновлення внутрішніх параметрів анімації.
   */
  public update(deltaTime: number): void {
    this.time += deltaTime;

    // Синхронізація часових параметрів у шейдерних програмах
    if (this.starMaterial && this.starMaterial.uniforms['uTime']) {
      this.starMaterial.uniforms['uTime'].value = this.time;
    }

    if (this.nebulaMaterial && this.nebulaMaterial.uniforms['uTime']) {
      this.nebulaMaterial.uniforms['uTime'].value = this.time;
    }

    // Модуляція кутового зміщення туманності (повільна ротація)
    if (this.nebulaMesh) {
      this.nebulaMesh.rotation.y += deltaTime * COSMIC_BACKGROUND_CONSTANTS.NEBULA_ROTATION_Y;
      this.nebulaMesh.rotation.x += deltaTime * COSMIC_BACKGROUND_CONSTANTS.NEBULA_ROTATION_X;
    }
  }

  // ============================================================================
  // МЕТОДИ ДЕСТРУКЦІЇ ТА ОЧИЩЕННЯ РЕСУРСІВ
  // ============================================================================

  /**
   * Термінальне вивільнення ресурсів об'єкта.
   */
  public dispose(): void {
    if (this.starField) {
      this.scene.remove(this.starField);
      this.starField.geometry.dispose();
      if (this.starMaterial) { this.starMaterial.dispose(); }
    }

    if (this.nebulaMesh) {
      this.scene.remove(this.nebulaMesh);
      this.nebulaMesh.geometry.dispose();
      if (this.nebulaMaterial) { this.nebulaMaterial.dispose(); }
    }
  }
}
