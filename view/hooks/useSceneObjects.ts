/**
 * Hook для створення всіх 3D об'єктів сцени
 *
 * Створює:
 * - InstancedMesh для організмів (prey, predator)
 * - InstancedMesh для їжі
 * - Перешкоди
 * - Екологічні зони
 * - Світову рамку
 * - Допоміжні об'єкти
 */

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { WORLD_SIZE, COLORS, RENDER, ZONE_DEFAULTS } from '../../constants';
import { EntityType } from '../../types';

export interface SceneObjects {
  // Meshes
  preyMesh: THREE.InstancedMesh;
  predMesh: THREE.InstancedMesh;
  foodMesh: THREE.InstancedMesh;
  obstacleMeshes: THREE.Mesh[];
  zoneMeshes: THREE.Mesh[];
  boxLines: THREE.LineSegments;

  // Helpers
  dummy: THREE.Object3D;
  forward: THREE.Vector3;
  idMaps: {
    prey: Map<number, string>;
    pred: Map<number, string>;
    food: Map<number, string>;
  };

  // Geometries and materials (для cleanup)
  orgGeo: THREE.ConeGeometry;
  foodGeo: THREE.OctahedronGeometry;
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
    // СВІТОВА РАМКА
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
    // ЕКОЛОГІЧНІ ЗОНИ
    // ========================================================================

    const zoneMeshes: THREE.Mesh[] = [];
    engine.zones.forEach((zone) => {
      const zoneColor =
        ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS]?.color || 0xffffff;
      // Фіксована якість зон (низька для продуктивності)
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
    // INSTANCED MESHES ДЛЯ ОРГАНІЗМІВ
    // ========================================================================

    // Фіксована середня якість для організмів (баланс продуктивність/якість)
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
    scene.add(predMesh);

    // ========================================================================
    // INSTANCED MESH ДЛЯ ЇЖІ
    // ========================================================================

    const foodGeo = new THREE.OctahedronGeometry(1, 0);
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
    scene.add(foodMesh);

    // ========================================================================
    // ПЕРЕШКОДИ
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
    // ДОПОМІЖНІ ОБ'ЄКТИ
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

    // Cleanup
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
  }, [scene, engine]); // Видалено bodyQuality - recreate тільки при зміні scene/engine

  return objectsData;
}
