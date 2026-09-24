// Read-only native Task Scheduler query. Avoid importing the ScheduledTasks CIM
// module: its cold start can exceed the self-check's bounded five-second probe.
export const WINDOWS_STARTUP_TASK_QUERY = `
$ErrorActionPreference = 'Stop'
$service = New-Object -ComObject 'Schedule.Service'
$service.Connect()
$folder = $service.GetFolder('\\')
$stateNames = @('Unknown', 'Disabled', 'Queued', 'Ready', 'Running')
$items = @()
foreach ($name in @('ASTRA-Agent', 'ASTRA-Ollama')) {
  try {
    $task = $folder.GetTask($name)
    $state = [int]$task.State
    $stateName = 'Unknown'
    if ($state -ge 0 -and $state -lt $stateNames.Count) {
      $stateName = $stateNames[$state]
    }
    $items += [pscustomobject]@{ name = $name; state = $stateName }
  } catch {
    $failure = $_.Exception
    while ($null -ne $failure.InnerException) {
      $failure = $failure.InnerException
    }
    # HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND). Access denied and every other
    # inspection failure must propagate, not masquerade as an absent task.
    if ($failure.HResult -ne -2147024894) { throw }
    $items += [pscustomobject]@{ name = $name; state = 'MISSING' }
  }
}
ConvertTo-Json -InputObject $items -Compress
`.trim();
