import applicationInsights from 'applicationinsights';
import chalk from 'chalk';
import { jsonStore } from './store/jsonStore.js';
import { secretsStore } from './store/secretsStore.js';

/**
 * TelemetryClient class for tracking telemetry events, exceptions, traces, HTTP requests and responses, and metrics.
 * @class
 */
class TelemetryClient {
  /**
   * Creates a TelemetryClient instance. Use TelemetryClient.create() instead.
   * @private
   */
  constructor(telemetry) {
    this.telemetry = telemetry;
  }

  /**
   * Creates and initializes a TelemetryClient instance.
   * @returns {Promise<TelemetryClient>}
   */
  static async create() {
    const instrumentationKey = await secretsStore.getAppInsightsKey();
    
    applicationInsights.Configuration.setAutoCollectConsole(true, true);
    applicationInsights.Configuration.setAutoCollectRequests(true, true);
    applicationInsights.setup(instrumentationKey).start();
    
    const settings = await jsonStore.settingsDb.read();

    if (settings.isVerbose) {
      console.info(chalk.hex('#8d8219')('[AppInsights] Telemetry client initialized'));
      console.info(chalk.hex('#8d8219')('[AppInsights] Auto collecting console logs'));
      console.info(chalk.hex('#8d8219')('[AppInsights] Auto collecting requests\n'));
    }
    
    const telemetry = applicationInsights.defaultClient;
    telemetry.context.tags['ai.cloud.role'] = 'Support-Tracker-App';
    
    return new TelemetryClient(telemetry);
  }

  /**
   * Tracks a custom event with optional measurements.
   * @param {string} name - The name of the event to track.
   * @param {object} [measurements] - An optional object containing key-value pairs of measurements to associate with the event.
   */
  async trackEvent(name, measurements = null) {
    await this.telemetry.trackEvent({
      name: name,
      measurements: measurements
    });
  }

  /**
   * Tracks an exception with optional measurements and severity.
   * @param {Error} exception - The exception to track.
   * @param {object} [measurements] - An optional object containing key-value pairs of measurements to associate with the exception.
   * @param {string} [severity] - An optional severity level for the exception.
   */
  trackException(exception, measurements = null, severity = null) {
    this.telemetry.trackException({
      exception: exception,
      measurements: measurements,
      severity: severity
    });
  }

  /**
   * Tracks a trace message with an optional severity level.
   * @param {string} message - The trace message to track.
   * @param {string} [severity] - An optional severity level for the trace message.
   */
  trackTrace(message, severity = null) {
    this.telemetry.trackTrace({
      message: message,
      severity: severity
    });
  }
  
  /**
   * Tracks an HTTP request and response.
   * @param {http.IncomingMessage} request - The incoming HTTP request.
   * @param {http.ServerResponse} response - The outgoing HTTP response.
   */
  trackHttpRequestAndResponse(request, response) {
    this.telemetry.trackNodeHttpRequest({
      request: request,
      response: response
    });
  }

  /**
   * Tracks a custom metric with optional parameters.
   * @param {string} name - The name of the metric to track.
   * @param {number} value - The value of the metric to track.
   * @param {string} [kind] - An optional kind or type of the metric.
   * @param {number} [count] - An optional count associated with the metric.
   * @param {number} [min] - An optional minimum value associated with the metric.
   * @param {number} [max] - An optional maximum value associated with the metric.
   * @param {number} [stdDev] - An optional standard deviation associated with the metric.
   */
  trackMetric(name, value, kind = null, count = null, min = null, max = null, stdDev = null) {
    this.telemetry.trackMetric({
      name: name,
      value: value,
      kind: kind,
      count: count,
      min: min,
      max: max,
      stdDev
    });
  }

  /**
   * Flushes the telemetry client, sending any pending telemetry data.
   */
  flushClient() {
    this.telemetry.flush();
  }
}

export { TelemetryClient };