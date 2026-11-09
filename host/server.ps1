# Marrow Rite 1v1 host server
# Runs on Windows PowerShell 5.1+ with no installs and no administrator rights.
# Serves the game from .\public and keeps matches and player saves in .\data\store.json.
param([int]$Port = 8787)

$ErrorActionPreference = 'Stop'
$root    = Split-Path -Parent $MyInvocation.MyCommand.Path
$pub     = Join-Path $root 'public'
$dataDir = Join-Path $root 'data'
New-Item -ItemType Directory -Force $dataDir | Out-Null
$dbFile  = Join-Path $dataDir 'store.json'

# path -> @{ rev = [int]; data = <compressed JSON string> }
$store = @{}
$names = @{}
if (Test-Path $dbFile) {
  try {
    $saved = Get-Content $dbFile -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $saved.docs.PSObject.Properties)  { $store[$p.Name] = @{ rev = [int]$p.Value.rev; data = [string]$p.Value.data } }
    foreach ($p in $saved.names.PSObject.Properties) { $names[$p.Name] = [string]$p.Value }
  } catch { Write-Host "Could not read $dbFile; starting with an empty store." -ForegroundColor Yellow }
}
$script:dirty = $false
$script:lastSave = [DateTime]::Now

function Save-Store {
  $docs = [ordered]@{}
  foreach ($k in $store.Keys) { $docs[$k] = [ordered]@{ rev = $store[$k].rev; data = $store[$k].data } }
  $obj = [ordered]@{ docs = $docs; names = $names }
  $json = $obj | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText("$dbFile.tmp", $json, (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -Force "$dbFile.tmp" $dbFile
  $script:dirty = $false
  $script:lastSave = [DateTime]::Now
}

function Merge-Json([string]$oldJson, [string]$patchJson) {
  $old = if ($oldJson) { $oldJson | ConvertFrom-Json } else { New-Object PSObject }
  $patch = $patchJson | ConvertFrom-Json
  foreach ($p in $patch.PSObject.Properties) {
    if ($old.PSObject.Properties[$p.Name]) { $old.($p.Name) = $p.Value } else { $old | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value }
  }
  return ($old | ConvertTo-Json -Depth 20 -Compress)
}

function Get-Query([string]$q) {
  $h = @{}
  if (-not $q) { return $h }
  foreach ($pair in $q.TrimStart('?').Split('&')) {
    if (-not $pair) { continue }
    $kv = $pair.Split('=', 2)
    $h[[Uri]::UnescapeDataString($kv[0])] = if ($kv.Count -gt 1) { [Uri]::UnescapeDataString($kv[1].Replace('+', ' ')) } else { '' }
  }
  return $h
}

function Valid-Path([string]$p) { return ($p -match '^[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-]+)*$') -and ($p.Split('/').Count % 2 -eq 0) -and ($p.Length -le 200) }

$mime = @{ '.html' = 'text/html; charset=utf-8'; '.jpg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'; '.json' = 'application/json; charset=utf-8' }

function Send([System.Net.Sockets.NetworkStream]$s, [int]$code, [string]$type, [byte[]]$body) {
  $reason = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 404 = 'Not Found'; 405 = 'Method Not Allowed'; 413 = 'Payload Too Large'; 500 = 'Internal Server Error' }[$code]
  if (-not $body) { $body = [byte[]]@() }
  $head = "HTTP/1.1 $code $reason`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($head)
  $s.Write($hb, 0, $hb.Length)
  if ($body.Length) { $s.Write($body, 0, $body.Length) }
  $s.Flush()
}
function Send-Json($s, [int]$code, [string]$json) { Send $s $code 'application/json; charset=utf-8' ([Text.Encoding]::UTF8.GetBytes($json)) }

function Find-HeaderEnd([byte[]]$b, [int]$len) {
  for ($i = 3; $i -lt $len; $i++) { if ($b[$i-3] -eq 13 -and $b[$i-2] -eq 10 -and $b[$i-1] -eq 13 -and $b[$i] -eq 10) { return $i + 1 } }
  return -1
}

function Handle([System.Net.Sockets.TcpClient]$client) {
  $client.ReceiveTimeout = 5000
  $client.SendTimeout = 10000
  $s = $client.GetStream()
  $buf = New-Object byte[] 1048576
  $len = 0; $hEnd = -1
  while ($hEnd -lt 0) {
    $n = $s.Read($buf, $len, $buf.Length - $len)
    if ($n -le 0) { return }
    $len += $n
    $hEnd = Find-HeaderEnd $buf $len
    if ($len -ge $buf.Length) { Send-Json $s 413 '{"error":"too large"}'; return }
  }
  $headText = [Text.Encoding]::ASCII.GetString($buf, 0, $hEnd)
  $lines = $headText -split "`r`n"
  $first = $lines[0].Split(' ')
  if ($first.Count -lt 2) { Send-Json $s 400 '{"error":"bad request"}'; return }
  $method = $first[0].ToUpper()
  $target = $first[1]
  $cl = 0
  foreach ($l in $lines) { if ($l -match '^(?i)content-length:\s*(\d+)') { $cl = [int]$Matches[1] } }
  if ($cl -gt ($buf.Length - $hEnd)) { Send-Json $s 413 '{"error":"too large"}'; return }
  while (($len - $hEnd) -lt $cl) {
    $n = $s.Read($buf, $len, $buf.Length - $len)
    if ($n -le 0) { break }
    $len += $n
  }
  $body = if ($cl -gt 0) { [Text.Encoding]::UTF8.GetString($buf, $hEnd, $cl) } else { '' }

  $qi = $target.IndexOf('?')
  $path = if ($qi -ge 0) { $target.Substring(0, $qi) } else { $target }
  $q = Get-Query $(if ($qi -ge 0) { $target.Substring($qi + 1) } else { '' })

  # ---- API ----
  if ($path -eq '/api/doc') {
    $dp = $q['path']
    if (-not (Valid-Path $dp)) { Send-Json $s 400 '{"error":"bad path"}'; return }
    switch ($method) {
      'GET' {
        $d = $store[$dp]
        $rev = if ($d) { $d.rev } else { 0 }
        if ($q.ContainsKey('since') -and [string]$rev -eq $q['since']) { Send-Json $s 200 ('{"changed":false,"rev":' + $rev + '}'); return }
        if ($d -and $d.data) { Send-Json $s 200 ('{"changed":true,"exists":true,"rev":' + $rev + ',"data":' + $d.data + '}') }
        else { Send-Json $s 200 ('{"changed":true,"exists":false,"rev":' + $rev + '}') }
        return
      }
      'PUT' {
        try { $null = $body | ConvertFrom-Json } catch { Send-Json $s 400 '{"error":"bad json"}'; return }
        $old = $store[$dp]; $rev = if ($old) { $old.rev + 1 } else { 1 }
        $store[$dp] = @{ rev = $rev; data = $body.Trim() }
        $script:dirty = $true
        Send-Json $s 200 ('{"ok":true,"rev":' + $rev + '}'); return
      }
      'PATCH' {
        $old = $store[$dp]
        if (-not $old -or -not $old.data) { Send-Json $s 404 '{"error":"invalid_argument"}'; return }
        try { $merged = Merge-Json $old.data $body } catch { Send-Json $s 400 '{"error":"bad json"}'; return }
        $store[$dp] = @{ rev = $old.rev + 1; data = $merged }
        $script:dirty = $true
        Send-Json $s 200 ('{"ok":true,"rev":' + ($old.rev + 1) + '}'); return
      }
      'DELETE' {
        $old = $store[$dp]; $rev = if ($old) { $old.rev + 1 } else { 1 }
        $store[$dp] = @{ rev = $rev; data = '' }
        $script:dirty = $true
        Send-Json $s 200 ('{"ok":true,"rev":' + $rev + '}'); return
      }
      default { Send-Json $s 405 '{"error":"method"}'; return }
    }
  }
  if ($path -eq '/api/name' -and $method -eq 'POST') {
    try { $o = $body | ConvertFrom-Json } catch { Send-Json $s 400 '{"error":"bad json"}'; return }
    $id = [string]$o.id; $nm = ([string]$o.name).Trim()
    if ($id -notmatch '^p_[a-z0-9]{4,20}$' -or -not $nm) { Send-Json $s 400 '{"error":"bad name"}'; return }
    if ($nm.Length -gt 24) { $nm = $nm.Substring(0, 24) }
    $names[$id] = $nm; $script:dirty = $true
    Send-Json $s 200 '{"ok":true}'; return
  }
  if ($path -eq '/api/names' -and $method -eq 'GET') {
    $out = [ordered]@{}
    foreach ($id in ([string]$q['ids']).Split(',')) { if ($id -and $names.ContainsKey($id)) { $out[$id] = [ordered]@{ name = $names[$id] } } }
    Send-Json $s 200 ($out | ConvertTo-Json -Depth 3 -Compress); return
  }

  # ---- static files (whitelisted) ----
  if ($method -ne 'GET') { Send-Json $s 405 '{"error":"method"}'; return }
  if ($path -eq '/') { $path = '/index.html' }
  if ($path -notmatch '^/(index\.html|portraits/[a-z\-]+\.jpg|cards/[a-z\-]+\.jpg)$') { Send $s 404 'text/plain' ([Text.Encoding]::UTF8.GetBytes('Not found')); return }
  $file = Join-Path $pub ($path.TrimStart('/').Replace('/', '\'))
  if (-not (Test-Path $file)) { Send $s 404 'text/plain' ([Text.Encoding]::UTF8.GetBytes('Not found')); return }
  $ext = [IO.Path]::GetExtension($file).ToLower()
  Send $s 200 $mime[$ext] ([IO.File]::ReadAllBytes($file))
}

# ---- start ----
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
try { $listener.Start() } catch { Write-Host "Port $Port is busy. Close the other program or run: .\server.ps1 -Port 8788" -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '  MARROW RITE 1v1 server is running.' -ForegroundColor Yellow
Write-Host ''
Write-Host "  On this PC:          http://localhost:$Port"
try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress
  foreach ($ip in $ips) { Write-Host "  Friends on your Wi-Fi: http://${ip}:$Port" }
} catch {}
Write-Host ''
Write-Host '  Keep this window open while you play. Press Ctrl+C to stop.'
Write-Host '  If Windows asks whether to allow access, choose Private networks and Allow.'
Write-Host ''

try {
  while ($true) {
    if ($listener.Pending()) {
      $c = $listener.AcceptTcpClient()
      try { Handle $c } catch { } finally { try { $c.Close() } catch { } }
    } else {
      Start-Sleep -Milliseconds 15
      if ($script:dirty -and ([DateTime]::Now - $script:lastSave).TotalSeconds -ge 2) { try { Save-Store } catch { } }
    }
  }
} finally {
  if ($script:dirty) { try { Save-Store } catch { } }
  $listener.Stop()
}
