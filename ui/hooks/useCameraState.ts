/**
 * Хук для відстеження стану камери в реальному часі
 * Збирає дані про позицію, зум та орієнтацію камери для діагностичної системи
 */

import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ThreeScene } from './useThreeScene';

export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
  distance: number;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export function useCameraState(sceneData: ThreeScene | null) {
  const [cameraState, setCameraState] = useState<CameraState>({
    position: { x: 0, y: 0, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1,
    distance: 0,
    fov: 60,
    aspect: 1,
    near: 0.1,
    far: 5000,
  });

  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!sceneData) return;

    const { camera, controls } = sceneData;

    const updateCameraState = () => {
      const distance = camera.position.distanceTo(controls.target);
      
      const newState = {
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z,
        },
        zoom: controls.object instanceof THREE.PerspectiveCamera 
          ? distance / (camera.position.length() * 0.5) // Спрощений розрахунок зуму для PerspectiveCamera
          : (controls.object as any).zoom || 1,
        distance,
        fov: camera.fov,
        aspect: camera.aspect,
        near: camera.near,
        far: camera.far,
      };

      // Ефективна перевірка змін камери
      const hasChanges = 
        cameraState.position.x !== camera.position.x ||
        cameraState.position.y !== camera.position.y ||
        cameraState.position.z !== camera.position.z ||
        cameraState.target.x !== controls.target.x ||
        cameraState.target.y !== controls.target.y ||
        cameraState.target.z !== controls.target.z ||
        cameraState.distance !== distance ||
        cameraState.fov !== camera.fov ||
        cameraState.aspect !== camera.aspect;

      if (hasChanges) {
        setCameraState(newState);
      }
    };

    // Оновлюємо з частотою 10 Гц, але тільки якщо є зміни
    updateInterval.current = setInterval(updateCameraState, 100);

    // Оновлюємо одразу при зміні сцени
    updateCameraState();

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [sceneData]);

  return cameraState;
}
