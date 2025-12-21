
/**
 * EVOSIM 3D — Головний 3D Viewport
 *
 * Інтегрує всі візуальні компоненти:
 * - Three.js рендеринг з InstancedMesh
 * - Космічний фон з туманностями
 * - Система частинок для ефектів
 * - Сліди організмів
 * - Екологічні зони
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SimulationEngine } from '../simulation/Engine';
import { WORLD_SIZE, COLORS, RENDER, ZONE_DEFAULTS } from '../constants';
import { EntityType, OrganismState } from '../types';
import { Organism, Food, Obstacle } from '../simulation/Entity';
import { CosmicBackground } from './effects/CosmicBackground';
import { ParticleSystem, TrailSystem } from './effects/ParticleSystem';

// ============================================================================
// ТИПИ
// ============================================================================

interface ViewportProps {
  engine: SimulationEngine;
  isPaused: boolean;
  speed: number;
}

// ============================================================================
// ГОЛОВНИЙ КОМПОНЕНТ
// ============================================================================

const Viewport: React.FC<ViewportProps> = ({ engine, isPaused, speed }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const speedAccumulator = useRef(0);
  const lastTime = useRef(0);

  const speedRef = useRef(speed);
  const isPausedRef = useRef(isPaused);

  const [hoveredEntity, setHoveredEntity] = useState<Organism | Food | Obstacle | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const fadeTimeoutRef = useRef<number | null>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

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

  useEffect(() => {
    if (!containerRef.current) return;

    // ========================================================================
    // ІНІЦІАЛІЗАЦІЯ СЦЕНИ
    // ========================================================================

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020205);

    const camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.1, 5000
    );
    camera.position.set(WORLD_SIZE * 1.2, WORLD_SIZE * 1.0, WORLD_SIZE * 1.2);

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

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 100;
    controls.maxDistance = WORLD_SIZE * 3;

    // ========================================================================
    // ОСВІТЛЕННЯ
    // ========================================================================

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(WORLD_SIZE, WORLD_SIZE * 1.5, WORLD_SIZE);
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-WORLD_SIZE, WORLD_SIZE * 0.5, -WORLD_SIZE);
    scene.add(fillLight);

    // ========================================================================
    // КОСМІЧНИЙ ФОН
    // ========================================================================

    const cosmicBackground = new CosmicBackground(scene);

    // ========================================================================
    // СИСТЕМА ЧАСТИНОК
    // ========================================================================

    const particleSystem = new ParticleSystem(scene);
    const trailSystem = new TrailSystem(scene);

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
      const zoneColor = ZONE_DEFAULTS[zone.type as keyof typeof ZONE_DEFAULTS]?.color || 0xffffff;
      const geo = new THREE.SphereGeometry(zone.radius, 32, 32);
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
    // INSTANCED MESHES
    // ========================================================================

    const MAX_INSTANCES = RENDER.maxInstances;

    const orgGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
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

    const foodGeo = new THREE.OctahedronGeometry(1, 0);
    const foodMat = new THREE.MeshPhongMaterial({
      color: COLORS.food.base,
      emissive: COLORS.food.emissive,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85,
      shininess: 100,
    });
    const foodMesh = new THREE.InstancedMesh(foodGeo, foodMat, MAX_INSTANCES * 2);
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

    const processedDeaths = new Set<string>();
    const processedBirths = new Set<string>();

    // ========================================================================
    // ОБРОБНИКИ ПОДІЙ
    // ========================================================================

    const onMouseMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      setTooltipPos({ x: event.clientX, y: event.clientY });
    };

    const onClick = (event: MouseEvent) => {
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([preyMesh, predMesh]);
      if (intersects.length > 0) {
        const hit = intersects[0];
        let id: string | undefined;
        if (hit.object === preyMesh) id = idMaps.prey.get(hit.instanceId!);
        else if (hit.object === predMesh) id = idMaps.pred.get(hit.instanceId!);

        if (id) {
          const org = engine.organisms.get(id);
          if (org) org.trailEnabled = !org.trailEnabled;
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    // ========================================================================
    // ПІДПИСКА НА ПОДІЇ СИМУЛЯЦІЇ
    // ========================================================================

    const unsubscribe = engine.addEventListener((event) => {
      if (event.type === 'EntityDied') {
        if (event.entityType === EntityType.PREY || event.entityType === EntityType.PREDATOR) {
          const idStr = event.id as string;
          if (!processedDeaths.has(idStr)) {
            processedDeaths.add(idStr);
            const color = event.entityType === EntityType.PREY ? COLORS.prey.death : COLORS.predator.death;
            particleSystem.addDeathEffect(event.position, color, event.entityType === EntityType.PREDATOR);
            if (processedDeaths.size > 100) {
              const firstId = processedDeaths.values().next().value;
              if (firstId) processedDeaths.delete(firstId);
            }
          }
        }
      } else if (event.type === 'EntityReproduced') {
        const childIdStr = event.childId as string;
        if (!processedBirths.has(childIdStr)) {
          processedBirths.add(childIdStr);
          const org = engine.organisms.get(event.parentId as string);
          const color = org?.isPrey ? COLORS.prey.glow : COLORS.predator.glow;
          particleSystem.addBirthEffect(event.position, color);
          if (processedBirths.size > 100) {
            const firstId = processedBirths.values().next().value;
            if (firstId) processedBirths.delete(firstId);
          }
        }
      }
    });

    // ========================================================================
    // АНІМАЦІЙНИЙ ЦИКЛ
    // ========================================================================

    let time = 0;

    const animate = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime.current) / 1000, 0.1);
      lastTime.current = currentTime;
      time += deltaTime;

      if (!isPausedRef.current) {
        speedAccumulator.current += speedRef.current;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;
        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      cosmicBackground.update(deltaTime);
      particleSystem.update(deltaTime);

      foodMat.emissiveIntensity = 0.4 + Math.sin(time * 3) * 0.25;
      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;

      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      let preyIdx = 0, predIdx = 0;

      engine.organisms.forEach((o) => {
        if (o.isDead) return;

        dummy.position.set(o.position.x, o.position.y, o.position.z);
        const scale = o.radius * engine.config.organismScale;
        dummy.scale.set(scale, scale, scale);

        const spd = Math.sqrt(o.velocity.x ** 2 + o.velocity.y ** 2 + o.velocity.z ** 2);
        if (spd > 0.01) {
          const dir = new THREE.Vector3(o.velocity.x / spd, o.velocity.y / spd, o.velocity.z / spd);
          dummy.quaternion.setFromUnitVectors(forward, dir);
        }

        dummy.updateMatrix();

        if (o.type === EntityType.PREY && preyIdx < MAX_INSTANCES) {
          idMaps.prey.set(preyIdx, o.id);
          preyMesh.setMatrixAt(preyIdx++, dummy.matrix);
        } else if (o.type === EntityType.PREDATOR && predIdx < MAX_INSTANCES) {
          idMaps.pred.set(predIdx, o.id);
          predMesh.setMatrixAt(predIdx++, dummy.matrix);
        }

        if (o.trailEnabled) {
          const color = o.isPrey ? COLORS.prey.base : COLORS.predator.base;
          trailSystem.updateTrail(o.id, o.position, color, true);
        } else {
          trailSystem.removeTrail(o.id);
        }
      });

      preyMesh.count = preyIdx;
      preyMesh.instanceMatrix.needsUpdate = true;
      predMesh.count = predIdx;
      predMesh.instanceMatrix.needsUpdate = true;

      let foodIdx = 0;
      engine.food.forEach((f) => {
        if (f.consumed || foodIdx >= MAX_INSTANCES) return;

        const scale = f.radius * 2.5 * engine.config.foodScale;

        dummy.position.set(f.position.x, f.position.y, f.position.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(time * 0.5, time * 0.3, 0);
        dummy.updateMatrix();
        idMaps.food.set(foodIdx, f.id);
        foodMesh.setMatrixAt(foodIdx++, dummy.matrix);

        if (foodIdx < MAX_INSTANCES) {
          const orbitR = scale * 1.5;
          dummy.position.set(
            f.position.x + Math.sin(time * 2) * orbitR,
            f.position.y + Math.cos(time * 2) * orbitR * 0.5,
            f.position.z + Math.cos(time * 2) * orbitR
          );
          dummy.scale.set(scale * 0.5, scale * 0.5, scale * 0.5);
          dummy.rotation.set(time, time * 0.5, 0);
          dummy.updateMatrix();
          foodMesh.setMatrixAt(foodIdx++, dummy.matrix);
        }
      });

      foodMesh.count = foodIdx;
      foodMesh.instanceMatrix.needsUpdate = true;

      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects([preyMesh, predMesh, foodMesh, ...obstacleMeshes]);

      if (intersects.length > 0) {
        const hit = intersects[0];
        let id: string | undefined;
        if (hit.object === preyMesh) id = idMaps.prey.get(hit.instanceId!);
        else if (hit.object === predMesh) id = idMaps.pred.get(hit.instanceId!);
        else if (hit.object === foodMesh) id = idMaps.food.get(hit.instanceId!);
        else if (hit.object.userData.type === EntityType.OBSTACLE) id = hit.object.userData.id;

        if (id) {
          const entity = engine.organisms.get(id) || engine.food.get(id) || engine.obstacles.get(id);
          setHoveredEntity(entity || null);
        } else setHoveredEntity(null);
      } else setHoveredEntity(null);

      controls.update();
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      unsubscribe();

      cosmicBackground.dispose();
      particleSystem.dispose();
      trailSystem.dispose();

      renderer.dispose();
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
  }, [engine]);

  // ============================================================================
  // РЕНДЕР UI
  // ============================================================================

  const isOrganism = (e: any): e is Organism => e && (e.type === EntityType.PREY || e.type === EntityType.PREDATOR);
  const isObstacle = (e: any): e is Obstacle => e && e.type === EntityType.OBSTACLE;
  const isFood = (e: any): e is Food => e && e.type === EntityType.FOOD;

  const getStateLabel = (state: OrganismState): string => {
    const labels: Record<OrganismState, string> = {
      IDLE: 'Спокій', SEEKING: 'Пошук', FLEEING: 'Втеча',
      HUNTING: 'Полювання', REPRODUCING: 'Розмноження', DYING: 'Вмирає',
    };
    return labels[state] || state;
  };

  const getStateColor = (state: OrganismState): string => {
    const colors: Record<OrganismState, string> = {
      IDLE: 'text-gray-400', SEEKING: 'text-yellow-400', FLEEING: 'text-red-400',
      HUNTING: 'text-orange-400', REPRODUCING: 'text-pink-400', DYING: 'text-gray-600',
    };
    return colors[state] || 'text-gray-400';
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {tooltipVisible && (
        <div
          className={`fixed pointer-events-none bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-[11px] z-50 shadow-2xl ring-1 ring-white/10 min-w-[200px] transition-opacity duration-[180ms] ${hoveredEntity ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: tooltipPos.x + 20, top: tooltipPos.y + 20 }}
        >
          {isOrganism(hoveredEntity) ? (
            <div className="space-y-3">
              <div className={`font-black uppercase tracking-[0.2em] flex items-center gap-3 ${hoveredEntity.type === EntityType.PREY ? 'text-emerald-400' : 'text-red-400'}`}>
                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] animate-pulse ${hoveredEntity.type === EntityType.PREY ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {hoveredEntity.type === EntityType.PREY ? 'Травоїдний' : 'Хижак'}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[9px]">
                  <span className="text-gray-500">Енергія</span>
                  <span className="text-blue-400 font-bold">{Math.round(hoveredEntity.energy ?? 0)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 transition-all"
                    style={{ width: `${(hoveredEntity.normalizedEnergy ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Стан</span>
                <span className={`text-right font-bold ${getStateColor(hoveredEntity.state)}`}>{getStateLabel(hoveredEntity.state)}</span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Покоління</span>
                <span className="text-purple-400 text-right font-bold">#{hoveredEntity.genome?.generation ?? 0}</span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Швидкість</span>
                <span className="text-white text-right">{(hoveredEntity.genome?.maxSpeed ?? 0).toFixed(2)}</span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Зір</span>
                <span className="text-white text-right">{Math.round(hoveredEntity.genome?.senseRadius ?? 0)}</span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Вік</span>
                <span className="text-white text-right">{hoveredEntity.age ?? 0}</span>

                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Шлейф</span>
                <span className={`${hoveredEntity.trailEnabled ? 'text-emerald-400' : 'text-gray-600'} text-right font-bold`}>
                  {hoveredEntity.trailEnabled ? 'УВІМК' : 'ВИМК'}
                </span>
              </div>

              <div className="text-[9px] text-gray-500 italic text-center mt-2 border-t border-white/5 pt-2">
                Клікніть для перемикання шлейфу
              </div>
            </div>
          ) : isObstacle(hoveredEntity) ? (
            <div className="space-y-3">
              <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-purple-400">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-sm shadow-[0_0_10px_#a855f7]" />
                Аномалія
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Радіус</span>
                <span className="text-white text-right">{Math.round(hoveredEntity.radius)}</span>
              </div>
            </div>
          ) : isFood(hoveredEntity) ? (
            <div className="space-y-3">
              <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-yellow-400">
                <div className="w-2.5 h-2.5 bg-yellow-400 rotate-45 animate-spin shadow-[0_0_15px_#facc15]" />
                Енергокристал
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 uppercase tracking-tighter text-[9px]">Поживність</span>
                <span className="text-yellow-400 font-bold text-right">+{hoveredEntity.energyValue}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Viewport;
