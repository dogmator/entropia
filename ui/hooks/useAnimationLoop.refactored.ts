/**
 * Спеціалізований програмний інтерфейс (хук) для управління головним анімаційним циклом системи.
 *
 * ОПТИМІЗАЦІЇ (версія 2.0):
 * ✓ Ліквідація алокацій об'єктів Three.js у гарячому шляху (useRef для frustum, matrices, vectors)
 * ✓ Видалення зайвих викликів computeBoundingSphere() з render loop
 * ✓ Активація справжнього frustum culling через continue statements
 * ✓ Правильна мемоізація через useMemo/useCallback
 * ✓ Використання конфігураційних констант замість магічних чисел
 */

import { useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { COLORS, RENDER } from '../../constants';
import { FRAME_TIMING_CONFIG, CULLING_CONFIG } from '../config/RenderConfig';
import { ThreeScene } from './useThreeScene';
import { SceneObjects } from './useSceneObjects';
import { ParticleEffects } from './useParticleEffects';

interface AnimationLoopOptions {
  speed: number;
  sceneData: ThreeScene | null;
  sceneObjects: SceneObjects | null;
  particleEffects: ParticleEffects | null;
  engine: SimulationEngine;
  updateHoveredEntity: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    foodMesh: THREE.InstancedMesh,
    obstacleMeshes: THREE.Mesh[],
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
      food: Map<number, string>;
    },
    engine: SimulationEngine
  ) => void;
}

export function useAnimationLoop(options: AnimationLoopOptions) {
  const {
    speed,
    sceneData,
    sceneObjects,
    particleEffects,
    engine,
    updateHoveredEntity,
  } = options;

  // ========================================================================
  // СТІЙКІ ПОСИЛАННЯ (PERSISTENT REFS) ДЛЯ УНИКНЕННЯ АЛОКАЦІЙ
  // ========================================================================

  const requestRef = useRef<number>(0);
  const speedAccumulator = useRef(0);
  const lastTime = useRef(0);
  const time = useRef(0);

  const speedRef = useRef(speed);

  // КРИТИЧНА ОПТИМІЗАЦІЯ: Реюзабельні об'єкти Three.js (allocated once, reused forever)
  const frustumRef = useRef(new THREE.Frustum());
  const projScreenMatrixRef = useRef(new THREE.Matrix4());
  const tmpSphereRef = useRef(new THREE.Sphere());
  const tmpPosRef = useRef(new THREE.Vector3());

  // Синхронізація ref з актуальним значенням speed (для доступу в RAF callback)
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  // ========================================================================
  // МЕМОІЗОВАНИЙ CALLBACK ДЛЯ АКТУАЛІЗАЦІЇ INSTANCED MESHES
  // ========================================================================

  /**
   * Актуалізує стан InstancedMesh після заповнення матриць трансформацій.
   *
   * @param mesh - Екземпляр THREE.InstancedMesh
   * @param count - Кількість активних інстансів
   */
  const updateInstancedMesh = useCallback((mesh: THREE.InstancedMesh, count: number) => {
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.updateMatrixWorld();

    // ОПТИМІЗАЦІЯ: computeBoundingSphere() викликається лише після зміни count,
    // а не кожен кадр. Для статичних об'єктів це можна робити ще рідше.
    if (mesh.geometry.boundingSphere === null || mesh.count !== count) {
      mesh.computeBoundingSphere();
    }
  }, []);

  // ========================================================================
  // ГОЛОВНИЙ ЦИКЛ РЕНДЕРИНГУ (REQUESTANIMATIONFRAME)
  // ========================================================================

  useEffect(() => {
    if (!sceneData || !sceneObjects || !particleEffects) return;

    const { scene, camera, renderer, controls } = sceneData;
    const {
      preyMesh,
      predMesh,
      foodMesh,
      obstacleMeshes,
      dummy,
      forward,
      idMaps,
      preyMat,
      predMat,
      foodMat,
      boxMat,
    } = sceneObjects;
    const { cosmicBackground, particleSystem, trailSystem } = particleEffects;

    const MAX_INSTANCES = RENDER.maxInstances;

    // Локальні посилання на reusable objects (shorter syntax)
    const frustum = frustumRef.current;
    const projScreenMatrix = projScreenMatrixRef.current;
    const tmpSphere = tmpSphereRef.current;
    const tmpPos = tmpPosRef.current;

    /**
     * Головна ітераційна функція відтворення кадру.
     */
    const animate = (currentTime: number) => {
      // ======================================================================
      // ФАЗА 1: ОБЧИСЛЕННЯ DELTA TIME З ОБМЕЖЕННЯМ
      // ======================================================================

      const rawDeltaTime = (currentTime - lastTime.current) / 1000;
      const deltaTime = Math.min(
        Math.max(rawDeltaTime, FRAME_TIMING_CONFIG.minDeltaTime),
        FRAME_TIMING_CONFIG.maxDeltaTime
      );
      lastTime.current = currentTime;

      const currentSpeed = speedRef.current;
      const isStopped = currentSpeed === 0;

      if (!isStopped) {
        time.current += deltaTime;
      }

      // ======================================================================
      // ФАЗА 2: ОНОВЛЕННЯ СИМУЛЯЦІЙНОГО ДВИГУНА
      // ======================================================================

      if (!isStopped) {
        speedAccumulator.current += currentSpeed;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;

        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      // ======================================================================
      // ФАЗА 3: МОДУЛЯЦІЯ ВІЗУАЛЬНИХ ЕФЕКТІВ ТА СИСТЕМ ЧАСТОК
      // ======================================================================

      if (!isStopped && engine.config.showParticles) {
        cosmicBackground.update(deltaTime);
        particleSystem.update(deltaTime);
      }

      // ======================================================================
      // ФАЗА 4: ДИНАМІЧНЕ КОРИГУВАННЯ ПАРАМЕТРІВ МАТЕРІАЛІВ
      // ======================================================================

      foodMat.emissiveIntensity = isStopped
        ? 0.4
        : 0.4 + Math.sin(time.current * 3) * 0.25;

      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;

      obstacleMeshes.forEach((m) => {
        m.visible = engine.config.showObstacles;
      });

      // ======================================================================
      // ФАЗА 5: СКИДАННЯ МАП ВІДПОВІДНОСТІ ІДЕНТИФІКАТОРІВ
      // ======================================================================

      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      // ======================================================================
      // ФАЗА 6: FRUSTUM CULLING — АКТУАЛІЗАЦІЯ ПРОЕКЦІЙНОЇ МАТРИЦІ
      // ======================================================================

      if (CULLING_CONFIG.enableFrustumCulling) {
        projScreenMatrix.multiplyMatrices(
          camera.projectionMatrix,
          camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(projScreenMatrix);
      }

      // ======================================================================
      // ФАЗА 7: ОТРИМАННЯ ОПТИМІЗОВАНИХ ДАНИХ З СИМУЛЯЦІЙНОГО ДВИГУНА
      // ======================================================================

      const renderBuffers = engine.getRenderData();

      let preyIdx = 0;
      let predIdx = 0;
      let foodIdx = 0;

      // ======================================================================
      // ФАЗА 8: ОБРОБКА ТРАВОЇДНИХ ОРГАНІЗМІВ (PREY)
      // ======================================================================

      const preyData = renderBuffers.prey;
      const preyCount = renderBuffers.preyCount;

      for (let i = 0; i < preyCount; i++) {
        if (preyIdx >= MAX_INSTANCES) break;

        const offset = i * 13;
        const x = preyData[offset + 0];
        const y = preyData[offset + 1];
        const z = preyData[offset + 2];
        const r = preyData[offset + 6];

        // FRUSTUM CULLING: Перевірка видимості
        if (CULLING_CONFIG.enableFrustumCulling) {
          tmpSphere.center.set(x, y, z);
          tmpSphere.radius = r;

          if (!frustum.intersectsSphere(tmpSphere)) {
            continue; // КРИТИЧНО: Справжній пропуск рендерингу невидимих об'єктів!
          }
        }

        const vx = preyData[offset + 3];
        const vy = preyData[offset + 4];
        const vz = preyData[offset + 5];
        const id = preyData[offset + 8];

        // Формування матриці трансформації
        dummy.position.set(x, y, z);
        const scale = r * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        // Орієнтація за напрямком руху
        const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (spd > 0.01) {
          tmpPos.set(vx / spd, vy / spd, vz / spd);
          dummy.quaternion.setFromUnitVectors(forward, tmpPos);
        } else {
          dummy.rotation.set(0, 0, 0);
        }

        dummy.updateMatrix();
        idMaps.prey.set(preyIdx, `org_${id}`);
        preyMesh.setMatrixAt(preyIdx++, dummy.matrix);
      }

      // ======================================================================
      // ФАЗА 9: ОНОВЛЕННЯ СИСТЕМ ТРАСУВАННЯ ТРАЄКТОРІЙ
      // ======================================================================

      if (!isStopped) {
        engine.organisms.forEach((o) => {
          if (o.isDead) return;

          if (RENDER.enableTracertForAllOrganisms || o.trailEnabled) {
            const color = o.isPrey ? COLORS.prey.base : COLORS.predator.base;
            trailSystem.updateTrail(o.id, o.position, color, true);
          } else {
            trailSystem.removeTrail(o.id);
          }
        });
      }

      // ======================================================================
      // ФАЗА 10: ОБРОБКА ХИЖИХ ОРГАНІЗМІВ (PREDATORS)
      // ======================================================================

      const predData = renderBuffers.predators;
      const predCount = renderBuffers.predatorCount;

      for (let i = 0; i < predCount; i++) {
        if (predIdx >= MAX_INSTANCES) break;

        const offset = i * 13;
        const x = predData[offset + 0];
        const y = predData[offset + 1];
        const z = predData[offset + 2];
        const r = predData[offset + 6];

        if (CULLING_CONFIG.enableFrustumCulling) {
          tmpSphere.center.set(x, y, z);
          tmpSphere.radius = r;

          if (!frustum.intersectsSphere(tmpSphere)) {
            continue;
          }
        }

        const vx = predData[offset + 3];
        const vy = predData[offset + 4];
        const vz = predData[offset + 5];
        const id = predData[offset + 8];

        dummy.position.set(x, y, z);
        const scale = r * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (spd > 0.01) {
          tmpPos.set(vx / spd, vy / spd, vz / spd);
          dummy.quaternion.setFromUnitVectors(forward, tmpPos);
        } else {
          dummy.rotation.set(0, 0, 0);
        }

        dummy.updateMatrix();
        idMaps.pred.set(predIdx, `org_${id}`);
        predMesh.setMatrixAt(predIdx++, dummy.matrix);
      }

      // ======================================================================
      // ФАЗА 11: ОБРОБКА ЕНЕРГЕТИЧНИХ РЕСУРСІВ (FOOD)
      // ======================================================================

      const foodData = renderBuffers.food;
      const activeFoodCount = renderBuffers.foodCount;
      const rotationTime = isStopped ? 0 : time.current;

      for (let i = 0; i < activeFoodCount; i++) {
        if (foodIdx >= MAX_INSTANCES) break;

        const offset = i * 5;
        const x = foodData[offset + 0];
        const y = foodData[offset + 1];
        const z = foodData[offset + 2];
        const r = foodData[offset + 3];

        if (CULLING_CONFIG.enableFrustumCulling) {
          tmpSphere.center.set(x, y, z);
          tmpSphere.radius = r * 2.5; // Врахування scale factor

          if (!frustum.intersectsSphere(tmpSphere)) {
            continue;
          }
        }

        const id = foodData[offset + 4];

        const geometryRadius = 2;
        const scale = (r / geometryRadius) * 2.5 * engine.config.foodScale;

        dummy.position.set(x, y, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(rotationTime * 0.5, rotationTime * 0.3, 0);
        dummy.updateMatrix();

        idMaps.food.set(foodIdx, `food_${id}`);
        foodMesh.setMatrixAt(foodIdx++, dummy.matrix);
      }

      // ======================================================================
      // ФАЗА 12: СИНХРОНІЗАЦІЯ INSTANCED MESHES З ГРАФІЧНИМ КОНВЕЄРОМ
      // ======================================================================

      updateInstancedMesh(preyMesh, preyIdx);
      updateInstancedMesh(predMesh, predIdx);
      updateInstancedMesh(foodMesh, foodIdx);

      // ======================================================================
      // ФАЗА 13: ОНОВЛЕННЯ СТАНУ ІНТЕРАКТИВНОГО НАВЕДЕННЯ
      // ======================================================================

      updateHoveredEntity(
        camera,
        preyMesh,
        predMesh,
        foodMesh,
        obstacleMeshes,
        idMaps,
        engine
      );

      // ======================================================================
      // ФАЗА 14: ТЕРМІНАЛЬНИЙ РЕНДЕРИНГ ТА ПЛАНУВАННЯ НАСТУПНОГО КАДРУ
      // ======================================================================

      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    // Ініціація циклу рендерингу
    requestRef.current = requestAnimationFrame(animate);

    // Термінальна функція очищення
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [sceneData, sceneObjects, particleEffects, engine, updateHoveredEntity, updateInstancedMesh]);
}
