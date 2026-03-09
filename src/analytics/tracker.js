const { eventEmitter } = require("./eventEmitter");
const { assertValidLifecycleStage } = require("./validate");
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
  if (payload && typeof payload.status === "string") {
    assertValidLifecycleStage(payload.status);
  }
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
