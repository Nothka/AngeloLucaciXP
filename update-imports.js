import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');

// Mapping of old paths to new paths
const pathMappings = {
  // Logos
  '"./assets/xp-logo.webp"': '"./assets/logos/xp-logo.webp"',
  "'./assets/xp-logo.webp'": "'./assets/logos/xp-logo.webp'",
  '"../../assets/xp-logo.webp"': '"../../assets/logos/xp-logo.webp"',
  "'../../assets/xp-logo.webp'": "'../../assets/logos/xp-logo.webp"',
  '"../../../assets/xp-logo.webp"': '"../../../assets/logos/xp-logo.webp"',
  "'../../../assets/xp-logo.webp'": "'../../../assets/logos/xp-logo.webp'",
  
  '"../../assets/login-avatar.webp"': '"../../assets/logos/login-avatar.webp"',
  "'../../assets/login-avatar.webp'": "'../../assets/logos/login-avatar.webp'",
  '"../../../assets/login-avatar.webp"': '"../../../assets/logos/login-avatar.webp"',
  "'../../../assets/login-avatar.webp'": "'../../../assets/logos/login-avatar.webp'",
  
  // UI Icons
  '"./assets/restart.webp"': '"./assets/icons/ui/restart.webp"',
  "'./assets/restart.webp'": "'./assets/icons/ui/restart.webp'",
  '"../../assets/restart.webp"': '"../../assets/icons/ui/restart.webp"',
  "'../../assets/restart.webp'": "'../../assets/icons/ui/restart.webp'",
  '"../../../assets/restart.webp"': '"../../../assets/icons/ui/restart.webp"',
  "'../../../assets/restart.webp'": "'../../../assets/icons/ui/restart.webp'",
  
  '"./assets/start.webp"': '"./assets/icons/ui/start.webp"',
  "'./assets/start.webp'": "'./assets/icons/ui/start.webp'",
  '"./assets/start-hovered.webp"': '"./assets/icons/ui/start-hovered.webp"',
  "'./assets/start-hovered.webp'": "'./assets/icons/ui/start-hovered.webp'",
  '"./assets/start-clicked.webp"': '"./assets/icons/ui/start-clicked.webp"',
  "'./assets/start-clicked.webp'": "'./assets/icons/ui/start-clicked.webp'",
  
  '"../../../../assets/window/Exit.webp"': '"../../../../assets/icons/ui/window-controls/Exit.webp"',
  "'../../../../assets/window/Exit.webp'": "'../../../../assets/icons/ui/window-controls/Exit.webp'",
  '"../../../assets/window/Exit.webp"': '"../../../assets/icons/ui/window-controls/Exit.webp"',
  "'../../../assets/window/Exit.webp'": "'../../../assets/icons/ui/window-controls/Exit.webp'",
  '"../../assets/window/Exit.webp"': '"../../assets/icons/ui/window-controls/Exit.webp"',
  "'../../assets/window/Exit.webp'": "'../../assets/icons/ui/window-controls/Exit.webp'",
  
  '"../../assets/startmenu/adressbar/Go.webp"': '"../../assets/icons/apps/adressbar/Go.webp"',
  "'../../assets/startmenu/adressbar/Go.webp'": "'../../assets/icons/apps/adressbar/Go.webp'",
  '"../../../assets/startmenu/adressbar/Go.webp"': '"../../../assets/icons/apps/adressbar/Go.webp"',
  "'../../../assets/startmenu/adressbar/Go.webp'": "'../../../assets/icons/apps/adressbar/Go.webp'",
  
  // Start Menu Icons
  '"./assets/startmenu/Pdf.webp"': '"./assets/icons/apps/Pdf.webp"',
  "'./assets/startmenu/Pdf.webp'": "'./assets/icons/apps/Pdf.webp'",
  '"../../assets/startmenu/Pdf.webp"': '"../../assets/icons/apps/Pdf.webp"',
  "'../../assets/startmenu/Pdf.webp'": "'../../assets/icons/apps/Pdf.webp'",
  '"../../../assets/startmenu/Pdf.webp"': '"../../../assets/icons/apps/Pdf.webp"',
  "'../../../assets/startmenu/Pdf.webp'": "'../../../assets/icons/apps/Pdf.webp'",
  
  '"../../../assets/startmenu/commandprompt.webp"': '"../../../assets/icons/apps/commandprompt.webp"',
  "'../../../assets/startmenu/commandprompt.webp'": "'../../../assets/icons/apps/commandprompt.webp'",
  '"../../../assets/startmenu/github.webp"': '"../../../assets/icons/apps/github.webp"',
  "'../../../assets/startmenu/github.webp'": "'../../../assets/icons/apps/github.webp'",
  '"../../../assets/startmenu/linkedin.webp"': '"../../../assets/icons/apps/linkedin.webp"',
  "'../../../assets/startmenu/linkedin.webp'": "'../../../assets/icons/apps/linkedin.webp'",
  
  '"../../../assets/about-me/chatgpt.webp"': '"../../../assets/icons/skills/chatgpt.webp"',
  "'../../../assets/about-me/chatgpt.webp'": "'../../../assets/icons/skills/chatgpt.webp'",
  '"../../../assets/about-me/gemini.webp"': '"../../../assets/icons/skills/gemini.webp"',
  "'../../../assets/about-me/gemini.webp'": "'../../../assets/icons/skills/gemini.webp'",
  '"../../../assets/about-me/git.webp"': '"../../../assets/icons/skills/git.webp"',
  "'../../../assets/about-me/git.webp'": "'../../../assets/icons/skills/git.webp'",
  '"../../../assets/about-me/adobecc.webp"': '"../../../assets/icons/skills/adobecc.webp"',
  "'../../../assets/about-me/adobecc.webp'": "'../../../assets/icons/skills/adobecc.webp'",
  '"../../../assets/about-me/gitcopilot.webp"': '"../../../assets/icons/skills/gitcopilot.webp"',
  "'../../../assets/about-me/gitcopilot.webp'": "'../../../assets/icons/skills/gitcopilot.webp'",
  
  // Images
  '"./assets/xp-wallpaper.webp"': '"./assets/images/backgrounds/xp-wallpaper.webp"',
  "'./assets/xp-wallpaper.webp'": "'./assets/images/backgrounds/xp-wallpaper.webp'",
  '"../../assets/xp-wallpaper.webp"': '"../../assets/images/backgrounds/xp-wallpaper.webp"',
  "'../../assets/xp-wallpaper.webp'": "'../../assets/images/backgrounds/xp-wallpaper.webp'",
  
  // Audio
  '"../../assets/windows-shutdown.mp3"': '"../../assets/audio/windows-shutdown.mp3"',
  "'../../assets/windows-shutdown.mp3'": "'../../assets/audio/windows-shutdown.mp3'",
  '"../../assets/xp-startup.wav"': '"../../assets/audio/xp-startup.wav"',
  "'../../assets/xp-startup.wav'": "'../../assets/audio/xp-startup.wav'",
  '"../../../../assets/windows-xp-logoff.mp3"': '"../../../../assets/audio/windows-xp-logoff.mp3"',
  "'../../../../assets/windows-xp-logoff.mp3'": "'../../../../assets/audio/windows-xp-logoff.mp3'",
};

function updateFilesInDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', 'dist', '.vite'].includes(entry.name)) {
        updateFilesInDirectory(fullPath);
      }
    } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const originalContent = content;
      
      for (const [oldPath, newPath] of Object.entries(pathMappings)) {
        content = content.replaceAll(oldPath, newPath);
      }
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        const relativePath = path.relative(__dirname, fullPath);
        console.log(`✓ Updated: ${relativePath}`);
      }
    }
  }
}

updateFilesInDirectory(srcDir);
console.log('✓ JSX imports updated');
