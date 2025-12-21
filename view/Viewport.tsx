
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { SimulationEngine } from '../simulation/Engine';
import { WORLD_SIZE } from '../constants';
import { EntityType } from '../types';
import { Organism, Food, Obstacle } from '../simulation/Entity';

interface ViewportProps {
  engine: SimulationEngine;
  isPaused: boolean;
  speed: number;
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number; // 1 to 0
}

interface TrailParticles {
  points: THREE.Points;
  particles: Particle[];
}

const MAX_TRAIL_PARTICLES = 100;

const Viewport: React.FC<ViewportProps> = ({ engine, isPaused, speed }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());
  const speedAccumulator = useRef(0);
  
  const speedRef = useRef(speed);
  const isPausedRef = useRef(isPaused);
  
  const [hoveredEntity, setHoveredEntity] = useState<Organism | Food | Obstacle | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(WORLD_SIZE * 1.2, WORLD_SIZE * 1.2, WORLD_SIZE * 1.2);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.5, WORLD_SIZE * 3);
    pointLight.position.set(WORLD_SIZE / 2, WORLD_SIZE * 1.5, WORLD_SIZE / 2);
    scene.add(pointLight);

    const boxGeo = new THREE.BoxGeometry(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.1 });
    const boxLines = new THREE.LineSegments(boxEdges, boxMat);
    boxLines.position.set(WORLD_SIZE / 2, WORLD_SIZE / 2, WORLD_SIZE / 2);
    scene.add(boxLines);

    const MAX_INSTANCES = 1500;
    const orgGeo = new THREE.ConeGeometry(0.8, 2.5, 8);
    orgGeo.rotateX(Math.PI / 2);
    
    const preyMat = new THREE.MeshPhongMaterial({ color: 0x44ff44, transparent: true, opacity: 0.9 });
    const preyMesh = new THREE.InstancedMesh(orgGeo, preyMat, MAX_INSTANCES);
    scene.add(preyMesh);

    const predMat = new THREE.MeshPhongMaterial({ color: 0xff4444, transparent: true, opacity: 0.9 });
    const predMesh = new THREE.InstancedMesh(orgGeo, predMat, MAX_INSTANCES);
    scene.add(predMesh);

    const foodGeo = new THREE.TetrahedronGeometry(1, 0);
    const foodMat = new THREE.MeshPhongMaterial({ 
      color: 0xffff44, 
      emissive: 0xffaa00,
      emissiveIntensity: 0.5,
      transparent: true, 
      opacity: 0.8,
      shininess: 100 
    });
    const foodMesh = new THREE.InstancedMesh(foodGeo, foodMat, MAX_INSTANCES * 2);
    scene.add(foodMesh);

    const obstacleMeshes: THREE.Mesh[] = [];
    engine.obstacles.forEach(obs => {
      const geo = new THREE.IcosahedronGeometry(obs.radius, 2);
      const mat = new THREE.MeshPhongMaterial({ 
        color: obs.color, 
        transparent: true, 
        opacity: obs.opacity, 
        flatShading: true,
        wireframe: Math.random() > 0.7
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(obs.position.x, obs.position.y, obs.position.z);
      mesh.userData = { id: obs.id, type: EntityType.OBSTACLE };
      scene.add(mesh);
      obstacleMeshes.push(mesh);
    });

    // Trail particle system map
    const trailsMap = new Map<string, TrailParticles>();

    const dummy = new THREE.Object3D();
    const forward = new THREE.Vector3(0, 0, 1);
    const idMaps = {
      prey: new Map<number, string>(),
      pred: new Map<number, string>(),
      food: new Map<number, string>()
    };

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
          if (org) {
            org.trailEnabled = !org.trailEnabled;
          }
        }
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    let time = 0;

    const animate = () => {
      time += 0.016;

      if (!isPausedRef.current) {
        speedAccumulator.current += speedRef.current;
        const ticksToRun = Math.floor(speedAccumulator.current);
        speedAccumulator.current -= ticksToRun;
        for (let s = 0; s < ticksToRun; s++) {
          engine.update();
        }
      }

      preyMat.opacity = engine.config.organismOpacity;
      predMat.opacity = engine.config.organismOpacity;
      foodMat.opacity = engine.config.foodOpacity;
      boxMat.opacity = engine.config.gridOpacity;
      foodMat.emissiveIntensity = 0.4 + Math.sin(time * 3) * 0.3;

      idMaps.prey.clear();
      idMaps.pred.clear();
      idMaps.food.clear();

      let preyIdx = 0, predIdx = 0;
      engine.organisms.forEach(o => {
        dummy.position.set(o.position.x, o.position.y, o.position.z);
        const s = o.radius * engine.config.organismScale;
        dummy.scale.set(s, s, s);
        
        if (o.velocity.x !== 0 || o.velocity.y !== 0 || o.velocity.z !== 0) {
          const dir = new THREE.Vector3(o.velocity.x, o.velocity.y, o.velocity.z).normalize();
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

        // --- Smoky Trail Handling ---
        if (o.trailEnabled && !o.isDead) {
          let trail = trailsMap.get(o.id);
          if (!trail) {
            const geom = new THREE.BufferGeometry();
            const positions = new Float32Array(MAX_TRAIL_PARTICLES * 3);
            const sizes = new Float32Array(MAX_TRAIL_PARTICLES);
            const opacities = new Float32Array(MAX_TRAIL_PARTICLES);
            geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            geom.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

            // Custom smoky particle material
            const mat = new THREE.PointsMaterial({ 
              color: 0xffffff,
              size: 2,
              transparent: true, 
              opacity: 0.3,
              blending: THREE.AdditiveBlending,
              sizeAttenuation: true
            });

            const points = new THREE.Points(geom, mat);
            scene.add(points);
            
            trail = { points, particles: [] };
            trailsMap.set(o.id, trail);
          }

          // Emit new particle if moving
          const vMag = Math.sqrt(o.velocity.x**2 + o.velocity.y**2 + o.velocity.z**2);
          if (vMag > 0.1 && Math.random() > 0.3) {
             trail.particles.push({
                position: new THREE.Vector3(o.position.x, o.position.y, o.position.z),
                velocity: new THREE.Vector3(
                  (Math.random() - 0.5) * 0.2,
                  (Math.random() - 0.5) * 0.2 + 0.1, // Slight upwards drift
                  (Math.random() - 0.5) * 0.2
                ),
                life: 1.0
             });
          }

          // Update particles
          const geom = trail.points.geometry as THREE.BufferGeometry;
          const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
          
          for (let i = trail.particles.length - 1; i >= 0; i--) {
            const p = trail.particles[i];
            p.life -= 0.015; // Particle decay rate
            p.position.add(p.velocity);
            if (p.life <= 0) {
              trail.particles.splice(i, 1);
            }
          }

          // Limit count
          if (trail.particles.length > MAX_TRAIL_PARTICLES) {
            trail.particles.shift();
          }

          // Set positions to attribute
          for (let i = 0; i < MAX_TRAIL_PARTICLES; i++) {
            if (i < trail.particles.length) {
              const p = trail.particles[i];
              posAttr.setXYZ(i, p.position.x, p.position.y, p.position.z);
            } else {
              posAttr.setXYZ(i, 0, -1000, 0); // Hide off-screen
            }
          }
          posAttr.needsUpdate = true;
          (trail.points.material as THREE.PointsMaterial).opacity = 0.4;
          
        } else {
          const trail = trailsMap.get(o.id);
          if (trail) {
            scene.remove(trail.points);
            trail.points.geometry.dispose();
            (trail.points.material as THREE.Material).dispose();
            trailsMap.delete(o.id);
          }
        }
      });

      // Global trails cleanup
      trailsMap.forEach((trail, id) => {
        if (!engine.organisms.has(id)) {
          scene.remove(trail.points);
          trail.points.geometry.dispose();
          (trail.points.material as THREE.Material).dispose();
          trailsMap.delete(id);
        }
      });

      preyMesh.count = preyIdx;
      preyMesh.instanceMatrix.needsUpdate = true;
      predMesh.count = predIdx;
      predMesh.instanceMatrix.needsUpdate = true;

      let foodIdx = 0;
      engine.food.forEach(f => {
        if (foodIdx < MAX_INSTANCES) {
          const basePos = f.position;
          const s = f.radius * 2.5 * engine.config.foodScale;
          
          for(let i = 0; i < 2; i++) {
            dummy.position.set(
              basePos.x + (i === 0 ? 0 : Math.sin(time * 5) * 2),
              basePos.y + (i === 0 ? Math.cos(time * 5) * 2 : 0),
              basePos.z + (i === 0 ? 0 : Math.cos(time * 5) * 2)
            );
            dummy.scale.set(s, s, s);
            dummy.rotation.set(time * (1 + i), time * 0.5, 0);
            dummy.updateMatrix();
            if (i === 0) idMaps.food.set(foodIdx, f.id);
            foodMesh.setMatrixAt(foodIdx++, dummy.matrix);
          }
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
      renderer.dispose();
      orgGeo.dispose();
      foodGeo.dispose();
      preyMat.dispose();
      predMat.dispose();
      foodMat.dispose();
      boxGeo.dispose();
      boxEdges.dispose();
      boxMat.dispose();
      obstacleMeshes.forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      trailsMap.forEach(trail => {
        scene.remove(trail.points);
        trail.points.geometry.dispose();
        (trail.points.material as THREE.Material).dispose();
      });
    };
  }, [engine]);

  const isOrganism = (e: any): e is Organism => e && (e.type === EntityType.PREY || e.type === EntityType.PREDATOR);
  const isObstacle = (e: any): e is Obstacle => e && e.type === EntityType.OBSTACLE;

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {hoveredEntity && (
        <div 
          className="fixed pointer-events-none bg-black/90 backdrop-blur-2xl border border-white/10 p-5 rounded-2xl text-[11px] z-50 shadow-2xl ring-1 ring-white/10"
          style={{ left: tooltipPos.x + 20, top: tooltipPos.y + 20 }}
        >
          {isOrganism(hoveredEntity) ? (
            <div className="space-y-3">
              <div className={`font-black uppercase tracking-[0.2em] flex items-center gap-3 ${hoveredEntity.type === EntityType.PREY ? 'text-green-400' : 'text-red-400'}`}>
                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${hoveredEntity.type === EntityType.PREY ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                {hoveredEntity.type === EntityType.PREY ? 'Травоїдний' : 'Хижак'}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 font-bold uppercase tracking-tighter">ID</span>
                <span className="text-white font-mono text-right">{hoveredEntity.id}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Енергія</span>
                <span className="text-blue-400 font-bold text-right">{Math.round(hoveredEntity.energy)}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Швидкість</span>
                <span className="text-white text-right">{hoveredEntity.genome.maxSpeed.toFixed(2)}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Зір</span>
                <span className="text-white text-right">{Math.round(hoveredEntity.genome.senseRadius)}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Вік</span>
                <span className="text-white text-right">{hoveredEntity.age}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Шлейф</span>
                <span className={`${hoveredEntity.trailEnabled ? 'text-emerald-400' : 'text-gray-600'} text-right font-bold`}>{hoveredEntity.trailEnabled ? 'УВІМК' : 'ВИМК'}</span>
              </div>
              <div className="text-[9px] text-gray-500 italic text-center mt-2">Клікніть, щоб перемкнути шлейф</div>
            </div>
          ) : isObstacle(hoveredEntity) ? (
             <div className="space-y-3">
              <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-purple-400">
                <div className="w-2.5 h-2.5 bg-purple-400 rounded-sm shadow-[0_0_10px_#a855f7]" />
                Аномалія
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 font-bold uppercase tracking-tighter">ID</span>
                <span className="text-white font-mono text-right">{hoveredEntity.id}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Радіус</span>
                <span className="text-white text-right">{Math.round(hoveredEntity.radius)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="font-black uppercase tracking-[0.2em] flex items-center gap-3 text-yellow-400">
                <div className="w-2.5 h-2.5 bg-yellow-400 rotate-45 animate-spin shadow-[0_0_15px_#facc15]" />
                Енергокристал
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 opacity-90 border-t border-white/5 pt-3">
                <span className="text-gray-500 font-bold uppercase tracking-tighter">ID</span>
                <span className="text-white font-mono text-right">{hoveredEntity.id}</span>
                <span className="text-gray-500 font-bold uppercase tracking-tighter">Поживність</span>
                <span className="text-yellow-400 font-bold text-right">+{hoveredEntity.energyValue}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Viewport;
