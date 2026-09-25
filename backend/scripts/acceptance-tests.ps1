$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5000/api/v1'

function Login($email) {
  $body = @{ email = $email; password = 'password123' } | ConvertTo-Json
  $r = Invoke-RestMethod -Uri "$base/auth/login" -Method Post -Body $body -ContentType 'application/json'
  Write-Host ("LOGIN " + $email + " -> role=" + $r.data.user.role)
  return @{ Token = $r.data.token; Headers = @{ Authorization = 'Bearer ' + $r.data.token } }
}

function CaseChat($auth, $caseId, $query, $label) {
  $body = @{ query = $query } | ConvertTo-Json
  try {
    $r = Invoke-RestMethod -Uri "$base/cases/$caseId/ai/chat" -Method Post -Body $body -ContentType 'application/json' -Headers $auth.Headers
    $src = ($r.citations | ForEach-Object { $_.documentName }) -join '; '
    Write-Output ("[$label] status=" + $r.status + " mode=" + $r.mode + " conf=" + $r.confidence + " citations=[" + $src + "]")
    Write-Output ("  answer: " + ($r.answer -replace "`n", ' ').Substring(0, [Math]::Min(220, $r.answer.Length)))
  } catch {
    Write-Output ("[$label] HTTP ERROR: " + $_.Exception.Message)
  }
}

$lawyer = Login 'lawyer@example.com'
$cases = Invoke-RestMethod -Uri "$base/cases" -Headers $lawyer.Headers
$demo = $cases.data | Where-Object { $_.caseNumber -eq 'LV-DEMO-001' } | Select-Object -First 1
Write-Output ("CASES visible to lawyer: " + (($cases.data | ForEach-Object { $_.caseNumber }) -join ', '))
Write-Output ("Target case: " + $demo.caseNumber + " id=" + $demo.id)
Write-Output '--------------------------------------------------'

# TEST 4 (CRITICAL): unrelated blockchain query must NOT ground on case record
CaseChat $lawyer $demo.id 'blockchain transaction 0xdeadbeef sepolia judge citation AIR 1978 SC 1' 'TEST 4 blockchain'

# TEST 1: summarize
CaseChat $lawyer $demo.id 'Summarize this case.' 'TEST 1 summarize'

# TEST 2: issues + evidence
CaseChat $lawyer $demo.id 'What are the key issues in this case and what evidence supports each issue?' 'TEST 2 issues'

# TEST 3: obligations
CaseChat $lawyer $demo.id 'What are the obligations in this case?' 'TEST 3 obligations'
Write-Output '--------------------------------------------------'

# Windows PowerShell 5.1 has no -Form; use .NET HttpClient for multipart uploads.
function MultipartChat($headers, $query, $filePath, $label) {
  Add-Type -AssemblyName System.Net.Http
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromSeconds(60)
  $auth = $headers['Authorization']
  $client.DefaultRequestHeaders.TryAddWithoutValidation('Authorization', $auth) | Out-Null

  $content = New-Object System.Net.Http.MultipartFormDataContent
  $queryContent = New-Object System.Net.Http.StringContent($query)
  $content.Add($queryContent, 'query')
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  $fileContent = New-Object System.Net.Http.ByteArrayContent(,$bytes)
  $content.Add($fileContent, 'attachments', (Split-Path $filePath -Leaf))

  $response = $client.PostAsync("$base/ai/chat-with-attachments", $content).Result
  $bodyText = $response.Content.ReadAsStringAsync().Result
  $client.Dispose()
  if (-not $response.IsSuccessStatusCode) {
    Write-Output ("[$label] HTTP " + [int]$response.StatusCode + ': ' + $bodyText.Substring(0, [Math]::Min(200, $bodyText.Length)))
    return $null
  }
  return ($bodyText | ConvertFrom-Json)
}

# TEST 5: general legal question, no case (no-case multipart endpoint with a placeholder file
# so the request goes through the attachment path; the answer must come from legal authorities)
$client = Login 'client@example.com'
$tmp = New-TemporaryFile
Set-Content -Path $tmp -Value 'Placeholder note: this file does not answer the question.' -Encoding UTF8
$r5 = MultipartChat $client.Headers 'What is a civil case?' $tmp 'TEST 5 civil case'
if ($r5) {
  Write-Output ("[TEST 5 civil case] status=" + $r5.status + " mode=" + $r5.mode + " legalSources=[" + (($r5.legalSources | ForEach-Object { $_.documentName }) -join '; ') + "]")
  Write-Output ("  answer: " + ($r5.answer -replace "`n", ' ').Substring(0, [Math]::Min(240, $r5.answer.Length)))
}
Remove-Item $tmp -Force
Write-Output '--------------------------------------------------'

# TEST 6 + 7: attachment questions (no-case path)
$tmp2 = New-TemporaryFile
Set-Content -Path $tmp2 -Value 'The defendant was required to provide written notice within 30 days.' -Encoding UTF8

$r6 = MultipartChat $client.Headers "What was the defendant's notice obligation?" $tmp2 'TEST 6 notice'
if ($r6) {
  Write-Output ("[TEST 6 notice] status=" + $r6.status + " citations=[" + (($r6.citations | ForEach-Object { $_.documentName }) -join '; ') + "]")
  Write-Output ("  answer: " + ($r6.answer -replace "`n", ' ').Substring(0, [Math]::Min(280, $r6.answer.Length)))
}

$r7 = MultipartChat $client.Headers "What was the defendant's criminal conviction?" $tmp2 'TEST 7 conviction'
if ($r7) {
  Write-Output ("[TEST 7 conviction] status=" + $r7.status)
  Write-Output ("  answer: " + ($r7.answer -replace "`n", ' ').Substring(0, [Math]::Min(280, $r7.answer.Length)))
}
Remove-Item $tmp2 -Force
Write-Output '--------------------------------------------------'

# AUTHORIZATION: unauthenticated request must be rejected
try {
  Invoke-RestMethod -Uri "$base/cases/$($demo.id)/ai/chat" -Method Post -Body (@{ query='test' } | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop | Out-Null
  Write-Output '[AUTH] FAIL: unauthenticated request accepted'
} catch { Write-Output ('[AUTH] unauthenticated blocked with HTTP ' + $_.Exception.Response.StatusCode.value__) }

# AUTHORIZATION: user B (client) listing cases must not see cases they are not a party to
$caseDetail = Invoke-RestMethod -Uri "$base/cases/$($demo.id)" -Headers $client.Headers
Write-Output ("[AUTHZ] client can open own case: " + $caseDetail.data.caseNumber)

