import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
// import sinon from "sinon";

module('Unit | Service | scanner', function (hooks) {
  setupTest(hooks);

  // TODO: Replace this with your real tests.
  test('it exists', function (assert) {
    let service = this.owner.lookup('service:EmberBarcodeScanner@scanner');
    assert.ok(service);
  });
});
