# Windows PowerShell Setup Script for Appointment Booking Platform

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Appointment Booking Platform Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is installed
Write-Host "Checking PostgreSQL installation..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL is installed: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠ PostgreSQL might not be installed or not in PATH" -ForegroundColor Yellow
    Write-Host "Please ensure PostgreSQL is installed and running" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Installing Dependencies" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install backend dependencies" -ForegroundColor Red
    exit 1
}

# Install frontend dependencies
Write-Host ""
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location ..\frontend
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Setting up Environment Files" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend .env exists
if (-Not (Test-Path "backend\.env")) {
    Write-Host "Creating backend .env file..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "✓ Backend .env file created" -ForegroundColor Green
    Write-Host "⚠ Please edit backend\.env with your configuration" -ForegroundColor Yellow
} else {
    Write-Host "✓ Backend .env file already exists" -ForegroundColor Green
}

# Check if frontend .env.local exists
if (-Not (Test-Path "frontend\.env.local")) {
    Write-Host "Creating frontend .env.local file..." -ForegroundColor Yellow
    Copy-Item "frontend\.env.local.example" "frontend\.env.local"
    Write-Host "✓ Frontend .env.local file created" -ForegroundColor Green
    Write-Host "⚠ Please edit frontend\.env.local with your configuration" -ForegroundColor Yellow
} else {
    Write-Host "✓ Frontend .env.local file already exists" -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Database Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$runMigrations = Read-Host "Do you want to run database migrations now? (y/n)"
if ($runMigrations -eq "y" -or $runMigrations -eq "Y") {
    Write-Host "Running database migrations..." -ForegroundColor Yellow
    Set-Location backend
    npm run migrate
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database migrations completed successfully" -ForegroundColor Green
        
        $runSeed = Read-Host "Do you want to seed test data? (y/n)"
        if ($runSeed -eq "y" -or $runSeed -eq "Y") {
            Write-Host "Seeding test data..." -ForegroundColor Yellow
            npm run seed
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Test data seeded successfully" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "✗ Database migrations failed" -ForegroundColor Red
        Write-Host "Please ensure PostgreSQL is running and DATABASE_URL is correct in backend\.env" -ForegroundColor Yellow
    }
    Set-Location ..
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit backend\.env with your database and email settings" -ForegroundColor White
Write-Host "2. Edit frontend\.env.local with your API URL" -ForegroundColor White
Write-Host "3. Run 'npm run dev' to start both servers" -ForegroundColor White
Write-Host ""
Write-Host "Default URLs:" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Test Accounts (after seeding):" -ForegroundColor Yellow
Write-Host "Customer: customer@test.com / password123" -ForegroundColor White
Write-Host "Business: barber@test.com / password123" -ForegroundColor White
Write-Host "Admin:    admin@appointment.com / password123" -ForegroundColor White
Write-Host ""
Write-Host "For more information, see QUICKSTART.md" -ForegroundColor Cyan
Write-Host ""
