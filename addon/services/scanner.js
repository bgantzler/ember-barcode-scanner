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
  onScanError; //: function(oDebug){}, // Callback after detection of an unsuccessful scanning (scanned string in parameter)
  onKeyProcess; //: function(sChar, oEvent){}, // Callback after receiving and processing a char (scanned char in parameter)
  onKeyDetect; //: function(iKeyCode, oEvent){}, // Callback after detecting a keyDown (key char in parameter) - in contrast to onKeyProcess, this fires for non-character keys like tab, arrows, etc. too!
  onPaste; //: function(sPasted, oEvent){}, // Callback after receiving a value on paste, no matter if it is a valid code or not
  keyCodeMapper; //: function(oEvent) {return onScan.decodeKeyEvent(oEvent)}, // Custom function to decode a keydown event into a character. Must return decoded character or NULL if the given event should not be processed.
  onScanButtonLongPress; //: function(){}, // Callback after detection of a successful scan while the scan button was pressed and held down

  //options
  scanButtonKeyCode = false; // Key code of the scanner hardware button (if the scanner button acts as a key itself)
  scanButtonLongPressTime = 500; // How long (ms) the hardware button should be pressed, until a callback gets executed
  timeBeforeScanTest = 100; // Wait duration (ms) after keypress event to check if scanning is finished
  avgTimeByChar = 30; // Average time (ms) between 2 chars. Used to differentiate between keyboard typing and scanning
  minLength = 6; // Minimum length for a scanning
  suffixKeyCodes = [9, 13]; // Chars to remove and means end of scanning
  prefixKeyCodes = []; // Chars to remove and means start of scanning
  stopPropagation = false; // Stop immediate propagation on keypress event
  preventDefault = false; // Prevent default action on keypress event
  captureEvents = true; // Get the events before any listeners deeper in the DOM
  reactToKeydown = true; // look for scan input in keyboard events
  reactToPaste = false; // look for scan input in paste events
  singleScanQty = 1; // Quantity of Items put out to onScan in a single scan

  firstCharTime = 0;
  lastCharTime = 0;
  accumulatedString = '';
  testTimer = undefined;
  longPressTimeStart = 0;
  longPressed = false;

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

  /**
   * @private
   * @return void
   */
  #reinitialize() {
    this.firstCharTime = 0;
    this.lastCharTime = 0;
    this.accumulatedString = '';
  }

  addEventListener() {
    assert('window is required', this.window);
    assert('window.addEventListener is required', this.window.addEventListener);

    // initializing handlers (based on settings)
    if (this.reactToPaste === true) {
      this.window.addEventListener(
        'paste',
        this.handlePaste,
        this.captureEvents
      );
    }
    if (this.scanButtonKeyCode !== false) {
      this.window.addEventListener(
        'keyup',
        this.handleKeyUp,
        this.captureEvents
      );
    }
    if (this.reactToKeydown || this.scanButtonKeyCode !== false) {
      this.window.addEventListener(
        'keydown',
        this.handleKeyDown,
        this.captureEvents
      );
    }

    // this.window.addEventListener('keydown', this.onKeyup, true);
    this.enable();
  }

  removeEventListener() {
    assert('window is required', this.window);
    assert(
      'window.removeEventListener is required',
      this.window.removeEventListener
    );

    if (this.reactToPaste === true) {
      this.window.removeEventListener('paste', this.handlePaste, true);
    }
    if (this.scanButtonKeyCode !== false) {
      this.window.removeEventListener('keyup', this.handleKeyUp, true);
    }
    if (this.reactToKeydown || this.scanButtonKeyCode !== false) {
      this.window.removeEventListener('keydown', this.handleKeyDown, true);
    }

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
            this.barcode = this.barcode + this.decodeKeyEvent(event);
          }
        }
      }
    }
  }

  /**
   * Transforms key codes into characters.
   *
   * By default, only the follwing key codes are taken into account
   * - 48-90 (letters and regular numbers)
   * - 96-105 (numeric keypad numbers)
   * - 106-111 (numeric keypad operations)
   *
   * All other keys will yield empty strings!
   *
   * The above keycodes will be decoded using the KeyboardEvent.key property on modern
   * browsers. On older browsers the method will fall back to String.fromCharCode()
   * putting the result to upper/lower case depending on KeyboardEvent.shiftKey if
   * it is set.
   *
   * @param oEvent KeyboardEvent
   * @return string
   */
  decodeKeyEvent(oEvent) {
    const iCode = this.getNormalizedKeyNum(oEvent);
    switch (true) {
      case iCode >= 48 && iCode <= 90: // numbers and letters
      case iCode >= 106 && iCode <= 111: {
        // operations on numeric keypad (+, -, etc.)
        if (oEvent.key !== undefined && oEvent.key !== '') {
          return oEvent.key;
        }

        let sDecoded = String.fromCharCode(iCode);
        switch (oEvent.shiftKey) {
          case false:
            sDecoded = sDecoded.toLowerCase();
            break;
          case true:
            sDecoded = sDecoded.toUpperCase();
            break;
        }
        return sDecoded;
      }
      case iCode >= 96 && iCode <= 105: // numbers on numeric keypad
        return 0 + (iCode - 96);
    }
    return '';
  }

  /**
   * @private
   * @param oEvent KeyboardEvent
   * @return int
   * @see https://www.w3schools.com/jsref/event_key_keycode.asp
   */
  getNormalizedKeyNum(oEvent) {
    return oEvent.which || oEvent.keyCode;
  }

  /**
   * @private
   * @param oEvent KeyboardEvent
   * @return void
   */
  @action
  handleKeyDown(oEvent) {
    const iKeyCode = this.getNormalizedKeyNum(oEvent);
    const character = this.decodeKeyEvent(oEvent);

    let bScanFinished = false;

    if (this.onKeyDetect?.(this, iKeyCode, oEvent) === false) {
      return;
    }

    // If it's just the button of the scanner, ignore it and wait for the real input
    if (
      this.scanButtonKeyCode !== false &&
      iKeyCode === this.scanButtonKeyCode
    ) {
      // if the button was first pressed, start a timeout for the callback, which gets interrupted if the scanbutton gets released
      if (!this.longPressed) {
        this.longPressTimer = setTimeout(
          this.onScanButtonLongPress,
          this.scanButtonLongPressTime,
          this
        );
        this.longPressed = true;
      }

      return;
    }

    switch (true) {
      // If it's not the first character and we encounter a terminating character, trigger scan process
      case this.firstCharTime && this.suffixKeyCodes.indexOf(iKeyCode) !== -1:
        oEvent.preventDefault();
        oEvent.stopImmediatePropagation();
        bScanFinished = true;
        break;

      // If it's the first character and we encountered one of the starting characters, don't process the scan
      case !this.firstCharTime && this.prefixKeyCodes.indexOf(iKeyCode) !== -1:
        oEvent.preventDefault();
        oEvent.stopImmediatePropagation();
        bScanFinished = false;
        break;

      // Otherwise, just add the character to the scan string we're building
      default:
        if (character === '') {
          return;
        }
        this.accumulatedString += character;

        if (this.preventDefault) {
          oEvent.preventDefault();
        }
        if (this.stopPropagation) {
          oEvent.stopImmediatePropagation();
        }

        bScanFinished = false;
        break;
    }

    if (!this.firstCharTime) {
      this.firstCharTime = Date.now();
    }

    this.lastCharTime = Date.now();

    if (this.testTimer) {
      clearTimeout(this.testTimer);
    }

    if (bScanFinished) {
      this.validateScanCode(this.accumulatedString);
      this.testTimer = undefined;
    } else {
      this.testTimer = setTimeout(
        this.validateScanCode,
        this.timeBeforeScanTest,
        this,
        this.accumulatedString
      );
    }

    this.onKeyProcess?.(character, oEvent);
  }

  /**
   * Validates the scan code accumulated by the given DOM element and fires the respective events.
   *
   * @private
   * @param sScanCode
   * @return boolean
   */
  @action
  validateScanCode(sScanCode) {
    const iSingleScanQty = this.singleScanQty;
    const iFirstCharTime = this.firstCharTime;
    const iLastCharTime = this.lastCharTime;
    let oScanError = {};

    switch (true) {
      // detect codes that are too short
      case sScanCode.length < this.minLength:
        oScanError = {
          message: 'Received code is shorter than minimal length',
        };
        break;

      // detect codes that were entered too slow
      case iLastCharTime - iFirstCharTime >
        sScanCode.length * this.avgTimeByChar:
        oScanError = {
          message: 'Received code was not entered in time',
        };
        break;

      // if a code was not filtered out earlier it is valid
      default:
        this.onScan(sScanCode, iSingleScanQty);
        this.#reinitialize();
        return true;
    }

    // If an error occurred (otherwise the method would return earlier) create an object for error detection
    oScanError.scanCode = sScanCode;
    oScanError.scanDuration = iLastCharTime - iFirstCharTime;
    oScanError.avgTimeByChar = this.avgTimeByChar;
    oScanError.minLength = this.minLength;

    this?.onScanError(oScanError);

    this.#reinitialize();
    return false;
  }

  /**
   * @private
   * @return void
   * @param oEvent
   */
  @action
  handlePaste(oEvent) {
    const sPasteString = (event.clipboardData || window.clipboardData).getData(
      'text'
    );

    oEvent.preventDefault();

    if (this.stopPropagation) {
      oEvent.stopImmediatePropagation();
    }

    this.onPaste?.(sPasteString, event);

    this.firstCharTime = 0;
    this.lastCharTime = 0;

    // validate the string
    this.validateScanCode(sPasteString);
  }

  /**
   * @private
   * @return void
   * @param oEvent
   */
  @action
  handleKeyUp(oEvent) {
    const iKeyCode = this.getNormalizedKeyNum(oEvent);

    // if hardware key is not being pressed anymore stop the timeout and reset
    if (iKeyCode === this.scanButtonKeyCode) {
      clearTimeout(this.longPressTimer);
      this.longPressed = false;
    }
  }
}
