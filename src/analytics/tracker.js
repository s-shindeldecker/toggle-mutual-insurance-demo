const { eventEmitter } = require("./eventEmitter");
const { initializeLaunchDarkly } = require("../experiments/launchdarklyClient");

const sinks = [];

const registerSink = (sink) => {
  sinks.push(sink);
};

const launchDarklySink = {
  name: "launchdarkly",
  track: async (eventName, payload, context) => {
    const client = await initializeLaunchDarkly();
    if (!client) {
      return;
    }
    client.track(eventName, context, payload);
  },
};

registerSink(launchDarklySink);

const trackEvent = (eventName, payload, context) => {
  eventEmitter.emit(eventName, payload);
  for (const sink of sinks) {
    try {
      sink.track(eventName, payload, context);
    } catch (error) {
      // Analytics failures should not interrupt the quote lifecycle.
    }
  }
};

module.exports = {
  registerSink,
  trackEvent,
};
