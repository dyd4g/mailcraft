<#
.SYNOPSIS
  Deploys Mailcraft Studio to Azure (Container Apps + PostgreSQL + Container Registry).

.DESCRIPTION
  Run `az login` first, and `az account set --subscription "<name>"` if you have several.
  Safe to run again to deploy a new version: secrets are generated once and kept in infra/azure/.secrets/<name>.json
  (git-ignored). Back that file up somewhere safe, for example your password manager.

.EXAMPLE
  ./infra/azure/deploy.ps1 -ResourceGroup mailcraft-rg -Location eastus
  ./infra/azure/deploy.ps1 -ResourceGroup mailcraft-rg -Location eastus -PublicBaseUrl https://mailcraft.example.com
#>
param(
  [Parameter(Mandatory)] [string] $ResourceGroup,
  [Parameter(Mandatory)] [string] $Location,
  [string] $BaseName = 'mailcraft',
  [string] $PublicBaseUrl = '',
  [string] $ImageTag = (Get-Date -Format 'yyyyMMddHHmmss')
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$secretsDir = Join-Path $PSScriptRoot '.secrets'
$secretsFile = Join-Path $secretsDir "$BaseName.json"

function Invoke-Az {
  $output = & az @args
  if ($LASTEXITCODE -ne 0) { throw "az $($args -join ' ') failed" }
  return $output
}
function New-RandomSecret([int] $length) {
  $chars = [char[]]'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  -join (1..$length | ForEach-Object { $chars[[Security.Cryptography.RandomNumberGenerator]::GetInt32($chars.Length)] })
}

$account = Invoke-Az account show --query '{name:name,id:id,user:user.name}' -o json | ConvertFrom-Json
Write-Host "Subscription: $($account.name) ($($account.id)) as $($account.user)"
if ((Read-Host 'Deploy into this subscription? (yes/no)') -ne 'yes') { Write-Host 'Cancelled.'; exit 1 }

if (-not (Test-Path $secretsFile)) {
  New-Item -ItemType Directory -Force $secretsDir | Out-Null
  [ordered]@{ postgresPassword = (New-RandomSecret 28); setupToken = (New-RandomSecret 32); sendGridApiKey = '' } |
    ConvertTo-Json | Set-Content $secretsFile -Encoding utf8
  Write-Host "Generated secrets in $secretsFile. Back this file up; it is not committed."
}
$secrets = Get-Content $secretsFile -Raw | ConvertFrom-Json

Invoke-Az group create --name $ResourceGroup --location $Location -o none
$common = @('--resource-group', $ResourceGroup, '--template-file', (Join-Path $PSScriptRoot 'main.bicep'),
  '--parameters', "baseName=$BaseName", "postgresPassword=$($secrets.postgresPassword)", "setupToken=$($secrets.setupToken)",
  "sendGridApiKey=$($secrets.sendGridApiKey)", "publicBaseUrl=$PublicBaseUrl", "imageTag=$ImageTag")

Write-Host '1/3 Creating registry, database and environment...'
$first = Invoke-Az deployment group create @common 'deployApp=false' --query properties.outputs -o json | ConvertFrom-Json

Write-Host "2/3 Building the image in the registry ($($first.registryName.value))..."
Invoke-Az acr build --registry $first.registryName.value --image "mailcraft:$ImageTag" --file (Join-Path $root 'Dockerfile') $root

Write-Host '3/3 Creating the container app...'
$final = Invoke-Az deployment group create @common 'deployApp=true' --query properties.outputs -o json | ConvertFrom-Json

Write-Host ''
Write-Host "Mailcraft is running at: $($final.appUrl.value)"
Write-Host "First sign-in: open that address and use the setup token from $secretsFile to create the first administrator."
Write-Host 'Afterwards remove the setup token from the app: az containerapp secret remove / update (see docs/AZURE.md).'
