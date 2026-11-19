# ---------- build: compila e roda os testes ----------
FROM maven:3.9-eclipse-temurin-21 AS build
# Usuário comum: o PostgreSQL embutido dos testes se recusa a rodar como root
RUN useradd --create-home builder
USER builder
WORKDIR /home/builder/app

COPY --chown=builder pom.xml .
RUN mvn -B -q dependency:go-offline

COPY --chown=builder src ./src
RUN mvn -B package

# ---------- runtime: só o JRE ----------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /home/builder/app/target/app.jar app.jar

# OpenTelemetry Java agent (traces + métricas sem mudar código).
# Só é ativado se o compose passar -javaagent em JAVA_TOOL_OPTIONS.
ARG OTEL_AGENT_VERSION=2.33.1
ADD --chmod=644 https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

# Pyroscope Java agent (profiling contínuo: CPU, alocação, locks).
# Só é ativado se o compose passar -javaagent em JAVA_TOOL_OPTIONS.
ARG PYROSCOPE_AGENT_VERSION=2.9.2
ADD --chmod=644 https://github.com/grafana/pyroscope-java/releases/download/v${PYROSCOPE_AGENT_VERSION}/pyroscope.jar /app/pyroscope.jar

ENV HOME=/tmp
USER 1000:1000

EXPOSE 5050
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
