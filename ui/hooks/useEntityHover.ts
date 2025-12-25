/**
 * Програмний інтерфейс (хук) для детермінації стану наведення курсора на об'єкти віртуального середовища.
 * 
 * Забезпечує функціональність:
 * - Математичне детектування об'єктів під курсором (проекційне випромінювання / raycasting)
 * - Управління станом та візуалізацією інформаційного вікна (tooltip)
 * - Опрацювання подій координатного вводу (mouse handlers)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { SimulationEngine } from '../../simulation/Engine';
import { Organism, Food, Obstacle } from '../../simulation/Entity';
import { EntityType } from '../../types';
import { Logger } from '../../core/utils/Logger';

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
  const frameCount = useRef(0);

  /**
   * Конфігурація параметрів детектування для різних типів геометрії.
   * Використовується підвищений поріг (threshold) для малих об'єктів.
   */
  useEffect(() => {
    raycaster.current.params.Points = { threshold: 2.0 };
    raycaster.current.params.Line = { threshold: 1.0 };
  }, []);

  const fadeTimeoutRef = useRef<number | null>(null);

  const [hoveredEntity, setHoveredEntity] = useState<
    Organism | Food | Obstacle | null
  >(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  /**
   * Забезпечення візуальної транзитивності (плавної появи та асинхронного зникнення) 
   * інформаційного вікна при зміні цільового об'єкта.
   */
  useEffect(() => {
    if (hoveredEntity) {
      setTooltipVisible(true);
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    } else {
      // Імплементація часової затримки (180 мс) перед деактивацією видимості
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

  /**
   * Опрацювання події переміщення маніпулятора «миша» для розрахунку нормалізованих координат.
   */
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

  /**
   * Опрацювання події ініціації взаємодії (клік) з об'єктами середовища.
   */
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
            // Перемикання стану візуалізації траєкторії руху
            org.trailEnabled = !org.trailEnabled;
          }
        }
      }
    },
    []
  );

  /**
   * Механізм ітеративного оновлення стану наведеного об'єкта (викликається в циклі анімації).
   */
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
      frameCount.current++;

      // Періодичне діагностичне протоколювання стану об'єктів візуалізації
      if (frameCount.current % 120 === 0) {
        Logger.debug('Аналіз стану меш-об\'єктів:', {
          foodVisible: foodMesh.visible,
          foodCount: foodMesh.count,
          foodParent: !!foodMesh.parent,
          foodScale: foodMesh.scale.x,
          engineFood: engine.food.size,
          idMapFood: idMaps.food.size
        });
      }

      raycaster.current.setFromCamera(mouse.current, camera);

      const objectsToRaycast = [
        preyMesh,
        predMesh,
        foodMesh,
        ...obstacleMeshes,
      ];

      // Протоколювання переліку об'єктів для операції проектування
      if (frameCount.current % 120 === 0) {
        Logger.debug('Перелік об\'єктів для проекційного аналізу:', objectsToRaycast.map((o, i) => ({
          index: i,
          type: o.type,
          visible: o.visible,
          count: (o as THREE.InstancedMesh).count,
          isFoodMesh: o === foodMesh
        })));
      }

      const intersects = raycaster.current.intersectObjects(objectsToRaycast);

      if (intersects.length > 0) {
        // Протоколювання всіх знайдених перетинів для діагностики
        if (frameCount.current % 60 === 0) {
          Logger.debug('Реєстр знайдених перетинів:', intersects.map(h => ({
            type: h.object.type,
            isFood: h.object === foodMesh || h.object.userData.type === EntityType.FOOD,
            dist: h.distance,
            instanceId: h.instanceId
          })));
        }

        const hasFood = intersects.some(h => h.object === foodMesh || h.object.userData.type === EntityType.FOOD);

        // Визначення пріоритетного об'єкта (пріоритет віддається їжі, якщо вона є в стеку перетинів)
        let hit = intersects[0];
        if (hasFood && hit.object !== foodMesh && hit.object.userData.type !== EntityType.FOOD) {
          const foodHit = intersects.find(h => h.object === foodMesh || h.object.userData.type === EntityType.FOOD);
          if (foodHit && foodHit.distance < hit.distance + 5) { // Невеликий допуск для пріоритету
            hit = foodHit;
          }
        }

        let entity: Organism | Food | Obstacle | null = null;

        if (hit.object === preyMesh && hit.instanceId !== undefined) {
          const id = idMaps.prey.get(hit.instanceId);
          if (id) entity = engine.organisms.get(id) || null;
        } else if (hit.object === predMesh && hit.instanceId !== undefined) {
          const id = idMaps.pred.get(hit.instanceId);
          if (id) entity = engine.organisms.get(id) || null;
        } else if (hit.object === foodMesh || hit.object.userData.type === EntityType.FOOD) {
          if (hit.instanceId !== undefined) {
            const foodId = idMaps.food.get(hit.instanceId);
            if (foodId) {
              entity = engine.food.get(foodId) || null;
            } else {
              Logger.warn('Ідентифікатор ID відсутній у мапі для інстанса їжі:', hit.instanceId);
            }
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
