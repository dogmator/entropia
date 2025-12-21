
/**
 * ЦЕНТРАЛЬНА КОНФІГУРАЦІЯ (BALANCED v2)
 */

// Параметри світу
export const WORLD_SIZE = 600;   // Зменшено для більшої щільності подій
export const CELL_SIZE = 80;    

// Ліміти продуктивності
export const MAX_TOTAL_ORGANISMS = 600; 

// Початкові популяції
export const INITIAL_PREY = 100;     
export const INITIAL_PREDATOR = 20;  

// Ресурси (Їжа)
export const MAX_FOOD = 300;         
// 0.4 * 60 FPS = 24 еды в секунду
export const FOOD_SPAWN_RATE = 0.4;    

// Метаболізм (Ентропія)
export const METABOLIC_CONSTANTS = {
  exist: 0.05,    // Существование коштує енергії
  move: 0.01,     // Штраф за швидкість
  sense: 0.001,   // Плата за зір
};

// Репродукція
export const REPRODUCTION_ENERGY_THRESHOLD = 200; 
export const INITIAL_ENERGY = 120; 

// Фізика (Boids & Steering)
export const PHYSICS = {
  dt: 1 / 60,               
  drag: 0.96,               
  separationWeight: 2.5,    
  alignmentWeight: 1.2,     
  cohesionWeight: 1.0,      
  seekWeight: 3.5,          
  avoidWeight: 3.0          
};

// UI Config
export const UI_CONFIG = {
  sidebarMaxWidth: '350px', 
  historyLength: 60,        
  updateFrequency: 30       
};

// Параметри відображення за замовчуванням
export const INITIAL_VIS_CONFIG = {
  organismOpacity: 0.9,
  foodOpacity: 0.8,
  organismScale: 1.0,
  foodScale: 1.2,
  showGrid: true,
  gridOpacity: 0.1
};
