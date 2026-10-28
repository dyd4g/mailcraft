// Mailcraft Studio on Azure: Container Apps (the app), Azure Database for PostgreSQL (the data), Container Registry (the image).
// Deployed in two passes by deploy.ps1: first with deployApp=false (registry, database, environment), then, once the image is
// built into the registry, with deployApp=true (the container app itself).

@description('Azure region.')
param location string = resourceGroup().location

@description('Short lowercase name used as a prefix for every resource, 3 to 14 letters or digits.')
@minLength(3)
@maxLength(14)
param baseName string = 'mailcraft'

@description('Administrator password for the PostgreSQL server. Letters and digits only, 20 or more characters.')
@secure()
param postgresPassword string

@description('One-time secret that allows creating the first administrator. Remove it after setup.')
@secure()
param setupToken string

@description('SendGrid API key with Mail Send permission only. Leave empty until you have one.')
@secure()
param sendGridApiKey string = ''

@description('Public address people will use, for example https://mailcraft.example.com. Empty uses the address Azure assigns.')
param publicBaseUrl string = ''

@description('Image tag to run.')
param imageTag string = 'latest'

@description('Create the container app. Pass false for the first pass, before the image exists.')
param deployApp bool = true

var suffix = uniqueString(resourceGroup().id)
var registryName = toLower('${baseName}${suffix}')
var serverName = toLower('${baseName}-pg-${suffix}')
var appName = '${baseName}-app'
var pgAdmin = 'mailcraftadmin'
var databaseName = 'mailcraft'
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${baseName}-identity'
  location: location
}

resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, acrPullRoleId)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: serverName
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: pgAdmin
    administratorLoginPassword: postgresPassword
    storage: { storageSizeGB: 32 }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgres
  name: databaseName
}

// Lets Azure-hosted services reach the database. Access still needs the password and an encrypted connection.
// To restrict further, move both into a virtual network with private access.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${baseName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var databaseUrl = 'postgres://${pgAdmin}:${postgresPassword}@${postgres.properties.fullyQualifiedDomainName}:5432/${databaseName}?sslmode=require'
var effectivePublicUrl = empty(publicBaseUrl) ? 'https://${appName}.${environment.properties.defaultDomain}' : publicBaseUrl

resource app 'Microsoft.App/containerApps@2024-03-01' = if (deployApp) {
  name: appName
  location: location
  dependsOn: [ pullRole, database, allowAzure ]
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${identity.id}': {} }
  }
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        { server: registry.properties.loginServer, identity: identity.id }
      ]
      secrets: concat([
        { name: 'database-url', value: databaseUrl }
        { name: 'setup-token', value: setupToken }
      ], empty(sendGridApiKey) ? [] : [
        { name: 'sendgrid-api-key', value: sendGridApiKey }
      ])
    }
    template: {
      containers: [
        {
          name: 'mailcraft'
          image: '${registry.properties.loginServer}/mailcraft:${imageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat([
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PUBLIC_BASE_URL', value: effectivePublicUrl }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'SETUP_TOKEN', secretRef: 'setup-token' }
          ], empty(sendGridApiKey) ? [] : [
            { name: 'SENDGRID_API_KEY', secretRef: 'sendgrid-api-key' }
          ])
          probes: [
            { type: 'Startup', httpGet: { path: '/api/health', port: 3000 }, initialDelaySeconds: 5, periodSeconds: 5, failureThreshold: 30 }
            { type: 'Liveness', httpGet: { path: '/api/health', port: 3000 }, periodSeconds: 30, failureThreshold: 3 }
          ]
        }
      ]
      // One copy only: migrations run at start, and sessions and rate limits assume a single server.
      scale: { minReplicas: 1, maxReplicas: 1 }
    }
  }
}

output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output postgresServer string = postgres.properties.fullyQualifiedDomainName
output appUrl string = effectivePublicUrl
