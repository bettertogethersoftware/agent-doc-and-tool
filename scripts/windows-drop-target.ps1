Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:selectedPaths = [System.Collections.Generic.List[string]]::new()
$script:dropForm = New-Object System.Windows.Forms.Form
$script:dropForm.Text = 'Add search locations'
$script:dropForm.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$script:dropForm.ClientSize = New-Object System.Drawing.Size(620, 330)
$script:dropForm.MinimumSize = New-Object System.Drawing.Size(560, 310)
$script:dropForm.BackColor = [System.Drawing.Color]::FromArgb(9, 16, 15)
$script:dropForm.ForeColor = [System.Drawing.Color]::FromArgb(241, 245, 242)
$script:dropForm.ShowInTaskbar = $true
$script:dropForm.TopMost = $true
$script:dropForm.AllowDrop = $true
$script:dropForm.KeyPreview = $true
$script:dropForm.Add_Shown({
  $script:dropForm.WindowState = [System.Windows.Forms.FormWindowState]::Normal
  $script:dropForm.BringToFront()
  $script:dropForm.Activate()
})
$script:dropForm.Add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
    $script:dropForm.Close()
  }
})

$title = New-Object System.Windows.Forms.Label
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(28, 24)
$title.Font = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Bold)
$title.Text = 'Drop files or folders'
$script:dropForm.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.AutoSize = $true
$subtitle.Location = New-Object System.Drawing.Point(30, 60)
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(147, 164, 159)
$subtitle.Text = 'Drop from File Explorer. Press Esc or Cancel to close. Nothing is saved until you click Save configuration.'
$script:dropForm.Controls.Add($subtitle)

$dropArea = New-Object System.Windows.Forms.Panel
$dropArea.Location = New-Object System.Drawing.Point(30, 96)
$dropArea.Size = New-Object System.Drawing.Size(560, 158)
$dropArea.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Left -bor [System.Windows.Forms.AnchorStyles]::Right
$dropArea.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$dropArea.BackColor = [System.Drawing.Color]::FromArgb(16, 32, 25)
$dropArea.AllowDrop = $true
$script:dropForm.Controls.Add($dropArea)

$dropLabel = New-Object System.Windows.Forms.Label
$dropLabel.Dock = [System.Windows.Forms.DockStyle]::Fill
$dropLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$dropLabel.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$dropLabel.ForeColor = [System.Drawing.Color]::FromArgb(182, 255, 181)
$dropLabel.Text = "Drop from File Explorer here`r`n`r`nFiles become exact grants; folders become recursive search roots."
$dropLabel.AllowDrop = $true
$dropArea.Controls.Add($dropLabel)

$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = 'Cancel'
$cancelButton.Size = New-Object System.Drawing.Size(94, 34)
$cancelButton.Location = New-Object System.Drawing.Point(496, 272)
$cancelButton.Anchor = [System.Windows.Forms.AnchorStyles]::Bottom -bor [System.Windows.Forms.AnchorStyles]::Right
$cancelButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$cancelButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(54, 80, 71)
$cancelButton.BackColor = [System.Drawing.Color]::FromArgb(20, 33, 30)
$cancelButton.ForeColor = [System.Drawing.Color]::FromArgb(212, 222, 219)
$cancelButton.Add_Click({ $script:dropForm.Close() })
$script:dropForm.Controls.Add($cancelButton)

$dragEnter = {
  param($sender, $eventArgs)
  if ($eventArgs.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::Copy
    $dropArea.BackColor = [System.Drawing.Color]::FromArgb(24, 54, 34)
  } else {
    $eventArgs.Effect = [System.Windows.Forms.DragDropEffects]::None
  }
}

$dragLeave = {
  param($sender, $eventArgs)
  $dropArea.BackColor = [System.Drawing.Color]::FromArgb(16, 32, 25)
}

$drop = {
  param($sender, $eventArgs)
  if (-not $eventArgs.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) {
    return
  }

  foreach ($droppedPath in [string[]]$eventArgs.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop)) {
    if (-not [string]::IsNullOrWhiteSpace($droppedPath)) {
      $script:selectedPaths.Add($droppedPath)
    }
  }
  $script:dropForm.Close()
}

foreach ($control in @($script:dropForm, $dropArea, $dropLabel)) {
  $control.Add_DragEnter($dragEnter)
  $control.Add_DragLeave($dragLeave)
  $control.Add_DragDrop($drop)
}

[void]$script:dropForm.ShowDialog()

foreach ($selectedPath in $script:selectedPaths) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($selectedPath)
  [Console]::WriteLine([Convert]::ToBase64String($bytes))
}
