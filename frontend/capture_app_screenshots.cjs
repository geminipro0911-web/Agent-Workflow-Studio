const { chromium } = require('playwright');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const OUT_DIR_ROOT = path.join(__dirname, '..', 'tutorial_assets');
const OUT_DIR_PUBLIC = path.join(__dirname, 'public', 'tutorial_assets');

// Ensure output dirs exist
if (!fs.existsSync(OUT_DIR_ROOT)) fs.mkdirSync(OUT_DIR_ROOT, { recursive: true });
if (!fs.existsSync(OUT_DIR_PUBLIC)) fs.mkdirSync(OUT_DIR_PUBLIC, { recursive: true });

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    }

    function retry() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout waiting for server at ${url}`));
      } else {
        setTimeout(check, 300);
      }
    }

    check();
  });
}

function saveImage(filename, buffer) {
  fs.writeFileSync(path.join(OUT_DIR_ROOT, filename), buffer);
  fs.writeFileSync(path.join(OUT_DIR_PUBLIC, filename), buffer);
  console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
}

async function main() {
  console.log('Starting preview server on port 4173...');
  const server = spawn('npx', ['vite', 'preview', '--port', '4173'], {
    cwd: __dirname,
    shell: true,
    stdio: 'pipe'
  });

  server.stdout.on('data', (d) => console.log(`[Vite stdout] ${d}`));
  server.stderr.on('data', (d) => console.error(`[Vite stderr] ${d}`));

  try {
    await waitForServer('http://localhost:4173');
    console.log('Preview server ready! Launching Chromium via Playwright...');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2
    });

    const page = await context.newPage();
    console.log('Navigating to http://localhost:4173 ...');
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

    // Wait 2 seconds for initial animations, Chibi SVGs, and fullstack_sdlc template layout
    await page.waitForTimeout(2500);

    // 1. Full Studio Overview (Dark mode, Feudal skin)
    console.log('Capturing: 01_full_studio_overview.png');
    const fullStudioBuf = await page.screenshot();
    saveImage('01_full_studio_overview.png', fullStudioBuf);

    // 2. Left Sidebar (Enterprise Agent Library & Templates)
    console.log('Capturing: 02_sidebar_agent_library.png');
    const sidebarEl = await page.$('aside, [data-testid="left-sidebar"], .w-72, .w-80');
    if (sidebarEl) {
      const sidebarBuf = await sidebarEl.screenshot();
      saveImage('02_sidebar_agent_library.png', sidebarBuf);
    } else {
      // Crop left area
      const sidebarCropBuf = await page.screenshot({ clip: { x: 0, y: 0, width: 320, height: 1080 } });
      saveImage('02_sidebar_agent_library.png', sidebarCropBuf);
    }

    // 3. Canvas Living 3D Chibis (Center Flow Canvas)
    console.log('Capturing: 03_canvas_living_chibis.png');
    const canvasCropBuf = await page.screenshot({ clip: { x: 310, y: 70, width: 1250, height: 750 } });
    saveImage('03_canvas_living_chibis.png', canvasCropBuf);

    // 4. Right Inspector (Allowed Paths, Prompts, Governance)
    console.log('Capturing: 04_inspector_allowed_paths.png');
    const inspectorCropBuf = await page.screenshot({ clip: { x: 1540, y: 70, width: 380, height: 750 } });
    saveImage('04_inspector_allowed_paths.png', inspectorCropBuf);

    // 5. Live Terminal (Lower Right Console)
    console.log('Capturing: 05_live_terminal.png');
    const terminalCropBuf = await page.screenshot({ clip: { x: 310, y: 800, width: 1610, height: 280 } });
    saveImage('05_live_terminal.png', terminalCropBuf);

    // 6. Trigger Git Scope Violation Modal
    console.log('Triggering Git Scope Violation modal...');
    const testViolationBtn = await page.$('button:has-text("Test Violation"), button:has-text("Giả lập vi phạm"), button[title*="Violation"]');
    if (testViolationBtn) {
      await testViolationBtn.click();
      await page.waitForTimeout(800);
      console.log('Capturing: 06_git_violation_modal.png');
      const modalBuf = await page.screenshot();
      saveImage('06_git_violation_modal.png', modalBuf);

      // Close modal by clicking Revert or close button
      const closeBtn = await page.$('button:has-text("Revert"), button:has-text("Khôi phục"), button:has-text("Close")');
      if (closeBtn) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 7. Switch to Wall St Capitalist Skin
    console.log('Switching to Wall St Capitalist skin...');
    const skinDropdownBtn = await page.$('button:has-text("Phong Kiến"), button:has-text("Feudal"), button[title*="Skin"], button:has-text("👑")');
    if (skinDropdownBtn) {
      await skinDropdownBtn.click();
      await page.waitForTimeout(400);
      const capitalistOption = await page.$('button:has-text("Tư Bản"), button:has-text("Capitalist"), div:has-text("Tư Bản")');
      if (capitalistOption) {
        await capitalistOption.click();
        await page.waitForTimeout(1000);
        console.log('Capturing: 07_capitalist_skin.png');
        const capitalistBuf = await page.screenshot();
        saveImage('07_capitalist_skin.png', capitalistBuf);
      }
    }

    // 8. Switch to Light Mode
    console.log('Switching to Light Mode...');
    const themeBtn = await page.$('button[title*="Light"], button[title*="Dark"], button[title*="Sáng"], button[title*="Tối"]');
    if (themeBtn) {
      await themeBtn.click();
      await page.waitForTimeout(800);
      console.log('Capturing: 08_light_mode.png');
      const lightBuf = await page.screenshot();
      saveImage('08_light_mode.png', lightBuf);
    }

    await browser.close();
    console.log('All screenshots captured successfully!');
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error('Capture script error:', err);
  process.exit(1);
});
