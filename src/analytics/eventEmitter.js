class InMemoryEventEmitter {
  constructor() {
    this.handlersByEvent = new Map();
    this.emittedEvents = [];
  }

  on(eventName, handler) {
    if (!this.handlersByEvent.has(eventName)) {
      this.handlersByEvent.set(eventName, new Set());
    }
    this.handlersByEvent.get(eventName).add(handler);
  }

  off(eventName, handler) {
    const handlers = this.handlersByEvent.get(eventName);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlersByEvent.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const eventRecord = {
      name: eventName,
      payload,
      emittedAt: new Date().toISOString(),
    };
    this.emittedEvents.push(eventRecord);

    const handlers = this.handlersByEvent.get(eventName);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      handler(eventRecord);
    }
  }

  getEmittedEvents() {
    return [...this.emittedEvents];
  }

  clear() {
    this.emittedEvents = [];
  }
}

const eventEmitter = new InMemoryEventEmitter();

module.exports = {
  InMemoryEventEmitter,
  eventEmitter,
};
