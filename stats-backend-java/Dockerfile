# syntax=docker/dockerfile:1

# Собирает stats-backend-java (Spring Boot) в multi-stage: сборка через
# maven-образ, рантайм — только JRE, без Maven и исходников. Тот же паттерн,
# что у корневого Dockerfile (build-стейдж для frontend/ + лёгкий рантайм).
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
# Отдельный слой под зависимости — пересобирается только когда меняется
# pom.xml, а не при каждой правке исходников.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /src/target/stats-backend-*.jar app.jar
# Порт по умолчанию 8081 (application.yml: server.port, переопределяется
# через STATS_BACKEND_JAVA_PORT). В docker-compose.yml сервис
# stats-backend-java не публикуется наружу — достучаться можно только
# через Caddy по имени сервиса внутри docker-сети.
EXPOSE 8081
# Flyway при старте сам создаст/обновит схему (src/main/resources/db/migration/),
# поэтому отдельный entrypoint-скрипт не нужен.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]