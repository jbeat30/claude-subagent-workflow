$in = [Console]::In.ReadToEnd() | ConvertFrom-Json
$f = $in.tool_input.file_path.Replace([string][char]92, "/")
if ($f -match "/src/") {
  [Console]::Error.WriteLine("proto-guard(ps1): src 수정 차단, 등급 기록 전")
  exit 2
}
exit 0
