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

export interface EntityHoverHook {
  hoveredEntity: Organism | Food | Obstacle | null;
  tooltipVisible: boolean;
  tooltipPos: { x: number; y: number };
  onMouseMove: (event: MouseEvent) => void;
  onClick: (
    camera: THREE.PerspectiveCamera,
    preyMesh: THREE.InstancedMesh,
    predMesh: THREE.InstancedMesh,
    idMaps: {
      prey: Map<number, string>;
      pred: Map<number, string>;
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
    mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    setTooltipPos({ x: event.clientX, y: event.clientY });
  }, []);

  // Handler для click (toggle trail)
  const onClick = useCallback(
    (
      camera: THREE.PerspectiveCamera,
      preyMesh: THREE.InstancedMesh,
      predMesh: THREE.InstancedMesh,
      idMaps: {
        prey: Map<number, string>;
        pred: Map<number, string>;
      },
      engine: SimulationEngine
    ) => {
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([
        preyMesh,
        predMesh,
      ]);

      if (intersects.length > 0) {
        const hit = intersects[0];
        let id: string | undefined;

        if (hit.object === preyMesh) {
          id = idMaps.prey.get(hit.instanceId!);
        } else if (hit.object === predMesh) {
          id = idMaps.pred.get(hit.instanceId!);
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
        let id: string | undefined;

        if (hit.object === preyMesh) {
          id = idMaps.prey.get(hit.instanceId!);
        } else if (hit.object === predMesh) {
          id = idMaps.pred.get(hit.instanceId!);
        } else if (hit.object === foodMesh) {
          id = idMaps.food.get(hit.instanceId!);
        } else if (hit.object.userData.type === EntityType.OBSTACLE) {
          id = hit.object.userData.id;
        }

        if (id) {
          const entity =
            engine.organisms.get(id) ||
            engine.food.get(id) ||
            engine.obstacles.get(id);
          setHoveredEntity(entity || null);
        } else {
          setHoveredEntity(null);
        }
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
