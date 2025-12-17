# Deploy Freelance Escrow DApp
# This script handles the full deployment process

Write-Host "------------" -ForegroundColor Cyan
Write-Host "Freelance Escrow DApp - Deployment" -ForegroundColor Cyan
Write-Host "------------" -ForegroundColor Cyan
Write-Host ""

# Check if Ganache is running
Write-Host "1. Checking Ganache connection..." -ForegroundColor Yellow
$ganacheTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 8545 -WarningAction SilentlyContinue

if (-not $ganacheTest.TcpTestSucceeded) {
    Write-Host "    ERROR: Ganache is not running on port 8545!" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Please start Ganache with:" -ForegroundColor Yellow
    Write-Host "   ganache --port 8545 --chain.networkId 1337 --chain.chainId 1337" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "    Ganache is running" -ForegroundColor Green
Write-Host ""

# Clean previous build
Write-Host "2. Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path ".\build") {
    Remove-Item -Recurse -Force .\build
    Write-Host "    Build directory cleaned" -ForegroundColor Green
} else {
    Write-Host "    No previous build found" -ForegroundColor Gray
}
Write-Host ""

# Compile contracts
Write-Host "3. Compiling smart contracts..." -ForegroundColor Yellow
truffle compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Compilation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "    Compilation successful" -ForegroundColor Green
Write-Host ""

# Migrate contracts
Write-Host "4. Deploying to Ganache (network: development)..." -ForegroundColor Yellow
truffle migrate --reset --network development
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Migration failed!" -ForegroundColor Red
    exit 1
}
Write-Host "    Migration successful" -ForegroundColor Green
Write-Host ""

# Copy artifacts
Write-Host "5. Copying artifacts to client..." -ForegroundColor Yellow
node scripts/copy-artifacts.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Artifact copy failed!" -ForegroundColor Red
    exit 1
}
Write-Host "    Artifacts copied" -ForegroundColor Green
Write-Host ""

# Verify deployment
Write-Host "6. Verifying deployment..." -ForegroundColor Yellow
if (Test-Path ".\client\src\contracts\FreelanceEscrow.json") {
    Write-Host "    Contract artifact exists" -ForegroundColor Green
    
    if (Test-Path ".\client\src\escrowConfig.js") {
        Write-Host "    Config file exists" -ForegroundColor Green
        
        $configContent = Get-Content ".\client\src\escrowConfig.js" -Raw
        
        if ($configContent -match 'NETWORK_ID = "1337"') {
            Write-Host "    Network ID is 1337" -ForegroundColor Green
        } else {
            Write-Host "    WARNING: Network ID is not 1337!" -ForegroundColor Yellow
        }
        
        if ($configContent -match 'CONTRACT_ADDRESS = "0x[a-fA-F0-9]{40}"') {
            $address = ($configContent | Select-String -Pattern '0x[a-fA-F0-9]{40}').Matches.Value
            Write-Host "    Contract deployed at: $address" -ForegroundColor Green
        }
    } else {
        Write-Host "    Config file missing!" -ForegroundColor Red
    }
} else {
    Write-Host "    Contract artifact missing!" -ForegroundColor Red
}
Write-Host ""

# Success message
Write-Host "------------" -ForegroundColor Cyan
Write-Host " DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. cd client" -ForegroundColor White
Write-Host "2. npm start" -ForegroundColor White
Write-Host ""
Write-Host "MetaMask setup:" -ForegroundColor Yellow
Write-Host "- Network: Ganache Local" -ForegroundColor White
Write-Host "- RPC URL: http://127.0.0.1:8545" -ForegroundColor White
Write-Host "- Chain ID: 1337" -ForegroundColor White
Write-Host "- Import a Ganache account private key" -ForegroundColor White
Write-Host ""
Write-Host "Happy testing! " -ForegroundColor Cyan
