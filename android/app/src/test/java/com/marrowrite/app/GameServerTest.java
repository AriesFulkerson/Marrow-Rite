package com.marrowrite.app;

import org.json.JSONObject;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import static org.junit.Assert.*;

/** Exercises the same HTTP API the game's host-shim.js uses. */
public class GameServerTest {
    static final int TEST_PORT = Integer.getInteger("mr.port", 8797);
    private static GameServer server;
    private static File dir;
    private static final String BASE = "http://127.0.0.1:" + TEST_PORT;

    @BeforeClass public static void up() throws Exception {
        dir = Files.createTempDirectory("mr").toFile();
        server = new GameServer(p -> new FileInputStream(new File("src/main/assets/" + p)), dir, TEST_PORT);
        server.start();
    }

    @AfterClass public static void down() { server.stop(); }

    private static Object[] call(String method, String path, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(BASE + path).openConnection();
        c.setRequestMethod(method.equals("PATCH") ? "POST" : method);
        if (method.equals("PATCH")) {
            // HttpURLConnection has no PATCH; send it raw instead.
            return rawPatch(path, body);
        }
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream o = c.getOutputStream()) { o.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int code = c.getResponseCode();
        InputStream in = code < 400 ? c.getInputStream() : c.getErrorStream();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        if (in != null) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); }
        return new Object[]{code, b.toString("UTF-8"), c.getContentType()};
    }

    private static Object[] rawPatch(String path, String body) throws Exception {
        try (java.net.Socket s = new java.net.Socket("127.0.0.1", TEST_PORT)) {
            byte[] bb = body.getBytes(StandardCharsets.UTF_8);
            String req = "PATCH " + path + " HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: " + bb.length + "\r\n\r\n";
            s.getOutputStream().write(req.getBytes(StandardCharsets.US_ASCII));
            s.getOutputStream().write(bb);
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = s.getInputStream().read(buf)) > 0) b.write(buf, 0, n);
            String resp = b.toString("UTF-8");
            int code = Integer.parseInt(resp.split(" ")[1]);
            return new Object[]{code, resp.substring(resp.indexOf("\r\n\r\n") + 4), null};
        }
    }

    private static JSONObject j(Object[] r) throws Exception { return new JSONObject((String) r[1]); }

    @Test public void servesGameAndArt() throws Exception {
        Object[] r = call("GET", "/", null);
        assertEquals(200, r[0]);
        assertTrue(((String) r[1]).contains("Marrow Rite"));
        assertTrue(((String) r[2]).startsWith("text/html"));
        assertEquals(200, call("GET", "/portraits/ashkar.jpg", null)[0]);
        assertEquals(200, call("GET", "/cards/gatebreaker.jpg", null)[0]);
        assertEquals(404, call("GET", "/../secret.txt", null)[0]);
        assertEquals(404, call("GET", "/launcher.html", null)[0]);
    }

    @Test public void docLifecycleMatchesPcHost() throws Exception {
        String p = "/api/doc?path=matches/ABCD";
        JSONObject g = j(call("GET", p, null));
        assertFalse(g.getBoolean("exists"));
        assertEquals(0, g.getInt("rev"));

        assertEquals(1, j(call("PUT", p, "{\"turn\":1,\"hp\":{\"a\":29}}")).getInt("rev"));
        g = j(call("GET", p, null));
        assertTrue(g.getBoolean("exists"));
        assertEquals(29, g.getJSONObject("data").getJSONObject("hp").getInt("a"));

        // Long-poll style: same rev -> unchanged
        assertFalse(j(call("GET", p + "&since=1", null)).getBoolean("changed"));

        // PATCH merges top-level fields
        assertEquals(2, j(call("PATCH", p, "{\"turn\":2}")).getInt("rev"));
        g = j(call("GET", p + "&since=1", null));
        assertTrue(g.getBoolean("changed"));
        assertEquals(2, g.getJSONObject("data").getInt("turn"));
        assertEquals(29, g.getJSONObject("data").getJSONObject("hp").getInt("a"));

        // PATCH on missing doc -> 404 (shim maps it to invalid_argument)
        assertEquals(404, call("PATCH", "/api/doc?path=matches/NOPE", "{\"a\":1}")[0]);

        assertEquals(3, j(call("DELETE", p, null)).getInt("rev"));
        assertFalse(j(call("GET", p, null)).getBoolean("exists"));

        assertEquals(400, call("GET", "/api/doc?path=matches", null)[0]);
        assertEquals(400, call("PUT", p, "{not json")[0]);
    }

    @Test public void names() throws Exception {
        assertEquals(200, call("POST", "/api/name", "{\"id\":\"p_abc123\",\"name\":\"Aries\"}")[0]);
        assertEquals(400, call("POST", "/api/name", "{\"id\":\"bad\",\"name\":\"x\"}")[0]);
        JSONObject n = j(call("GET", "/api/names?ids=p_abc123,p_zzzz99", null));
        assertEquals("Aries", n.getJSONObject("p_abc123").getString("name"));
        assertFalse(n.has("p_zzzz99"));
    }
}
