/** How the world grid is drawn for the current settings. A grid with no opacity is not drawn at all. */
export interface GridAppearance {
    readonly visible: boolean;
    readonly opacity: number;
}

export const gridAppearance = (showGrid: boolean, gridOpacity: number): GridAppearance => ({
    visible: showGrid && gridOpacity > 0,
    opacity: gridOpacity,
});
