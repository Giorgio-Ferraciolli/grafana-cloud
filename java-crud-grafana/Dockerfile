FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY src ./src

RUN mkdir -p out \
    && javac -d out $(find src/main/java -name "*.java") \
    && cp -R src/main/resources/* out/

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/out ./out

ENV PORT=8080
ENV DATA_FILE=data/items.json
EXPOSE 8080

CMD ["java", "-cp", "out", "com.example.grafanacloud.App"]
