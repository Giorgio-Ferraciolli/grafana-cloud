/* Observabilidade do navegador com Grafana Faro.
 * Envia erros, logs do console, Web Vitals, sessões, navegação e traces das chamadas à API
 * para /collect (nginx -> Alloy -> Loki/Tempo no Grafana Cloud).
 * O TracingInstrumentation adiciona o cabeçalho traceparent nas chamadas a /api,
 * então o trace do navegador continua no backend e no MySQL.
 * Se a CDN for bloqueada (adblock, offline), o site funciona normalmente sem telemetria. */
(function () {
  var sdk = window.GrafanaFaroWebSdk;
  if (!sdk) return;
  try {
    var instrumentations = sdk.getWebInstrumentations({ captureConsole: true });
    if (window.GrafanaFaroWebTracing) {
      instrumentations.push(new window.GrafanaFaroWebTracing.TracingInstrumentation());
    }
    sdk.initializeFaro({
      url: location.origin + "/collect",
      app: { name: "vw-web", namespace: "vw-seminovos", version: "2.0.0", environment: "lab" },
      instrumentations: instrumentations,
      sessionTracking: { enabled: true },
    });
  } catch (err) {
    console.warn("Faro desativado:", err);
  }
})();
