/**
 * Entropia 3D: Спеціалізовані шейдерні програми для візуалізації організмів.
 *
 * Колекція GLSL-шейдерів із інтегрованими ефектами високої точності:
 * - Rim Lighting: Удосконалене контурне освітлення з адаптацією інтенсивності.
 * - Energy Glow: HDR-емісія на базі енергетичних станів із ефектом розсіювання (Bloom).
 * - Specular Highlights: Дзеркальні відблиски для репрезентації об'єму та текстури.
 * - Improved Lighting Model: Апроксимація фізично коректного освітлення (PBR-inspired).
 * - State-based Effects: Візуальна модуляція згідно з когнітивним станом агента.
 * - Dynamic Pulsation: Адаптивна пульсація геометрії для імітації біологічних процесів.
 */

/**
 * Удосконалений вершинний шейдер для органічних сутностей.
 *
 * Здійснює підготовку та передачу геометричних та атрибутивних даних до фрагментної стадії:
 * - vNormal: Вектор нормалі у світових координатах (World Space).
 * - vWorldPosition: Абсолютні координати фрагмента у світовому просторі.
 * - vViewPosition: Позиція у просторі спостерігача для ефектів орієнтації.
 * - vEnergy, vGlowIntensity, vState, vInstanceColor: Динамічні атрибути інстансу.
 */
export const organismVertexShader = /* glsl */ `
  // Атрибути інстансу (Per-instance attributes)
  attribute float instanceEnergy;
  attribute float instanceGlowIntensity;
  attribute float instanceState;
  attribute vec3 instanceColor;

  // Інтерполяційні змінні (Varyings)
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec3 vViewPosition;
  varying float vEnergy;
  varying float vGlowIntensity;
  varying float vState;
  varying vec3 vInstanceColor;

  void main() {
    // Трансформація вектора нормалі у світовий простір для коректного розрахунку ілюмінації
    vNormal = normalize(normalMatrix * normal);

    // Обчислення позиції у світовому просторі з урахуванням матриці інстансу
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;

    // Розрахунок позиції у системі координат камери
    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;

    // Передача персистентних атрибутів інстансу
    vEnergy = instanceEnergy;
    vGlowIntensity = instanceGlowIntensity;
    vState = instanceState;
    vInstanceColor = instanceColor;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Удосконалений фрагментний шейдер для органічних сутностей.
 *
 * Реалізує комплексний конвеєр візуалізації (Rendering Pipeline):
 * - Advanced Rim Lighting: Багатошарова контурна підсвітка.
 * - HDR Energy Glow: Емісійне свічення енергетично стабільних структур.
 * - Specular Highlights: Розрахунок дзеркальних компонентів ілюмінації.
 * - PBR-inspired Lighting: Комбінована модель освітлення (Key + Fill).
 * - State-aware Effects: Динамічні зміни палітри та інтенсивності залежно від стану біоагента.
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

  // Детерміновані константи когнітивних станів
  const float STATE_IDLE = 0.0;
  const float STATE_SEEKING = 1.0;
  const float STATE_FLEEING = 2.0;
  const float STATE_HUNTING = 3.0;
  const float STATE_REPRODUCING = 4.0;

  // Специфікації освітлювальної моделі
  const vec3 LIGHT_DIR = normalize(vec3(1.0, 1.2, 0.8)); // Основне джерело (Key light)
  const vec3 FILL_LIGHT_DIR = normalize(vec3(-0.5, 0.3, -0.5)); // Заповнююче світло (Fill light)
  const float AMBIENT = 0.25;
  const float RIM_POWER = 2.5;
  const float RIM_INTENSITY = 1.2;
  const float SPECULAR_POWER = 32.0;
  const float SPECULAR_STRENGTH = 0.5;

  /**
   * Обчислення кольорового градієнта на основі термодинамічного стану (енергії).
   */
  vec3 energyGradient(float energy, vec3 baseColor) {
    // Критичний стан: інтенсивна червона емісія
    vec3 criticalColor = vec3(1.5, 0.1, 0.05);
    // Дефіцит енергії: теракотово-помаранчевий спектр
    vec3 lowColor = vec3(1.2, 0.4, 0.1);
    // Оптимальний рівень: бурштиново-жовтий спектр
    vec3 midColor = vec3(1.0, 0.95, 0.3);
    // Високий рівень: посилений базовий колір
    vec3 highColor = baseColor * 1.1;
    // Надлишковий рівень (HDR): максимальна емісія
    vec3 maxColor = baseColor * 1.4;

    if (energy < 0.15) {
      return mix(criticalColor, lowColor, energy / 0.15);
    } else if (energy < 0.4) {
      return mix(lowColor, midColor, (energy - 0.15) / 0.25);
    } else if (energy < 0.7) {
      return mix(midColor, highColor, (energy - 0.4) / 0.3);
    } else {
      return mix(highColor, maxColor, (energy - 0.7) / 0.3);
    }
  }

  /**
   * Розрахунок вдосконаленого контурного освітлення (Rim Lighting).
   */
  float calculateRimLighting(vec3 normal, vec3 viewDir, float energy) {
    float NdotV = max(dot(normal, viewDir), 0.0);

    // Агрегація декількох шарів rim-ефекту для м'якості переходів
    float rim1 = pow(1.0 - NdotV, RIM_POWER);
    float rim2 = pow(1.0 - NdotV, RIM_POWER * 0.6);
    float rim3 = pow(1.0 - NdotV, 1.5);

    float rim = rim1 * 0.6 + rim2 * 0.3 + rim3 * 0.1;

    // Модуляція інтенсивності залежно від внутрішньої енергії
    rim *= mix(0.7, 1.3, energy);

    return rim * RIM_INTENSITY * vGlowIntensity;
  }

  /**
   * Розрахунок дзеркальних відблисків за моделлю Блінна-Фонга.
   */
  float calculateSpecular(vec3 normal, vec3 viewDir, vec3 lightDir) {
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfDir), 0.0);
    return pow(NdotH, SPECULAR_POWER) * SPECULAR_STRENGTH;
  }

  /**
   * Комплексна модель освітлення з використанням двох джерел та Ambient Occlusion.
   */
  vec3 calculateLighting(vec3 normal, vec3 viewDir, vec3 baseColor) {
    // Дифузна складова основного джерела
    float diffuseKey = max(dot(normal, LIGHT_DIR), 0.0);
    diffuseKey = pow(diffuseKey, 0.8);

    // Дифузна складова заповнюючого джерела
    float diffuseFill = max(dot(normal, FILL_LIGHT_DIR), 0.0) * 0.4;

    // Апроксимація затінення (Ambient Occlusion)
    float ao = 0.5 + 0.5 * normal.y;

    // Сумування компонентів ілюмінації
    float totalDiffuse = diffuseKey * 0.8 + diffuseFill + AMBIENT;
    totalDiffuse *= ao;

    // Додавання дзеркальної складової
    float specular = calculateSpecular(normal, viewDir, LIGHT_DIR);

    vec3 color = baseColor * totalDiffuse;
    color += vec3(1.0, 0.98, 0.95) * specular;

    return color;
  }

  /**
   * Генерація пульсаційних ефектів згідно з поточним когнітивним станом.
   */
  float calculatePulsation(float state, float time, float energy) {
    float pulse = 0.0;
    float frequency = 0.0;
    float amplitude = 0.0;

    if (state == STATE_FLEEING) {
      // Прискорена пульсація в стані стресу/уникнення
      frequency = 18.0;
      amplitude = 0.4 + (1.0 - energy) * 0.3;
      pulse = sin(time * frequency) * amplitude;
    } else if (state == STATE_HUNTING) {
      // Аритмічна пульсація в стані полювання
      frequency = 12.0;
      float irregularity = sin(time * 2.3) * 0.3;
      amplitude = 0.3 + irregularity;
      pulse = sin(time * frequency + irregularity) * amplitude;
    } else if (state == STATE_REPRODUCING) {
      // Гармонійна пульсація в стані реплікації
      frequency = 4.0;
      amplitude = 0.5;
      pulse = sin(time * frequency) * amplitude + sin(time * frequency * 0.5) * 0.2;
    } else if (state == STATE_SEEKING) {
      // Низькочастотна пульсація в стані пошуку ресурсів
      frequency = 2.5;
      amplitude = 0.15;
      pulse = sin(time * frequency) * amplitude;
    }

    return max(pulse, 0.0);
  }

  /**
   * Розрахунок енергетичного сяйва з HDR-характеристиками.
   */
  vec3 calculateEnergyGlow(vec3 baseColor, float energy, float rim, float pulse) {
    // Визначення сили сяйва на основі енергетичного порогу
    float glowStrength = smoothstep(0.6, 1.0, energy);

    // Формування спектру емісії
    vec3 glowColor = mix(baseColor, vec3(1.0, 1.0, 0.95), 0.4);

    // Комбінований коефіцієнт інтенсивності
    float glowFactor = rim * (1.0 + glowStrength * 2.0);
    glowFactor += pulse * energy * 0.5;

    return glowColor * glowFactor * vGlowIntensity;
  }

  void main() {
    // Векторна нормалізація
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Формування базового хроматичного стану
    vec3 baseColor = energyGradient(vEnergy, vInstanceColor);

    // Генерація освітленої поверхні
    vec3 litColor = calculateLighting(normal, viewDir, baseColor);

    // Розрахунок контурної підсвітки
    float rim = calculateRimLighting(normal, viewDir, vEnergy);

    // Модуляція пульсації згідно з внутрішнім станом
    float pulse = calculatePulsation(vState, uTime, vEnergy);

    // Розрахунок енергетичного свічення
    vec3 energyGlow = calculateEnergyGlow(baseColor, vEnergy, rim, pulse);

    // Фінальна композиція кольорових каналів
    vec3 finalColor = litColor + energyGlow;

    // Інтеграція пульсаційного компонента в загальну ілюмінацію
    finalColor += baseColor * pulse * 0.25;

    // Естетичне затемнення при низьких рівнях життєвої енергії
    float energyDim = smoothstep(0.0, 0.25, vEnergy);
    finalColor *= mix(0.35, 1.0, energyDim);

    // Тональна компресія (Reinhard Tone Mapping)
    finalColor = finalColor / (finalColor + vec3(1.0));

    // Гамма-корекція результату
    finalColor = pow(finalColor, vec3(1.0 / 2.2));

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

/**
 * Вершинний шейдер для ресурсів енергії (Food Crystals).
 * Забезпечує геометрію та анімацію пульсації кристалічних структур.
 */
export const foodVertexShader = /* glsl */ `
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vPulse;

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Гармонійна деформація геометрії (пульсація масштабу)
    float pulse = sin(uTime * 3.0 + position.x * 10.0) * 0.1 + 1.0;
    vec3 animatedPosition = position * pulse;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(animatedPosition, 1.0);
    vViewPosition = -mvPosition.xyz;
    vPulse = pulse;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Фрагментний шейдер для ресурсів енергії.
 * Реалізує візуальні ефекти кристалічної прозорості та емісії.
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

    // Розрахунок ефекту Френеля для симуляції кристалічної поверхні
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);

    // Динамічна емісійна активність
    float emissive = 0.5 + sin(uTime * 4.0) * 0.3;

    // Дифузне освітлення за моделлю Ламберта
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);

    vec3 color = uColor * (0.3 + diffuse * 0.7);
    color += uEmissiveColor * emissive * 0.5;
    color += vec3(1.0, 0.95, 0.8) * fresnel * 0.4;

    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Вершинний шейдер для систем частинок (Particle Effects).
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
    // Розрахунок аттенюації розміру частинки залежно від відстані до камери
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Фрагментний шейдер для систем частинок.
 */
export const particleFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying vec3 vColor;

  void main() {
    // Генерація кругової діафрагми частинки
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    if (dist > 0.5) {
      discard;
    }

    // М'яка межа (Anti-aliasing)
    float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
    alpha *= vOpacity;

    // Концентрація яскравості в центрі (Core glow)
    float glow = 1.0 - dist * 2.0;
    vec3 color = vColor + vec3(glow * 0.3);

    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Вершинний шейдер для трейлерів руху (Ribbon Trails).
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
 * Фрагментний шейдер для трейлерів руху.
 */
export const trailFragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha * 0.6);
  }
`;

/**
 * Вершинний шейдер для середовищних зон (Environmental Zones).
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
 * Фрагментний шейдер для середовищних зон.
 * Реалізує візуалізацію кордонів зон із хвильовими ефектами.
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
    // Розрахунок радіальної відстані від епіцентру зони
    float dist = distance(vWorldPosition, uCenter);
    float normalizedDist = dist / uRadius;

    // Експоненціальне згасання інтенсивності до периферії
    float edgeFade = 1.0 - smoothstep(0.7, 1.0, normalizedDist);

    // Хвильова ілюмінація кордонів
    float wave = sin(normalizedDist * 10.0 - uTime * 2.0) * 0.5 + 0.5;

    // Ефект Френеля для посилення видимості по дотичній
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);

    float alpha = edgeFade * (0.1 + wave * 0.1 + fresnel * 0.3) * uOpacity;

    gl_FragColor = vec4(uColor, alpha);
  }
`;
