
/**
 * EVOSIM 3D — Шейдери Організмів
 *
 * Кастомні GLSL шейдери для:
 * - Енергетичних градієнтів (зелений→жовтий→червоний)
 * - Fresnel ефекту для контурного свічення
 * - Пульсації на основі стану організму
 * - Візуальних мутацій
 */

/**
 * Вершинний шейдер для організмів
 *
 * Передає дані для фрагментного шейдера:
 * - vNormal: нормаль для освітлення
 * - vEnergy: нормалізована енергія
 * - vViewDir: напрямок до камери для Fresnel
 */
export const organismVertexShader = /* glsl */ `
  // Атрибути інстансу
  attribute float instanceEnergy;
  attribute float instanceGlowIntensity;
  attribute float instanceState;
  attribute vec3 instanceColor;

  // Передача до фрагментного шейдера
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vEnergy;
  varying float vGlowIntensity;
  varying float vState;
  varying vec3 vInstanceColor;

  void main() {
    // Трансформація нормалі
    vNormal = normalize(normalMatrix * normal);

    // Позиція у просторі виду
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    // Передача атрибутів інстансу
    vEnergy = instanceEnergy;
    vGlowIntensity = instanceGlowIntensity;
    vState = instanceState;
    vInstanceColor = instanceColor;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Фрагментний шейдер для організмів
 *
 * Реалізує:
 * - Градієнт кольору на основі енергії
 * - Fresnel ефект для контурного свічення
 * - Пульсацію для активних станів
 */
export const organismFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vEnergy;
  varying float vGlowIntensity;
  varying float vState;
  varying vec3 vInstanceColor;

  // Константи станів
  const float STATE_IDLE = 0.0;
  const float STATE_SEEKING = 1.0;
  const float STATE_FLEEING = 2.0;
  const float STATE_HUNTING = 3.0;
  const float STATE_REPRODUCING = 4.0;

  // Функція для змішування кольорів енергії
  vec3 energyGradient(float energy, vec3 baseColor) {
    // Низька енергія: червоний → помаранчевий
    vec3 lowColor = vec3(1.0, 0.2, 0.1);
    // Середня енергія: жовтий
    vec3 midColor = vec3(1.0, 0.9, 0.2);
    // Висока енергія: базовий колір (зелений для травоїдних)
    vec3 highColor = baseColor;

    if (energy < 0.3) {
      return mix(lowColor, midColor, energy / 0.3);
    } else if (energy < 0.6) {
      return mix(midColor, highColor, (energy - 0.3) / 0.3);
    } else {
      return highColor;
    }
  }

  void main() {
    // Нормалізовані вектори
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Базовий колір на основі енергії
    vec3 baseColor = energyGradient(vEnergy, vInstanceColor);

    // Fresnel ефект для контурного свічення
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    fresnel *= vGlowIntensity;

    // Пульсація на основі стану
    float pulse = 0.0;

    if (vState == STATE_FLEEING) {
      // Швидка пульсація при втечі
      pulse = sin(uTime * 15.0) * 0.3 + 0.3;
    } else if (vState == STATE_HUNTING) {
      // Агресивна пульсація при полюванні
      pulse = sin(uTime * 10.0) * 0.2 + 0.2;
    } else if (vState == STATE_REPRODUCING) {
      // М'яка пульсація при розмноженні
      pulse = sin(uTime * 5.0) * 0.4 + 0.4;
    } else if (vState == STATE_SEEKING) {
      // Легка пульсація при пошуку
      pulse = sin(uTime * 3.0) * 0.1 + 0.1;
    }

    // Просте освітлення (Phong)
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);
    float ambient = 0.3;
    float lighting = ambient + diffuse * 0.7;

    // Фінальний колір
    vec3 color = baseColor * lighting;

    // Додаємо Fresnel свічення
    vec3 glowColor = mix(baseColor, vec3(1.0), 0.5);
    color += glowColor * fresnel * 0.6;

    // Додаємо пульсацію
    color += baseColor * pulse * 0.3;

    // Низька енергія — більш тьмяний
    float energyDim = smoothstep(0.0, 0.2, vEnergy);
    color *= mix(0.4, 1.0, energyDim);

    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Вершинний шейдер для їжі (енергокристалів)
 */
export const foodVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vPulse;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Анімація пульсації розміру
    float pulse = sin(uTime * 3.0 + position.x * 10.0) * 0.1 + 1.0;
    vec3 animatedPosition = position * pulse;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(animatedPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    vPulse = pulse;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Фрагментний шейдер для їжі
 */
export const foodFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uEmissiveColor;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vPulse;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel для кристалічного ефекту
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);

    // Емісивне свічення
    float emissive = 0.5 + sin(uTime * 4.0) * 0.3;

    // Простий Phong
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);

    vec3 color = uColor * (0.3 + diffuse * 0.7);
    color += uEmissiveColor * emissive * 0.5;
    color += vec3(1.0, 0.95, 0.8) * fresnel * 0.4;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Вершинний шейдер для частинок ефектів
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
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Фрагментний шейдер для частинок
 */
export const particleFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Кругла форма частинки
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) {
      discard;
    }

    // М'які краї
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    alpha *= vOpacity;

    // Свічення в центрі
    float glow = 1.0 - dist * 2.0;
    vec3 color = vColor + vec3(glow * 0.3);

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Вершинний шейдер для стрічкових слідів
 */
export const trailVertexShader = /* glsl */ `
  attribute float alpha;
  attribute vec3 color;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vAlpha = alpha;
    vColor = color;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Фрагментний шейдер для стрічкових слідів
 */
export const trailFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha * 0.6);
  }
`;

/**
 * Вершинний шейдер для екологічних зон
 */
export const zoneVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

/**
 * Фрагментний шейдер для екологічних зон
 */
export const zoneFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRadius;
  uniform vec3 uCenter;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    // Відстань від центру зони
    float dist = distance(vWorldPosition, uCenter);
    float normalizedDist = dist / uRadius;

    // Затухання до країв
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, normalizedDist);

    // Анімована хвиля
    float wave = sin(normalizedDist * 10.0 - uTime * 2.0) * 0.5 + 0.5;

    // Fresnel для країв
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);

    float alpha = edgeFade * (0.1 + wave * 0.1 + fresnel * 0.3) * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
