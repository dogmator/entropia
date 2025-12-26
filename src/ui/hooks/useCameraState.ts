

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
