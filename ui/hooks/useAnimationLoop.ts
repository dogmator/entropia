/**
 * Спеціалізований програмний інтерфейс (хук) для управління головним анімаційним циклом системи.
 * 
 * Забезпечує координацію наступних процесів:
 * - Цикл планування кадрів (requestAnimationFrame)
 * - Хронологічне оновлення стану симуляційного двигуна
 * - Модуляція візуальних ефектів та систем часток
 * - Актуалізація об'єктів групової візуалізації (Instanced Meshes)
 * - Термінальний рендеринг графічної сцени
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { EntityType } from '../../types';
import { COLORS, RENDER } from '../../constants';
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

  const requestRef = useRef<number>(0);
  const speedAccumulator = useRef(0);
  const lastTime = useRef(0);
  const time = useRef(0);
  const frameCount = useRef(0);

  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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

    // ========================================================================
    // ПОСТІЙНІ ОБ'ЄКТИ ДЛЯ FRUSTUM CULLING (мінімізація алокацій)
    // ========================================================================
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    const tmpSphere = new THREE.Sphere();
    const tmpPos = new THREE.Vector3();

    /**
     * Головна ітераційна функція відтворення кадру.
     */
    const animate = (currentTime: number) => {
      frameCount.current++;

      // Обчислення дельти часу з обмеженням для уникнення стрибків при втраті фокусу
      const deltaTime = Math.min(
        (currentTime - lastTime.current) / 1000,
        0.1
      );
      lastTime.current = currentTime;

      const currentSpeed = speedRef.current;
      const isStopped = currentSpeed === 0;

      // Актуалізація внутрішнього таймера системи (за умови активної симуляції)
      if (!isStopped) {
        time.current += deltaTime;
      }

      // Оновлення обчислювального стану симуляційного двигуна
      if (!isStopped) {
        speedAccumulator.current += currentSpeed;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;
        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      // Модуляція систем часток та фонових ефектів
      if (!isStopped && engine.config.showParticles) {
        cosmicBackground.update(deltaTime);
        particleSystem.update(deltaTime);
      }

      // Динамічне коригування параметрів матеріалів
      foodMat.emissiveIntensity = isStopped
        ? 0.4
        : 0.4 + Math.sin(time.current * 3) * 0.25;
      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;

      // Оптимізація видимості пасивних перешкод
      obstacleMeshes.forEach(m => {
        m.visible = engine.config.showObstacles;
      });

      // Скидання мап відповідності ідентифікаторів
      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      // ======================================================================
      // АГРЕСИВНЕ CULLING (CPU-SIDE) ТА РЕНДЕРИНГ
      // ======================================================================

      // 1. Оновлюємо фрустум камери (повторне використання постійних об'єктів)
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);

      // 2. Отримуємо оптимізовані дані з двигуна
      const renderBuffers = engine.getRenderData();

      // Допоміжні змінні для циклів
      let preyIdx = 0;
      let predIdx = 0;
      let foodIdx = 0;

      // --- ОБРОБКА ЖЕРТВ ---
      const preyData = renderBuffers.prey;
      const preyCount = renderBuffers.preyCount;
      // Stride = 13 (з type definitions)
      for (let i = 0; i < preyCount; i++) {
        if (preyIdx >= MAX_INSTANCES) break;

        const offset = i * 13;
        const x = preyData[offset + 0];
        const y = preyData[offset + 1];
        const z = preyData[offset + 2];
        const r = preyData[offset + 6];

        // Перевірка видимості (Frustum Culling)
        tmpSphere.center.set(x, y, z);
        tmpSphere.radius = r;

        if (!frustum.intersectsSphere(tmpSphere)) {
          continue; // Пропускаємо об'єкти поза межами видимості
        }

        const vx = preyData[offset + 3];
        const vy = preyData[offset + 4];
        const vz = preyData[offset + 5];
        const id = preyData[offset + 8]; // Числова частина ID

        // Формування матриці
        dummy.position.set(x, y, z);
        const scale = r * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        // Орієнтація
        const spd = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (spd > 0.01) {
          tmpPos.set(vx / spd, vy / spd, vz / spd);
          dummy.quaternion.setFromUnitVectors(forward, tmpPos);
        } else {
          dummy.rotation.set(0, 0, 0);
        }

        dummy.updateMatrix();

        // Карта idMaps очікує: prey: Map<number, string>;
        // Але engine.organisms має string ID 'org_123'.
        // ТУТ ВАЖЛИВО: Щоб raycaster працював коректно з картою, нам треба повний ID.
        // getRenderData повертає тільки число. Відтворимо рядок.
        idMaps.prey.set(preyIdx, `org_${id}`);

        preyMesh.setMatrixAt(preyIdx++, dummy.matrix);
      }

      // Update trails for ALL organisms (visible or not) to maintain continuity
      if (!isStopped) {
        engine.organisms.forEach(o => {
          if (o.isDead) return;
          if (RENDER.enableTracertForAllOrganisms || o.trailEnabled) {
            const color = o.isPrey ? COLORS.prey.base : COLORS.predator.base;
            trailSystem.updateTrail(o.id, o.position, color, true);
          } else {
            trailSystem.removeTrail(o.id);
          }
        });
      }

      // --- ОБРОБКА ХИЖАКІВ ---
      const predData = renderBuffers.predators;
      const predCount = renderBuffers.predatorCount;
      for (let i = 0; i < predCount; i++) {
        if (predIdx >= MAX_INSTANCES) break;

        const offset = i * 13;
        const x = predData[offset + 0];
        const y = predData[offset + 1];
        const z = predData[offset + 2];
        const r = predData[offset + 6];

        tmpSphere.center.set(x, y, z);
        tmpSphere.radius = r;

        if (!frustum.intersectsSphere(tmpSphere)) {
          continue; // Пропускаємо об'єкти поза межами видимості
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

      // --- ОБРОБКА ЇЖІ ---
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

        tmpSphere.center.set(x, y, z);
        tmpSphere.radius = r;

        if (!frustum.intersectsSphere(tmpSphere)) {
          continue; // Пропускаємо об'єкти поза межами видимості
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


      // Синхронізація матриць інстансів організмів із графічним конвеєром
      preyMesh.count = preyIdx;
      preyMesh.instanceMatrix.needsUpdate = true;
      // ОПТИМІЗАЦІЯ: видалено computeBoundingSphere() з гарячого шляху.
      // BoundingSphere встановлюється один раз у useSceneObjects.

      predMesh.count = predIdx;
      predMesh.instanceMatrix.needsUpdate = true;

      // Актуалізація стану об'єктів їжі
      foodMesh.count = foodIdx;
      foodMesh.instanceMatrix.needsUpdate = true;

      // Оновлення стану інтерактивного наведення
      updateHoveredEntity(
        camera,
        preyMesh,
        predMesh,
        foodMesh,
        obstacleMeshes,
        idMaps,
        engine
      );

      // Виклик термінальних методів рендерингу
      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [sceneData, sceneObjects, particleEffects, engine, updateHoveredEntity]);
}
