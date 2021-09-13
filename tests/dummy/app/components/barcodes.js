import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BarcodesComponent extends Component {
  @service('EmberBarcodeScanner@scanner')
  scannerService;

  @service('EmberGs1Parser@barcodeParser')
  gs1ParserService;

  @tracked
  barcodes = [];

  constructor() {
    super(...arguments);
  }

  @action
  onClear() {
    this.barcodes = [];
  }

  @action
  restartScanner() {
    this.scannerService.reset();
  }

  @action
  onScan(data) {
    console.log(data);

    // this is a "hack" to not allow parsing of smaller barcodes with a length < 20
    if (data.length > 19) {
      const bc = this.gs1ParserService.parseBarcode(
        this.gs1ParserService.replaceSeparators(data)
      );
      this.barcodes = [...this.barcodes, bc];
    }
  }
}
