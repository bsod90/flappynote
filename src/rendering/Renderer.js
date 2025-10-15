/**
 * Renderer - Abstract base class for rendering
 * This allows easy extension to 3D rendering in the future
 */

export class Renderer {
  constructor(canvas) {
    if (new.target === Renderer) {
      throw new Error('Renderer is an abstract class and cannot be instantiated directly');
    }
    this.canvas = canvas;
  }

  /**
   * Initialize the renderer
   * @abstract
   */
  initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Clear the canvas
   * @abstract
   */
  clear() {
    throw new Error('clear() must be implemented by subclass');
  }

  /**
   * Render the game state
   * @abstract
   * @param {object} gameState - Current game state
   */
  render(gameState) {
    throw new Error('render() must be implemented by subclass');
  }

  /**
   * Resize the canvas
   * @abstract
   * @param {number} width
   * @param {number} height
   */
  resize(width, height) {
    throw new Error('resize() must be implemented by subclass');
  }

  /**
   * Clean up resources
   * @abstract
   */
  dispose() {
    throw new Error('dispose() must be implemented by subclass');
  }
}
