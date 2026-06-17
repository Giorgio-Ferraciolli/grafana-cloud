package com.example.grafanacloud;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class App {
    private static final int DEFAULT_PORT = 8080;
    private static final String INDEX_RESOURCE = "static/index.html";
    private static final String STATIC_RESOURCE_ROOT = "static";
    private static final String DEFAULT_DATA_FILE = "data/items.json";
    private static final Object DATA_LOCK = new Object();

    private App() {
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", String.valueOf(DEFAULT_PORT)));
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);

        server.createContext("/health", App::handleHealth);
        server.createContext("/items", App::handleItems);
        server.createContext("/assets/", App::handleStaticAsset);
        server.createContext("/", App::handleIndex);
        server.setExecutor(null);
        server.start();

        System.out.printf("java-crud-grafana listening on http://0.0.0.0:%d%n", port);
    }

    private static void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }

        sendJson(exchange, 200, "{\"status\":\"ok\",\"service\":\"java-crud-grafana\"}");
    }

    private static void handleItems(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        if (!"/items".equals(path) && !"/items/".equals(path)) {
            handleNotFound(exchange);
            return;
        }

        String method = exchange.getRequestMethod();
        if ("GET".equalsIgnoreCase(method)) {
            sendJson(exchange, 200, readItems());
            return;
        }

        if ("POST".equalsIgnoreCase(method)) {
            handleCreateItem(exchange);
            return;
        }

        sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
    }

    private static void handleCreateItem(HttpExchange exchange) throws IOException {
        String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        String title = extractJsonString(requestBody, "title").trim();
        String description = extractJsonString(requestBody, "description").trim();

        if (title.isEmpty()) {
            sendJson(exchange, 400, "{\"error\":\"title_is_required\"}");
            return;
        }

        String itemJson = """
                {"id":"%s","title":"%s","description":"%s","createdAt":"%s"}"""
                .formatted(
                        escapeJson(UUID.randomUUID().toString()),
                        escapeJson(title),
                        escapeJson(description),
                        escapeJson(Instant.now().toString()));

        appendItem(itemJson);
        sendJson(exchange, 201, itemJson);
    }

    private static void handleIndex(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();

        if (!"/".equals(path) && !"/index.html".equals(path)) {
            handleNotFound(exchange);
            return;
        }

        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }

        sendHtml(exchange, 200, readResource(INDEX_RESOURCE));
    }

    private static void handleStaticAsset(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendJson(exchange, 405, "{\"error\":\"method_not_allowed\"}");
            return;
        }

        String path = exchange.getRequestURI().getPath();
        if (path.contains("..")) {
            handleNotFound(exchange);
            return;
        }

        byte[] asset = readResourceBytes(STATIC_RESOURCE_ROOT + path);
        if (asset.length == 0) {
            handleNotFound(exchange);
            return;
        }

        sendBytes(exchange, 200, contentTypeFor(path), asset);
    }

    private static void handleNotFound(HttpExchange exchange) throws IOException {
        sendJson(exchange, 404, "{\"error\":\"not_found\"}");
    }

    private static String readItems() throws IOException {
        synchronized (DATA_LOCK) {
            Path file = dataFile();
            if (!Files.exists(file)) {
                return "[]";
            }

            String content = Files.readString(file, StandardCharsets.UTF_8).trim();
            return content.isEmpty() ? "[]" : content;
        }
    }

    private static void appendItem(String itemJson) throws IOException {
        synchronized (DATA_LOCK) {
            Path file = dataFile();
            Path parent = file.getParent();

            if (parent != null) {
                Files.createDirectories(parent);
            }

            String current = Files.exists(file) ? Files.readString(file, StandardCharsets.UTF_8).trim() : "";
            String nextContent;

            if (current.isEmpty() || "[]".equals(current)) {
                nextContent = "[\n  " + itemJson + "\n]\n";
            } else if (current.endsWith("]")) {
                nextContent = current.substring(0, current.length() - 1).stripTrailing()
                        + ",\n  " + itemJson + "\n]\n";
            } else {
                throw new IOException("Invalid JSON data file: " + file);
            }

            Files.writeString(file, nextContent, StandardCharsets.UTF_8);
        }
    }

    private static Path dataFile() {
        return Path.of(System.getenv().getOrDefault("DATA_FILE", DEFAULT_DATA_FILE));
    }

    private static String extractJsonString(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\"");
        Matcher matcher = pattern.matcher(json);

        if (!matcher.find()) {
            return "";
        }

        return unescapeJson(matcher.group(1));
    }

    private static String unescapeJson(String value) {
        StringBuilder result = new StringBuilder();

        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current != '\\' || index + 1 >= value.length()) {
                result.append(current);
                continue;
            }

            char next = value.charAt(++index);
            switch (next) {
                case '"' -> result.append('"');
                case '\\' -> result.append('\\');
                case '/' -> result.append('/');
                case 'b' -> result.append('\b');
                case 'f' -> result.append('\f');
                case 'n' -> result.append('\n');
                case 'r' -> result.append('\r');
                case 't' -> result.append('\t');
                default -> result.append(next);
            }
        }

        return result.toString();
    }

    private static String escapeJson(String value) {
        StringBuilder result = new StringBuilder();

        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            switch (current) {
                case '"' -> result.append("\\\"");
                case '\\' -> result.append("\\\\");
                case '\b' -> result.append("\\b");
                case '\f' -> result.append("\\f");
                case '\n' -> result.append("\\n");
                case '\r' -> result.append("\\r");
                case '\t' -> result.append("\\t");
                default -> result.append(current);
            }
        }

        return result.toString();
    }

    private static String readResource(String resourceName) throws IOException {
        try (InputStream input = App.class.getClassLoader().getResourceAsStream(resourceName)) {
            if (input == null) {
                throw new IOException("Resource not found: " + resourceName);
            }

            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static byte[] readResourceBytes(String resourceName) throws IOException {
        try (InputStream input = App.class.getClassLoader().getResourceAsStream(resourceName)) {
            if (input == null) {
                return new byte[0];
            }

            return input.readAllBytes();
        }
    }

    private static String contentTypeFor(String path) {
        if (path.endsWith(".svg")) {
            return "image/svg+xml; charset=utf-8";
        }

        return "application/octet-stream";
    }

    private static void sendHtml(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(response);
        }
    }

    private static void sendBytes(HttpExchange exchange, int statusCode, String contentType, byte[] response)
            throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(statusCode, response.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(response);
        }
    }

    private static void sendJson(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] response = body.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(statusCode, response.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(response);
        }
    }
}
