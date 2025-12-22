/**
 * Hook для обробки hover на сутностях
 *
 * Управляє:
 * - Визначенням сутності під курсором (raycasting)
 * - Станом tooltip (visible, position)
 * - Mouse handlers
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { Organism, Food, Obstacle } from '../../simulation/Entity';
import { EntityType } from '../../types';
import Logger from '../../core/utils/Logger';

export interface EntityHoverHook {
  hoveredEntity: Organism | Food | Obstacle | null;
  tooltipVisible: boolean;
  tooltipPos: { x: number; y: number };
  onMouseMove: (event: MouseEvent) => void;
  onClick: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    foodMesh: THREE.InstancedMesh,
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
      food: Map<number, string>;
    },
    engine: SimulationEngine
  ) => void;
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

export function useEntityHover(): EntityHoverHook {
  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const fadeTimeoutRef = useRef<number | null>(null);

  const [hoveredEntity, setHoveredEntity] = useState<
    Organism | Food | Obstacle | null
  >(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Плавне з'явлення/зникнення tooltip
  useEffect(() => {
    if (hoveredEntity) {
      // Показати одразу
      setTooltipVisible(true);
      // Очистити попередній таймер
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    } else {
      // Приховати з затримкою 180ms
      fadeTimeoutRef.current = window.setTimeout(() => {
        setTooltipVisible(false);
      }, 180);
    }
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [hoveredEntity]);

  // Handler для mouse move
  const onMouseMove = useCallback((event: MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouse.current.x = (x / rect.width) * 2 - 1;
    mouse.current.y = -(y / rect.height) * 2 + 1;
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  // Handler для click (toggle trail)
  const onClick = useCallback(
    (
      camera: THREE.PerspectiveCamera,
      preyMesh: THREE.InstancedMesh,
      predMesh: THREE.InstancedMesh,
      foodMesh: THREE.InstancedMesh,
      idMaps: {
        prey: Map<number, string>;
        pred: Map<number, string>;
        food: Map<number, string>;
      },
      engine: SimulationEngine
    ) => {
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([
        preyMesh,
        predMesh,
        foodMesh,
      ]);

      if (intersects.length > 0) {
        const hit = intersects[0];
        let id: string | undefined;

        if (hit.object === preyMesh) {
          id = idMaps.prey.get(hit.instanceId!);
        } else if (hit.object === predMesh) {
          id = idMaps.pred.get(hit.instanceId!);
        } else if (hit.object === foodMesh) {
          id = idMaps.food.get(hit.instanceId!);
        }

        if (id) {
          const org = engine.organisms.get(id);
          if (org) {
            org.trailEnabled = !org.trailEnabled;
          }
        }
      }
    },
    []
  );

  // Метод для оновлення hovered entity (викликається в animation loop)
  const updateHoveredEntity = useCallback(
    (
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
    ) => {
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([
        preyMesh,
        predMesh,
        foodMesh,
        ...obstacleMeshes,
      ]);

      if (intersects.length > 0) {
        const hit = intersects[0];
        let entity: Organism | Food | Obstacle | null = null;

        if (hit.object === preyMesh && hit.instanceId !== undefined) {
          const id = idMaps.prey.get(hit.instanceId);
          if (id) entity = engine.organisms.get(id) || null;
        } else if (hit.object === predMesh && hit.instanceId !== undefined) {
          const id = idMaps.pred.get(hit.instanceId);
          if (id) entity = engine.organisms.get(id) || null;
        } else if (hit.object === foodMesh && hit.instanceId !== undefined) {
          const id = idMaps.food.get(hit.instanceId);
          if (id) {
            entity = engine.food.get(id) || null;
            if (!entity) {
              Logger.warn('Food entity not found for ID:', id);
            }
          } else {
            Logger.warn('ID not found in idMaps.food for instance:', hit.instanceId);
          }
        } else if (hit.object.userData.type === EntityType.OBSTACLE) {
          const id = hit.object.userData.id;
          entity = engine.obstacles.get(id) || null;
        }

        setHoveredEntity(entity);
      } else {
        setHoveredEntity(null);
      }
    },
    []
  );

  return {
    hoveredEntity,
    tooltipVisible,
    tooltipPos,
    onMouseMove,
    onClick,
    updateHoveredEntity,
  };
}
