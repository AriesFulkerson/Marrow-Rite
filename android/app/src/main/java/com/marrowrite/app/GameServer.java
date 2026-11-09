package com.marrowrite.app;



import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * The Marrow Rite 1v1 host server, ported from host/server.ps1.
 * Same API (/api/doc, /api/name, /api/names) and same static files, so phones, PCs and
 * browsers can all join a match hosted on this phone, and this app can join a PC host.
 */
public class GameServer {
    public static final int PORT = 8787;
    private static final int MAX = 1024 * 1024;
    private static final Pattern DOC_PATH = Pattern.compile("^[A-Za-z0-9_\\-]+(/[A-Za-z0-9_\\-]+)*$");
    private static final Pattern STATIC = Pattern.compile("^/(index\\.html|portraits/[a-z\\-]+\\.jpg|cards/[a-z\\-]+\\.jpg)$");
    private static final Pattern PLAYER_ID = Pattern.compile("^p_[a-z0-9]{4,20}$");

    private static final class Doc { final int rev; final String data; Doc(int r, String d) { rev = r; data = d; } }

    /** Opens a bundled game file, e.g. "game/index.html". */
    public interface Assets { InputStream open(String path) throws IOException; }

    private final Assets assets;
    private final File dbFile;
    private final Map<String, Doc> store = new HashMap<>();
    private final Map<String, String> names = new HashMap<>();
    private boolean dirty = false;
    private final int port;
    private ServerSocket socket;
    private ExecutorService pool;
    private ScheduledExecutorService saver;

    public GameServer(Assets assets, File dataDir) { this(assets, dataDir, PORT); }

    public GameServer(Assets assets, File dataDir, int port) {
        this.port = port;
        this.assets = assets;
        this.dbFile = new File(dataDir, "store.json");
        load();
    }

    public synchronized boolean isRunning() { return socket != null && !socket.isClosed(); }

    public synchronized void start() throws IOException {
        if (isRunning()) return;
        socket = new ServerSocket(port, 50, InetAddress.getByName("0.0.0.0"));
        socket.setReuseAddress(true);
        pool = Executors.newFixedThreadPool(8);
        saver = Executors.newSingleThreadScheduledExecutor();
        saver.scheduleWithFixedDelay(this::saveIfDirty, 2, 2, TimeUnit.SECONDS);
        final ServerSocket s = socket;
        Thread t = new Thread(() -> {
            while (!s.isClosed()) {
                try {
                    Socket c = s.accept();
                    pool.execute(() -> handle(c));
                } catch (IOException e) { /* closed or transient */ }
            }
        }, "marrow-server");
        t.setDaemon(true);
        t.start();
    }

    public synchronized void stop() {
        try { if (socket != null) socket.close(); } catch (IOException ignored) { }
        socket = null;
        if (pool != null) pool.shutdownNow();
        if (saver != null) saver.shutdownNow();
        saveIfDirty();
    }

    // ---- persistence ----
    private void load() {
        if (!dbFile.exists()) return;
        try {
            String txt = new String(Files.readAllBytes(dbFile.toPath()), StandardCharsets.UTF_8);
            JSONObject root = new JSONObject(txt);
            JSONObject docs = root.optJSONObject("docs");
            if (docs != null) for (Iterator<String> it = docs.keys(); it.hasNext(); ) {
                String k = it.next(); JSONObject d = docs.getJSONObject(k);
                store.put(k, new Doc(d.optInt("rev"), d.optString("data", "")));
            }
            JSONObject nm = root.optJSONObject("names");
            if (nm != null) for (Iterator<String> it = nm.keys(); it.hasNext(); ) {
                String k = it.next(); names.put(k, nm.optString(k));
            }
        } catch (Exception e) { store.clear(); names.clear(); }
    }

    private synchronized void saveIfDirty() {
        if (!dirty) return;
        try {
            JSONObject docs = new JSONObject();
            for (Map.Entry<String, Doc> e : store.entrySet()) {
                JSONObject d = new JSONObject(); d.put("rev", e.getValue().rev); d.put("data", e.getValue().data);
                docs.put(e.getKey(), d);
            }
            JSONObject root = new JSONObject(); root.put("docs", docs); root.put("names", new JSONObject(names));
            File tmp = new File(dbFile.getPath() + ".tmp");
            try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(root.toString().getBytes(StandardCharsets.UTF_8)); }
            if (!tmp.renameTo(dbFile)) { dbFile.delete(); tmp.renameTo(dbFile); }
            dirty = false;
        } catch (Exception ignored) { }
    }

    // ---- HTTP ----
    private void handle(Socket c) {
        try (Socket client = c) {
            client.setSoTimeout(5000);
            InputStream in = client.getInputStream();
            OutputStream out = client.getOutputStream();
            byte[] buf = new byte[MAX];
            int len = 0, hEnd = -1;
            while (hEnd < 0) {
                if (len >= buf.length) { json(out, 413, "{\"error\":\"too large\"}"); return; }
                int n = in.read(buf, len, buf.length - len);
                if (n <= 0) return;
                len += n;
                hEnd = headerEnd(buf, len);
            }
            String head = new String(buf, 0, hEnd, StandardCharsets.US_ASCII);
            String[] lines = head.split("\r\n");
            String[] first = lines[0].split(" ");
            if (first.length < 2) { json(out, 400, "{\"error\":\"bad request\"}"); return; }
            String method = first[0].toUpperCase(Locale.ROOT);
            String target = first[1];
            int cl = 0;
            for (String l : lines) {
                if (l.toLowerCase(Locale.ROOT).startsWith("content-length:")) {
                    try { cl = Integer.parseInt(l.substring(15).trim()); } catch (NumberFormatException ignored) { }
                }
            }
            if (cl < 0 || cl > buf.length - hEnd) { json(out, 413, "{\"error\":\"too large\"}"); return; }
            while (len - hEnd < cl) {
                int n = in.read(buf, len, buf.length - len);
                if (n <= 0) break;
                len += n;
            }
            String body = cl > 0 ? new String(buf, hEnd, Math.min(cl, len - hEnd), StandardCharsets.UTF_8) : "";
            int qi = target.indexOf('?');
            String path = qi >= 0 ? target.substring(0, qi) : target;
            Map<String, String> q = query(qi >= 0 ? target.substring(qi + 1) : "");
            route(out, method, path, q, body);
        } catch (Exception ignored) { }
    }

    private void route(OutputStream out, String method, String path, Map<String, String> q, String body) throws IOException {
        if (path.equals("/api/doc")) {
            String dp = q.get("path");
            if (!validPath(dp)) { json(out, 400, "{\"error\":\"bad path\"}"); return; }
            String resp; int code = 200;
            synchronized (this) {
                Doc d = store.get(dp);
                switch (method) {
                    case "GET": {
                        int rev = d != null ? d.rev : 0;
                        if (q.containsKey("since") && String.valueOf(rev).equals(q.get("since"))) resp = "{\"changed\":false,\"rev\":" + rev + "}";
                        else if (d != null && !d.data.isEmpty()) resp = "{\"changed\":true,\"exists\":true,\"rev\":" + rev + ",\"data\":" + d.data + "}";
                        else resp = "{\"changed\":true,\"exists\":false,\"rev\":" + rev + "}";
                        break;
                    }
                    case "PUT": {
                        try { new JSONTokener(body).nextValue(); } catch (Exception e) { json(out, 400, "{\"error\":\"bad json\"}"); return; }
                        int rev = d != null ? d.rev + 1 : 1;
                        store.put(dp, new Doc(rev, body.trim())); dirty = true;
                        resp = "{\"ok\":true,\"rev\":" + rev + "}";
                        break;
                    }
                    case "PATCH": {
                        if (d == null || d.data.isEmpty()) { json(out, 404, "{\"error\":\"invalid_argument\"}"); return; }
                        String merged;
                        try {
                            JSONObject old = new JSONObject(d.data), patch = new JSONObject(body);
                            for (Iterator<String> it = patch.keys(); it.hasNext(); ) { String k = it.next(); old.put(k, patch.get(k)); }
                            merged = old.toString();
                        } catch (Exception e) { json(out, 400, "{\"error\":\"bad json\"}"); return; }
                        store.put(dp, new Doc(d.rev + 1, merged)); dirty = true;
                        resp = "{\"ok\":true,\"rev\":" + (d.rev + 1) + "}";
                        break;
                    }
                    case "DELETE": {
                        int rev = d != null ? d.rev + 1 : 1;
                        store.put(dp, new Doc(rev, "")); dirty = true;
                        resp = "{\"ok\":true,\"rev\":" + rev + "}";
                        break;
                    }
                    default: resp = "{\"error\":\"method\"}"; code = 405;
                }
            }
            json(out, code, resp);
            return;
        }
        if (path.equals("/api/name") && method.equals("POST")) {
            String id, nm;
            try { JSONObject o = new JSONObject(body); id = o.optString("id"); nm = o.optString("name").trim(); }
            catch (Exception e) { json(out, 400, "{\"error\":\"bad json\"}"); return; }
            if (!PLAYER_ID.matcher(id).matches() || nm.isEmpty()) { json(out, 400, "{\"error\":\"bad name\"}"); return; }
            if (nm.length() > 24) nm = nm.substring(0, 24);
            synchronized (this) { names.put(id, nm); dirty = true; }
            json(out, 200, "{\"ok\":true}");
            return;
        }
        if (path.equals("/api/names") && method.equals("GET")) {
            JSONObject o = new JSONObject();
            try {
                synchronized (this) {
                    for (String id : String.valueOf(q.get("ids")).split(",")) {
                        if (!id.isEmpty() && names.containsKey(id)) o.put(id, new JSONObject().put("name", names.get(id)));
                    }
                }
            } catch (Exception ignored) { }
            json(out, 200, o.toString());
            return;
        }
        // ---- static files (whitelisted) ----
        if (!method.equals("GET")) { json(out, 405, "{\"error\":\"method\"}"); return; }
        if (path.equals("/")) path = "/index.html";
        if (!STATIC.matcher(path).matches()) { send(out, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8)); return; }
        byte[] data;
        try (InputStream a = assets.open("game" + path)) { data = readAll(a); }
        catch (IOException e) { send(out, 404, "text/plain", "Not found".getBytes(StandardCharsets.UTF_8)); return; }
        send(out, 200, path.endsWith(".html") ? "text/html; charset=utf-8" : "image/jpeg", data);
    }

    private static boolean validPath(String p) {
        return p != null && p.length() <= 200 && DOC_PATH.matcher(p).matches() && p.split("/").length % 2 == 0;
    }

    private static Map<String, String> query(String qs) {
        Map<String, String> h = new HashMap<>();
        for (String pair : qs.split("&")) {
            if (pair.isEmpty()) continue;
            String[] kv = pair.split("=", 2);
            try {
                h.put(URLDecoder.decode(kv[0], "UTF-8"), kv.length > 1 ? URLDecoder.decode(kv[1], "UTF-8") : "");
            } catch (Exception ignored) { }
        }
        return h;
    }

    private static int headerEnd(byte[] b, int len) {
        for (int i = 3; i < len; i++) if (b[i - 3] == 13 && b[i - 2] == 10 && b[i - 1] == 13 && b[i] == 10) return i + 1;
        return -1;
    }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] b = new byte[16384]; int n;
        while ((n = in.read(b)) > 0) bo.write(b, 0, n);
        return bo.toByteArray();
    }

    private static void json(OutputStream out, int code, String s) throws IOException {
        send(out, code, "application/json; charset=utf-8", s.getBytes(StandardCharsets.UTF_8));
    }

    private static void send(OutputStream out, int code, String type, byte[] body) throws IOException {
        String reason;
        switch (code) {
            case 200: reason = "OK"; break; case 400: reason = "Bad Request"; break; case 404: reason = "Not Found"; break;
            case 405: reason = "Method Not Allowed"; break; case 413: reason = "Payload Too Large"; break; default: reason = "Error";
        }
        String head = "HTTP/1.1 " + code + " " + reason + "\r\nContent-Type: " + type + "\r\nContent-Length: " + body.length
                + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }
}
