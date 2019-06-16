import raf, { cancel as cancelRaf } from 'raf';
import {
  doesStringContainHTMLTag,
  getDOMElementFromString,
  getRandomInteger,
} from './../utils';
import { EVENT_NAMES, VISIBLE_NODE_TYPES } from './constants';
import './Typewriter.scss';

class Typewriter {
  state = {
    cursorAnimation: null,
    lastFrameTime: null,
    pauseUntil: null,
    eventQueue: [],
    eventLoop: null,
    eventLoopPaused: false,
    reverseCalledEvents: [],
    calledEvents: [],
    visibleNodes: [],
    initialOptions: null,
    elements: {
      container: null,
      wrapper: document.createElement('span'),
      cursor: document.createElement('span'),
    },
  }

  options = {
    strings: null,
    cursor: '|',
    delay: 'natural',
    deleteSpeed: 'natural',
    loop: false,
    autoStart: false,
    devMode: false,
    wrapperClassName: 'Typewriter__wrapper',
    cursorClassName: 'Typewriter__cursor',
  }

  constructor(container, options) {
    if(!container) {
      throw new Error('No container element was provided');
    }

    if(typeof container === 'string') {
      const containerElement = document.querySelector(container);

      if(!containerElement) {
        throw new Error('Could not find container element');
      }

      this.state.elements.container = containerElement;
    } else {
      this.state.elements.container = container;
    }

    if(options) {
      this.options = {
        ...this.options,
        ...options
      };
    }

    // Make a copy of the options used to reset options when looping
    this.state.initialOptions = { ...this.options };

    this.init();
  }

  init() {
    this.setupWrapperElement();

    if(this.options.autoStart === true && this.options.strings) {
      this.typeOutAllStrings().start();
		}
  }

  /**
   * Replace all child nodes of provided element with
   * state wrapper element used for typewriter effect
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  setupWrapperElement = () => {
    this.state.elements.wrapper.className = this.options.wrapperClassName;
    this.state.elements.cursor.className = this.options.cursorClassName;

    this.state.elements.cursor.innerHTML = this.options.cursor;
    this.state.elements.container.innerHTML = '';

    this.state.elements.container.appendChild(this.state.elements.wrapper);
    this.state.elements.container.appendChild(this.state.elements.cursor);
  }

  /**
   * Start typewriter effect
   */
  start = () => {
    this.state.eventLoopPaused = false;
    this.runEventLoop();

    return this;
  }

  /**
   * Pause the event loop
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  pause = () => {
    this.state.eventLoopPaused = true;

    return this;
  }

  /**
   * Destroy current running instance
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  stop = () => {
    if(this.state.eventLoop) {
      cancelRaf(this.state.eventLoop);
      this.state.eventLoop = null;
    }

    return this;
  }

  /**
   * Add pause event to queue for ms provided
   *
   * @param {Number} ms Time in ms to pause for
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  pauseFor = (ms) => {
    this.addEventToQueue(EVENT_NAMES.PAUSE_FOR, { ms });

    return this;
  }

  /**
   * Start typewriter effect by typing
   * out all strings provided
   *
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  typeOutAllStrings = () => {
    if(typeof this.options.strings === 'string') {
      this.typeString(this.options.strings)
        .pauseFor(1500);
      return this;
    }

    this.options.strings.forEach(string => {
      this.typeString(string)
        .pauseFor(1500)
        .deleteAll();
    });

    return this;
  }

  /**
   * Adds string characters to event queue for typing
   *
   * @param {String} string String to type
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  typeString = (string) => {
    if(doesStringContainHTMLTag(string)) {
      return this.typeOutHTMLString(string);
    }

    const characters = string.split('');

    characters.forEach(character => {
      this.addEventToQueue(EVENT_NAMES.TYPE_CHARACTER, { character });
    });

    return this;
  }

  /**
   * Type out a string which is wrapper around HTML tag
   *
   * @param {String} string String to type
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  typeOutHTMLString = (string) => {
    const childNodes = getDOMElementFromString(string);

    if(childNodes.length > 0 ) {
      for(let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        if(node.nodeType && node.nodeType === 1) {
          const text = node.textContent;
          const characters = text.split('');

          // Reset innerText of HTML element
          node.textContent = '';

          // Add event queue item to insert HTML tag before typing characters
          this.addEventToQueue(EVENT_NAMES.ADD_HTML_TAG_ELEMENT, {
            node,
          });

          if(!characters.length) {
            return this;
          }

          characters.forEach(character => {
            this.addEventToQueue(EVENT_NAMES.TYPE_CHARACTER, {
              character,
              node,
            });
          });
        } else {
          if(node.textContent) {
            this.typeString(node.textContent);
          }
        }
      }
    }
    
    return this;
  }

  /**
   * Add delete all characters to event queue
   *
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  deleteAll = (speed = 'natural') => {
    this.addEventToQueue(EVENT_NAMES.REMOVE_ALL, { speed });
    return this;
  }

  /**
   * Change delete speed
   *
   * @param {Number} speed Speed to use for deleting characters
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  changeDeleteSpeed = (speed) => {
    if(!speed) {
      throw new Error('Must provide new delete speed');
    }

    this.addEventToQueue(EVENT_NAMES.CHANGE_DELETE_SPEED, { speed });

    return this;
  }

  /**
   * Change delay when typing
   *
   * @param {Number} delay Delay when typing out characters
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  changeDelay = (delay) => {
    if(!delay) {
      throw new Error('Must provide new delay');
    }

    this.addEventToQueue(EVENT_NAMES.CHANGE_DELAY, { delay });

    return this;
  }

  /**
   * Add delete character to event queue for amount of characters provided
   *
   * @param {Number} amount Number of characters to remove
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  deleteChars = (amount) => {
    if(!amount) {
      throw new Error('Must provide amount of characters to delete');
    }

    for(let i = 0; i < amount; i++) {
      this.addEventToQueue(EVENT_NAMES.REMOVE_CHARACTER);
    }

    return this;
  }

  /**
   * Add an event item to call a callback function
   *
   * @param {cb}      cb        Callback function to call
   * @param {Object}  thisArg   thisArg to use when calling function
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  callFunction = (cb, thisArg) => {
    if(!cb || typeof cb !== 'function') {
      throw new Error('Callbak must be a function');
    }
    
    this.addEventToQueue(EVENT_NAMES.CALL_FUNCTION, { cb, thisArg });

    return this;
  }

  /**
   * Add type character event for each character
   *
   * @param {Array} characters Array of characters
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  typeCharacters = (characters) => {
    if(!characters || !Array.isArray(characters)) {
      throw new Error('Characters must be an array');
    }
    
    characters.forEach(character => {
      this.addEventToQueue(EVENT_NAMES.TYPE_CHARACTER, { character });
    });
    return this;
  }

  /**
   * Add remove character event for each character
   *
   * @param {Array} characters Array of characters
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  removeCharacters = (characters) => {
    if(!characters || !Array.isArray(characters)) {
      throw new Error('Characters must be an array');
    }

    characters.forEach(() => {
      this.addEventToQueue(EVENT_NAMES.REMOVE_CHARACTER);
    });

    return this;
  }

  /**
   * Add an event to the event queue
   *
   * @param {String}  eventName Name of the event
   * @param {Object}  eventArgs Arguments to pass to event callback
   * @param {Boolean} prepend   Prepend to begining of event queue
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  addEventToQueue = (eventName, eventArgs, prepend = false) => {
    return this.addEventToStateProperty(
      eventName,
      eventArgs,
      prepend,
      'eventQueue'
    );
  }

  /**
   * Add an event to reverse called events used for looping
   *
   * @param {String}  eventName Name of the event
   * @param {Object}  eventArgs Arguments to pass to event callback
   * @param {Boolean} prepend   Prepend to begining of event queue
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  addReverseCalledEvent = (eventName, eventArgs, prepend = false) => {
    const { loop } = this.options;

    if(!loop) {
      return this;
    }

    return this.addEventToStateProperty(
      eventName,
      eventArgs,
      prepend,
      'reverseCalledEvents'
    );
  }

  /**
   * Add an event to correct state property
   *
   * @param {String}  eventName Name of the event
   * @param {Object}  eventArgs Arguments to pass to event callback
   * @param {Boolean} prepend   Prepend to begining of event queue
   * @param {String}  property  Property name of state object
   * @return {Typewriter}
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  addEventToStateProperty = (eventName, eventArgs, prepend = false, property) => {
    const eventItem = {
      eventName,
      eventArgs: eventArgs || {},
    };

    if(prepend) {
      this.state[property] = [
        eventItem,
        ...this.state[property],
      ];
    } else {
      this.state[property] = [
        ...this.state[property],
        eventItem,
      ];
    }

    return this;
  }

  /**
   * Run the event loop and do anything inside of the queue
   *
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  runEventLoop = () => {
    if(!this.state.lastFrameTime) {
      this.state.lastFrameTime = Date.now();
    }

    // Setup variables to calculate if this frame should run
    const nowTime = Date.now();
    const delta = nowTime - this.state.lastFrameTime;

    if(!this.state.eventQueue.length) {
      if(!this.options.loop) {
        return;
      }

      // Reset event queue if we are looping
      this.state.eventQueue = [...this.state.calledEvents];
      this.state.calledEvents = [];
      this.options = {...this.state.initialOptions};
      this.addEventToQueue(EVENT_NAMES.REMOVE_ALL, null, true);
    }

    // Request next frame
    this.state.eventLoop = raf(this.runEventLoop);

    // Check if event loop is paused
    if(this.state.eventLoopPaused) {
      return;
    }

    // Check if state has pause until time
    if(this.state.pauseUntil) {
      // Check if event loop should be paused
      if(nowTime < this.state.pauseUntil) {
        return;
      }

      // Reset pause time
      this.state.pauseUntil = null;
    }

    // Make a clone of event queue
    const eventQueue = [...this.state.eventQueue];

    // Get first event from queue
    const currentEvent = eventQueue.shift();

    // Setup delay variable
    let delay = 0;

    // Check if frame should run or be
    // skipped based on fps interval
    if(
      currentEvent.eventName === EVENT_NAMES.REMOVE_LAST_VISIBLE_NODE ||
      currentEvent.eventName === EVENT_NAMES.REMOVE_CHARACTER
    ) {
      delay = this.options.deleteSpeed === 'natural' ? getRandomInteger(40, 80) : this.options.deleteSpeed;

    } else {
      delay = this.options.delay === 'natural' ? getRandomInteger(120, 160) : this.options.delay;
    }

    if(delta <= delay) {
      return;
    }

    // Get current event args
    const { eventName, eventArgs } = currentEvent;

    this.logInDevMode({ currentEvent, state: this.state, delay });

    // Run item from event loop
    switch(eventName) {
      case EVENT_NAMES.TYPE_CHARACTER: {
        const { character, node } = eventArgs;
        const textNode = document.createTextNode(character);

        if(node) {
          node.appendChild(textNode);
        } else {
          this.state.elements.wrapper.appendChild(textNode);
        }

        this.state.visibleNodes = [
          ...this.state.visibleNodes,
          {
            type: VISIBLE_NODE_TYPES.TEXT_NODE,
            node: textNode,
          },
        ];

        break;
      }

      case EVENT_NAMES.REMOVE_CHARACTER: {
        eventQueue.unshift({
          eventName: EVENT_NAMES.REMOVE_LAST_VISIBLE_NODE,
          eventArgs: { removingCharacterNode: true },
        });
        break;
      }

      case EVENT_NAMES.PAUSE_FOR: {
        const { ms } = currentEvent.eventArgs;
        this.state.pauseUntil = Date.now() + parseInt(ms);
        break;
      }

      case EVENT_NAMES.CALL_FUNCTION: {
        const { cb, thisArg } = currentEvent.eventArgs;

        cb.call(thisArg, {
          elements: this.state.elements,
        });

        break;
      }

      case EVENT_NAMES.ADD_HTML_TAG_ELEMENT: {
        const { node } = currentEvent.eventArgs;
        this.state.elements.wrapper.appendChild(node);
        this.state.visibleNodes = [
          ...this.state.visibleNodes,
          {
            type: VISIBLE_NODE_TYPES.HTML_TAG,
            node,
          },
        ];
        break;
      }

      case EVENT_NAMES.REMOVE_ALL: {
        const { visibleNodes } = this.state;
        const { speed } = eventArgs;
        const removeAllEventItems = [];

        // Change speed before deleteing
        if(speed) {
          removeAllEventItems.push({
            eventName: EVENT_NAMES.CHANGE_DELETE_SPEED,
            eventArgs: { speed },
          });
        }

        for(let i = 0, length = visibleNodes.length; i < length; i++) {
          removeAllEventItems.push({
            eventName: EVENT_NAMES.REMOVE_LAST_VISIBLE_NODE,
            eventArgs: { removingCharacterNode: false },
          });
        }

        // Change speed back to normal after deleteing
        if(speed) {
          removeAllEventItems.push({
            eventName: EVENT_NAMES.CHANGE_DELETE_SPEED,
            eventArgs: { speed: this.options.deleteSpeed },
          });
        }

        eventQueue.unshift(...removeAllEventItems);

        break;
      }

      case EVENT_NAMES.REMOVE_LAST_VISIBLE_NODE: {
        const { removingCharacterNode } = currentEvent.eventArgs;

        if(this.state.visibleNodes.length) {
          const { type, node } = this.state.visibleNodes.pop();
          node.parentNode.removeChild(node);

          // Remove extra node as current deleted one is just an empty wrapper node
          if(type === VISIBLE_NODE_TYPES.HTML_TAG && removingCharacterNode) {
            eventQueue.unshift({
              eventName: EVENT_NAMES.REMOVE_LAST_VISIBLE_NODE,
              eventArgs: {},
            });
          }
        }
        break;
      }

      case EVENT_NAMES.CHANGE_DELETE_SPEED: {
        this.options.deleteSpeed = currentEvent.eventArgs.speed;
        break;
      }

      case EVENT_NAMES.CHANGE_DELAY: {
        this.options.delay = currentEvent.eventArgs.delay;
        break;
      }

      default: {
        break;
      }
    }

    // Add que item to called queue if we are looping
    if(this.options.loop) {
      if(
        currentEvent.eventName !== EVENT_NAMES.REMOVE_ALL &&
        currentEvent.eventName !== EVENT_NAMES.REMOVE_CHARACTER
      ) {
        this.state.calledEvents = [
          ...this.state.calledEvents,
          currentEvent
        ];
      }
    }

    // Replace state even queue with cloned queue
    this.state.eventQueue = eventQueue;

    // Set last frame time so it can be used to calculate next frame
    this.state.lastFrameTime = nowTime;
  }

  /**
   * Log a message in development mode
   *
   * @param {Mixed} message Message or item to console.log
   * @author Tameem Safi <tamem@safi.me.uk>
   */
  logInDevMode(message) {
    if(this.options.devMode) {
      console.log(message);
    }
  }
}

export default Typewriter;
