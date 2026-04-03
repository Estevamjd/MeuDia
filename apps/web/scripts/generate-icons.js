const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Usar o SVG 512 como fonte (mobile/assets/icon.png não disponível)
const input = path.join(__dirname, '../public/icons/icon-512.svg');
const outputDir = path.join(__dirname, '../public');
const iconsDir = path.join(outputDir, 'icons');

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

async function generate() {
  console.log('Gerando ícones PNG...');

  // Ícones para manifest.json
  await sharp(input).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(input).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  console.log('  ✓ icon-192.png, icon-512.png');

  // Apple Touch Icon (obrigatório para iOS)
  await sharp(input).resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png');

  // Favicons
  await sharp(input).resize(32, 32).png().toFile(path.join(outputDir, 'favicon-32x32.png'));
  await sharp(input).resize(16, 16).png().toFile(path.join(outputDir, 'favicon-16x16.png'));
  await sharp(input).resize(48, 48).png().toFile(path.join(outputDir, 'favicon.png'));
  console.log('  ✓ favicons (16, 32, 48)');

  // Splash screens para iPhone
  const splashes = [
    { w: 1290, h: 2796, label: 'iPhone 15 Pro Max' },
    { w: 1179, h: 2556, label: 'iPhone 15 Pro' },
    { w: 1170, h: 2532, label: 'iPhone 15/14/13/12' },
    { w: 750, h: 1334, label: 'iPhone SE/8' },
    { w: 1080, h: 2340, label: 'iPhone 12/13 mini' },
  ];

  for (const s of splashes) {
    await generateSplash(input, s.w, s.h, path.join(iconsDir, `splash-${s.w}x${s.h}.png`));
    console.log(`  ✓ splash-${s.w}x${s.h}.png (${s.label})`);
  }

  console.log('\nTodos os ícones e splash screens gerados!');
}

async function generateSplash(iconPath, width, height, outputPath) {
  const iconSize = Math.round(Math.min(width, height) * 0.25);
  const icon = await sharp(iconPath)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 10, b: 28, alpha: 1 },
    },
  })
    .composite([
      {
        input: icon,
        top: Math.round((height - iconSize) / 2),
        left: Math.round((width - iconSize) / 2),
      },
    ])
    .png()
    .toFile(outputPath);
}

generate().catch(console.error);
