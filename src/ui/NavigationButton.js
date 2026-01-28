/**
 * NavigationButton - Back button component for navigation
 */

export class NavigationButton {
  /**
   * Create a navigation back button
   * @param {string} containerId - ID of the container to insert button
   * @param {function} onClick - Click callback
   * @param {object} options - Options
   */
  constructor(containerId, onClick, options = {}) {
    this.containerId = containerId;
    this.onClick = onClick;
    this.options = {
      label: '← Back',
      className: 'back-button',
      insertPosition: 'afterbegin', // 'afterbegin' or 'beforeend'
      ...options,
    };

    this.button = null;
    this.create();
  }

  /**
   * Create the button element
   */
  create() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`NavigationButton: Container #${this.containerId} not found`);
      return;
    }

    this.button = document.createElement('button');
    this.button.className = this.options.className;
    this.button.textContent = this.options.label;
    this.button.id = this.options.id || `${this.containerId}-back-button`;

    this.button.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.onClick) {
        this.onClick();
      }
    });

    container.insertAdjacentElement(this.options.insertPosition, this.button);
  }

  /**
   * Show the button
   */
  show() {
    if (this.button) {
      this.button.style.display = '';
    }
  }

  /**
   * Hide the button
   */
  hide() {
    if (this.button) {
      this.button.style.display = 'none';
    }
  }

  /**
   * Remove the button
   */
  remove() {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }

  /**
   * Get the button element
   */
  getElement() {
    return this.button;
  }
}
