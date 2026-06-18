FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY src ./src

RUN mkdir -p out \
    && javac -d out $(find src/main/java -name "*.java") \
    && cp -R src/main/resources/* out/

FROM eclipse-temurin:21-jre

WORKDIR /app

ADD https://repo1.maven.org/maven2/io/opentelemetry/javaagent/opentelemetry-javaagent/2.16.0/opentelemetry-javaagent-2.16.0.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar
COPY --from=build /app/out ./out

ENV PORT=8080
ENV DATA_FILE=data/items.json
EXPOSE 8080

CMD ["java", "-cp", "out", "com.example.grafanacloud.App"]
