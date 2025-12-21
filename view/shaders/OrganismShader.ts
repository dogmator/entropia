
/**
 * EVOSIM 3D — Покращені Шейдери Організмів
 *
 * GLSL шейдери з покращеним візуальним якістю:
 * - Rim Lighting - просунуте контурне освітлення з налаштовуваною інтенсивністю
 * - Energy Glow - HDR свічення на основі енергії з bloom-подібним ефектом
 * - Specular Highlights - відблиски для глибини та об'єму
 * - Improved Lighting Model - PBR-подібне освітлення
 * - State-based Effects - візуальні ефекти залежно від стану
 * - Dynamic Pulsation - адаптивна пульсація
 */

/**
 * Покращений вершинний шейдер для організмів
 *
 * Передає дані для фрагментного шейдера:
 * - vNormal: нормаль для освітлення (world space)
 * - vWorldPosition: позиція у світі для advanced lighting
 * - vViewPosition: позиція для view-dependent effects
 * - vEnergy, vGlowIntensity, vState, vInstanceColor: атрибути інстансу
 */
export const organismVertexShader = /* glsl */ `
  // Атрибути інстансу
  attribute float instanceEnergy;
  attribute float instanceGlowIntensity;
  attribute float instanceState;
  attribute vec3 instanceColor;

  // Передача до фрагментного шейдера
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying float vEnergy;
  varying float vGlowIntensity;
  varying float vState;
  varying vec3 vInstanceColor;

  void main() {
    // Трансформація нормалі у світовий простір для кращого освітлення
    vNormal = normalize(normalMatrix * normal);

    // Позиція у світовому просторі
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    // Позиція у просторі виду для view-dependent ефектів
    vec4 mvPosition = viewMatrix * worldPosition;
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
 * Покращений фрагментний шейдер для організмів
 *
 * Покращення:
 * - Advanced Rim Lighting - багатошаровий rim з налаштовуваною інтенсивністю
 * - HDR Energy Glow - bloom-подібне свічення для високоенергетичних організмів
 * - Specular Highlights - відблиски для реалістичності
 * - PBR-inspired Lighting - покращена модель освітлення
 * - State-aware Effects - динамічні ефекти залежно від стану
 */
export const organismFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
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

  // Константи освітлення
  const vec3 LIGHT_DIR = normalize(vec3(1.0, 1.2, 0.8));
  const vec3 FILL_LIGHT_DIR = normalize(vec3(-0.5, 0.3, -0.5));
  const float AMBIENT = 0.25;
  const float RIM_POWER = 2.5;
  const float RIM_INTENSITY = 1.2;
  const float SPECULAR_POWER = 32.0;
  const float SPECULAR_STRENGTH = 0.5;

  /**
   * Плавний градієнт енергії з HDR значеннями для glow
   */
  vec3 energyGradient(float energy, vec3 baseColor) {
    // Критична енергія: інтенсивний червоний
    vec3 criticalColor = vec3(1.5, 0.1, 0.05);
    // Низька енергія: помаранчевий
    vec3 lowColor = vec3(1.2, 0.4, 0.1);
    // Середня енергія: жовтий
    vec3 midColor = vec3(1.0, 0.95, 0.3);
    // Висока енергія: базовий колір з легким boost
    vec3 highColor = baseColor * 1.1;
    // Максимальна енергія: яскравий bloom
    vec3 maxColor = baseColor * 1.4;

    if (energy < 0.15) {
      // Критична зона
      return mix(criticalColor, lowColor, energy / 0.15);
    } else if (energy < 0.4) {
      // Низька енергія
      return mix(lowColor, midColor, (energy - 0.15) / 0.25);
    } else if (energy < 0.7) {
      // Середня енергія
      return mix(midColor, highColor, (energy - 0.4) / 0.3);
    } else {
      // Висока енергія з HDR glow
      return mix(highColor, maxColor, (energy - 0.7) / 0.3);
    }
  }

  /**
   * Advanced Rim Lighting з багатошаровим ефектом
   */
  float calculateRimLighting(vec3 normal, vec3 viewDir, float energy) {
    float NdotV = max(dot(normal, viewDir), 0.0);

    // Основний rim
    float rim1 = pow(1.0 - NdotV, RIM_POWER);
    // Вторинний м'якший rim для глибини
    float rim2 = pow(1.0 - NdotV, RIM_POWER * 0.6);
    // Третій дуже м'який rim для ambient occlusion
    float rim3 = pow(1.0 - NdotV, 1.5);

    // Комбінуємо шари з різними вагами
    float rim = rim1 * 0.6 + rim2 * 0.3 + rim3 * 0.1;

    // Посилюємо rim для високоенергетичних організмів
    rim *= mix(0.7, 1.3, energy);

    return rim * RIM_INTENSITY * vGlowIntensity;
  }

  /**
   * Specular highlights (Blinn-Phong)
   */
  float calculateSpecular(vec3 normal, vec3 viewDir, vec3 lightDir) {
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    return pow(NdotH, SPECULAR_POWER) * SPECULAR_STRENGTH;
  }

  /**
   * Improved lighting model з key + fill lights
   */
  vec3 calculateLighting(vec3 normal, vec3 viewDir, vec3 baseColor) {
    // Key light (основне освітлення)
    float diffuseKey = max(dot(normal, LIGHT_DIR), 0.0);
    diffuseKey = pow(diffuseKey, 0.8); // Soft falloff

    // Fill light (заповнююче освітлення)
    float diffuseFill = max(dot(normal, FILL_LIGHT_DIR), 0.0) * 0.4;

    // Ambient occlusion approximation
    float ao = 0.5 + 0.5 * normal.y;

    // Комбінуємо
    float totalDiffuse = diffuseKey * 0.8 + diffuseFill + AMBIENT;
    totalDiffuse *= ao;

    // Specular
    float specular = calculateSpecular(normal, viewDir, LIGHT_DIR);

    vec3 color = baseColor * totalDiffuse;
    color += vec3(1.0, 0.98, 0.95) * specular;

    return color;
  }

  /**
   * State-based pulsation з адаптивними параметрами
   */
  float calculatePulsation(float state, float time, float energy) {
    float pulse = 0.0;
    float frequency = 0.0;
    float amplitude = 0.0;

    if (state == STATE_FLEEING) {
      // Панічна швидка пульсація
      frequency = 18.0;
      amplitude = 0.4 + (1.0 - energy) * 0.3; // Сильніша при низькій енергії
      pulse = sin(time * frequency) * amplitude;
    } else if (state == STATE_HUNTING) {
      // Агресивна нерегулярна пульсація
      frequency = 12.0;
      float irregularity = sin(time * 2.3) * 0.3;
      amplitude = 0.3 + irregularity;
      pulse = sin(time * frequency + irregularity) * amplitude;
    } else if (state == STATE_REPRODUCING) {
      // М'яка ритмічна пульсація
      frequency = 4.0;
      amplitude = 0.5;
      pulse = sin(time * frequency) * amplitude + sin(time * frequency * 0.5) * 0.2;
    } else if (state == STATE_SEEKING) {
      // Легка пульсація пошуку
      frequency = 2.5;
      amplitude = 0.15;
      pulse = sin(time * frequency) * amplitude;
    }

    return max(pulse, 0.0); // Тільки позитивна пульсація
  }

  /**
   * Energy glow з HDR bloom-подібним ефектом
   */
  vec3 calculateEnergyGlow(vec3 baseColor, float energy, float rim, float pulse) {
    // HDR glow для високоенергетичних організмів
    float glowStrength = smoothstep(0.6, 1.0, energy);

    // Bloom-подібний ефект
    vec3 glowColor = mix(baseColor, vec3(1.0, 1.0, 0.95), 0.4);

    // Комбінуємо rim і energy для glow
    float glowFactor = rim * (1.0 + glowStrength * 2.0);
    glowFactor += pulse * energy * 0.5;

    return glowColor * glowFactor * vGlowIntensity;
  }

  void main() {
    // Нормалізовані вектори
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Базовий колір з енергетичним градієнтом
    vec3 baseColor = energyGradient(vEnergy, vInstanceColor);

    // Розрахунок освітлення
    vec3 litColor = calculateLighting(normal, viewDir, baseColor);

    // Advanced rim lighting
    float rim = calculateRimLighting(normal, viewDir, vEnergy);

    // State-based pulsation
    float pulse = calculatePulsation(vState, uTime, vEnergy);

    // Energy glow з HDR
    vec3 energyGlow = calculateEnergyGlow(baseColor, vEnergy, rim, pulse);

    // Фінальний колір
    vec3 finalColor = litColor + energyGlow;

    // Додаємо пульсацію до загального освітлення
    finalColor += baseColor * pulse * 0.25;

    // Затемнення для низькоенергетичних організмів
    float energyDim = smoothstep(0.0, 0.25, vEnergy);
    finalColor *= mix(0.35, 1.0, energyDim);

    // HDR tone mapping (simple Reinhard)
    finalColor = finalColor / (finalColor + vec3(1.0));

    // Gamma correction
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    gl_FragColor = vec4(finalColor, uOpacity);
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
