import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { registerDestructor } from '@ember/destroyable';

export default class ScannerComponent extends Component {
  @service('EmberBarcodeScanner@scanner')
  scannerService;

  onScan;

  constructor() {
    super(...arguments);
    this.scannerService.initialize();
    this.scannerService.onScan = this.args.onScan;

    registerDestructor(this, () => this.scannerService.removeEventListener());
  }
}
