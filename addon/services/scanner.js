import Service, { inject as service } from '@ember/service';
import { isPresent } from '@ember/utils';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { assert } from '@ember/debug';

const ENTER_KEY = 13;

export default class ScannerService extends Service {
  @service('browser/window')
  window;

  @tracked
  active = true;

  barcode = '';
  //   previousState;

  onScan;

  get isActive() {
    return this.active;
  }

  enable() {
    this.active = true;
  }

  disable() {
    this.active = false;
  }

  clear() {
    this.barcode = '';
  }

  reset() {
    this.clear();
    this.initialize();
  }

  initialize() {
    this.removeEventListener();
    this.addEventListener();
  }

  addEventListener() {
    assert('window is required', this.window);
    assert('window.addEventListener is required', this.window.addEventListener);

    this.window.addEventListener('keydown', this.onKeyup, true);
    this.enable();
  }

  removeEventListener() {
    assert('window is required', this.window);
    assert(
      'window.removeEventListener is required',
      this.window.removeEventListener
    );

    this.window.removeEventListener('keydown', this.onKeyup, true);
    this.disable();
  }

  constructor() {
    super(...arguments);
    registerDestructor(this, () => this.removeEventListener());
  }

  @action
  onKeyup(event) {
    console.log(event.key, event.keyCode, event);
    if (isPresent(event)) {
      const keyCode = event.keyCode;

      if (this.isActive) {
        if (keyCode === ENTER_KEY) {
          this.onScan?.(this.barcode);
          this.clear();
        } else {
          if (event.key !== 'Shift') {
            this.barcode = this.barcode + event.key;
          }
        }
      }
    }
  }
}
