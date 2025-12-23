/**
 * Спеціалізований програмний інтерфейс (хук) для ініціалізації та конфігурації графічного контексту Three.js.
 * 
 * Забезпечує створення та налаштування базової 3D-інфраструктури:
 * - Графічна сцена з параметризованим фоном
 * - Перспективна камера (PerspectiveCamera) з динамічними параметрами огляду
 * - Рендерер WebGL із застосуванням методів тонального відображення (tone mapping)
 * - Контролери орбітального управління (OrbitControls)
 * - Багатокомпонентна система освітлення
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

export function useThreeScene(container: HTMLDivElement | null, worldSize: number = WORLD_SIZE) {
  const [sceneData, setSceneData] = useState<ThreeScene | null>(null);

  useEffect(() => {
    if (!container) return;

    // Ініціалізація графічної сцени та встановлення фонового кольору
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);

    // Конфігурація перспективної камери
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      5000
    );
    camera.position.set(worldSize * 1.2, worldSize * 1.0, worldSize * 1.2);

    // Параметризація рендерера WebGL для забезпечення високої продуктивності
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Налаштування механізмів інтерактивного управління камерою
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(worldSize / 2, worldSize / 2, worldSize / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 100;
    controls.maxDistance = worldSize * 3;

    // Формування комплексу джерел освітлення
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(worldSize, worldSize * 1.5, worldSize);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-worldSize, worldSize * 0.5, -worldSize);
    scene.add(fillLight);

    setSceneData({ scene, camera, renderer, controls });

    /**
     * Обробник події зміни розмірів вікна для адаптації параметрів рендерингу.
     */
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    /**
     * Термінальна функція для вивільнення системних ресурсів та очищення DOM.
     */
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [container, worldSize]); // dependency update

  return sceneData;
}
