/**
 * Спеціалізований програмний інтерфейс (хук) для ініціалізації та управління життєвим циклом геометричних об'єктів сцени.
 * 
 * Забезпечує створення та конфігурацію наступних компонентів:
 * - Об'єкти групової візуалізації (InstancedMesh) для біологічних суб'єктів (prey, predator)
 * - Об'єкти групової візуалізації для енергетичних ресурсів (їжа)
 * - Статичні геометричні перешкоди
 * - Візуальні дескриптори екологічних зон
 * - Структурні межі віртуального середовища
 */

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { WORLD_SIZE, COLORS, RENDER, ZONE_DEFAULTS } from '../../constants';
import { EntityType } from '../../types';

export interface SceneObjects {
  // Геометричні меш-об'єкти
  preyMesh: THREE.InstancedMesh;
  predMesh: THREE.InstancedMesh;
  foodMesh: THREE.InstancedMesh;
  obstacleMeshes: THREE.Mesh[];
  zoneMeshes: THREE.Mesh[];
  boxLines: THREE.LineSegments;

  // Допоміжні структури даних
  dummy: THREE.Object3D;
  forward: THREE.Vector3;
  idMaps: {
    prey: Map<number, string>;
    pred: Map<number, string>;
    food: Map<number, string>;
  };

  // Геометрії та матеріали (ініціалізовані для подальшої деструкції)
  orgGeo: THREE.ConeGeometry;
  foodGeo: THREE.BufferGeometry;
  preyMat: THREE.MeshPhongMaterial;
  predMat: THREE.MeshPhongMaterial;
  foodMat: THREE.MeshPhongMaterial;
  boxGeo: THREE.BoxGeometry;
  boxEdges: THREE.EdgesGeometry;
  boxMat: THREE.LineBasicMaterial;
}

export function useSceneObjects(
  scene: THREE.Scene | null,
  engine: SimulationEngine
) {
  const [objectsData, setObjectsData] = useState<SceneObjects | null>(null);

  useEffect(() => {
    if (!scene) return;

    const MAX_INSTANCES = RENDER.maxInstances;

    // ========================================================================
    // КОНСТРУЮВАННЯ ГРАНИЧНОЇ РАМКИ ВІРТУАЛЬНОГО ПРОСТОРУ
    // ========================================================================

    const boxGeo = new THREE.BoxGeometry(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({
      color: COLORS.ui.accent,
      transparent: true,
      opacity: 0.08,
    });
    const boxLines = new THREE.LineSegments(boxEdges, boxMat);
    boxLines.position.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2);
    scene.add(boxLines);

    // ========================================================================
    // ВІЗУАЛІЗАЦІЯ ЕКОЛОГІЧНИХ ЗОН
    // ========================================================================

    const zoneMeshes: THREE.Mesh[] = [];
    engine.zones.forEach((zone) => {
      const zoneColor =
        ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS]?.color || 0xffffff;

      // Ініціалізація сферичної геометрії для зон (низька деталізація для оптимізації)
      const geo = new THREE.SphereGeometry(zone.radius, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: zoneColor,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(zone.center.x, zone.center.y, zone.center.z);
      scene.add(mesh);
      zoneMeshes.push(mesh);
    });

    // ========================================================================
    // СТВОРЕННЯ ГРУПОВИХ МЕШ-ОБ'ЄКТІВ ДЛЯ БІОЛОГІЧНИХ ОРГАНІЗМІВ
    // ========================================================================

    // Встановлення оптимальної деталізації для геометрії організмів
    const orgGeo = new THREE.ConeGeometry(0.8, 2.5, 12);
    orgGeo.rotateX(Math.PI / 2);

    const preyMat = new THREE.MeshPhongMaterial({
      color: COLORS.prey.base,
      transparent: true,
      opacity: 0.92,
      emissive: COLORS.prey.base,
      emissiveIntensity: 0.15,
      shininess: 30,
    });
    const preyMesh = new THREE.InstancedMesh(orgGeo, preyMat, MAX_INSTANCES);
    preyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Деактивація механізму відсікання за межами видимості для забезпечення точності проекційного аналізу
    preyMesh.frustumCulled = false;

    // Примусове визначення граничної сфери для коректного опрацювання рейкастером
    preyMesh.geometry.computeBoundingSphere();
    if (preyMesh.geometry.boundingSphere) {
      preyMesh.geometry.boundingSphere.radius = WORLD_SIZE * 2;
    }

    scene.add(preyMesh);

    const predMat = new THREE.MeshPhongMaterial({
      color: COLORS.predator.base,
      transparent: true,
      opacity: 0.92,
      emissive: COLORS.predator.base,
      emissiveIntensity: 0.2,
      shininess: 40,
    });
    const predMesh = new THREE.InstancedMesh(orgGeo, predMat, MAX_INSTANCES);
    predMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    predMesh.frustumCulled = false;

    // Аналогічна конфігурація граничного об'єму для хижих суб'єктів
    predMesh.geometry.computeBoundingSphere();
    if (predMesh.geometry.boundingSphere) {
      predMesh.geometry.boundingSphere.radius = WORLD_SIZE * 2;
    }

    scene.add(predMesh);

    // ========================================================================
    // СТВОРЕННЯ ГРУПОВОГО МЕШ-ОБ'ЄКТА ДЛЯ ЕНЕРГЕТИЧНИХ РЕСУРСІВ
    // ========================================================================

    // Використання сферичної геометрії для забезпечення стабільності математичного детектування
    const foodGeo = new THREE.SphereGeometry(2, 8, 8);
    const foodMat = new THREE.MeshPhongMaterial({
      color: COLORS.food.base,
      emissive: COLORS.food.emissive,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
      shininess: 100,
    });
    const foodMesh = new THREE.InstancedMesh(
      foodGeo,
      foodMat,
      MAX_INSTANCES * 2
    );
    foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    foodMesh.frustumCulled = false;
    foodMesh.userData = { type: EntityType.FOOD };

    // Критичне збільшення граничної сфери для запобігання ігноруванню ресурсів алгоритмом рейкастингу
    // ВАЖЛИВО: Центр НЕ змінюємо — Three.js для InstancedMesh очікує геометрію в оригіні (0,0,0),
    // а потім застосовує instanceMatrix для позиціонування кожного інстанса
    foodGeo.computeBoundingSphere();
    if (foodGeo.boundingSphere) {
      foodGeo.boundingSphere.radius = WORLD_SIZE * 2;
    }

    scene.add(foodMesh);

    // ========================================================================
    // ІНІЦІАЛІЗАЦІЯ СТАТИЧНИХ ГЕОМЕТРИЧНИХ ПЕРЕШКОД
    // ========================================================================

    const obstacleMeshes: THREE.Mesh[] = [];
    engine.obstacles.forEach((obs) => {
      const geo = new THREE.IcosahedronGeometry(obs.radius, 2);
      const mat = new THREE.MeshPhongMaterial({
        color: obs.color,
        transparent: true,
        opacity: obs.opacity,
        flatShading: true,
        emissive: COLORS.obstacle.base,
        emissiveIntensity: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.position.x, obs.position.y, obs.position.z);
      mesh.userData = { id: obs.id, type: EntityType.OBSTACLE };
      scene.add(mesh);
      obstacleMeshes.push(mesh);
    });

    // ========================================================================
    // ФОРМУВАННЯ ДОПОМІЖНИХ ТА СЛУЖБОВИХ ОБ'ЄКТІВ
    // ========================================================================

    const dummy = new THREE.Object3D();
    const forward = new THREE.Vector3(0, 0, 1);

    const idMaps = {
      prey: new Map<number, string>(),
      pred: new Map<number, string>(),
      food: new Map<number, string>(),
    };

    setObjectsData({
      preyMesh,
      predMesh,
      foodMesh,
      obstacleMeshes,
      zoneMeshes,
      boxLines,
      dummy,
      forward,
      idMaps,
      orgGeo,
      foodGeo,
      preyMat,
      predMat,
      foodMat,
      boxGeo,
      boxEdges,
      boxMat,
    });

    /**
     * Термінальна функція очищення ресурсів для запобігання витокам пам'яті.
     */
    return () => {
      orgGeo.dispose();
      foodGeo.dispose();
      preyMat.dispose();
      predMat.dispose();
      foodMat.dispose();
      boxGeo.dispose();
      boxEdges.dispose();
      boxMat.dispose();

      obstacleMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });

      zoneMeshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
    };
  }, [scene, engine]);

  return objectsData;
}
