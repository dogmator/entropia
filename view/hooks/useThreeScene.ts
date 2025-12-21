/**
 * Hook для ініціалізації Three.js сцени
 *
 * Створює та налаштовує:
 * - Scene з background
 * - PerspectiveCamera
 * - WebGLRenderer з tone mapping
 * - OrbitControls
 * - Освітлення
 */

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLD_SIZE } from '../../constants';

export interface ThreeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

export function useThreeScene(containerRef: React.RefObject<HTMLDivElement>) {
  const [sceneData, setSceneData] = useState<ThreeScene | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    camera.position.set(WORLD_SIZE * 1.2, WORLD_SIZE * 1.0, WORLD_SIZE * 1.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 100;
    controls.maxDistance = WORLD_SIZE * 3;

    // Освітлення
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(WORLD_SIZE, WORLD_SIZE * 1.5, WORLD_SIZE);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-WORLD_SIZE, WORLD_SIZE * 0.5, -WORLD_SIZE);
    scene.add(fillLight);

    setSceneData({ scene, camera, renderer, controls });

    // Resize handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [containerRef]);

  return sceneData;
}
