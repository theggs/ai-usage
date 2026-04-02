#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..');
const cargoHome = process.env.CARGO_HOME || path.join(process.env.HOME, '.cargo');

const COPYLEFT_PATTERNS = [
  'AGPL',
  'CC-BY-SA',
  'CDDL',
  'CPL',
  'EPL',
  'GPL',
  'LGPL',
  'MPL'
];

const OUTPUT_PATH = path.join(repoRoot, 'src', 'generated', 'license-audit.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function normalizeLicense(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/\s+/g, ' ')
      .replace(/[()]/g, '')
      .trim();
    return normalized || null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map(normalizeLicense)
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(' OR ') : null;
  }

  if (typeof value === 'object') {
    if (typeof value.type === 'string') {
      return normalizeLicense(value.type);
    }

    if (typeof value.spdx === 'string') {
      return normalizeLicense(value.spdx);
    }
  }

  return null;
}

function extractPackageJsonLicense(packageJson) {
  return normalizeLicense(
    packageJson.license ||
      packageJson.licenses ||
      packageJson.licenseText ||
      null
  );
}

function isCopyleftLicense(license) {
  if (!license) {
    return false;
  }

  const upper = license.toUpperCase();
  return COPYLEFT_PATTERNS.some((pattern) => upper.includes(pattern));
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function resolveCargoLockPath() {
  const candidates = [
    path.join(repoRoot, 'src-tauri', 'Cargo.lock'),
    path.join(repoRoot, 'Cargo.lock')
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Cargo.lock not found in src-tauri/ or repository root');
}

function parsePackageLock() {
  const packageLockPath = path.join(repoRoot, 'package-lock.json');

  if (!fileExists(packageLockPath)) {
    throw new Error('package-lock.json not found');
  }

  const packageLock = readJson(packageLockPath);
  const packagesMap = packageLock.packages || {};
  const packages = [];

  for (const [installPath, info] of Object.entries(packagesMap)) {
    if (!installPath) {
      continue;
    }

    let license = normalizeLicense(info.license);

    if (!license) {
      const packageJsonPath = path.join(repoRoot, installPath, 'package.json');
      if (fileExists(packageJsonPath)) {
        license = extractPackageJsonLicense(readJson(packageJsonPath));
      }
    }

    packages.push({
      ecosystem: 'npm',
      name: installPath.replace(/^node_modules\//, ''),
      version: info.version || 'unknown',
      license
    });
  }

  return packages;
}

function parseTomlScalar(line, key) {
  const normalizedLine = line.trim();
  const match = normalizedLine.match(
    new RegExp(`^${key}\\s*=\\s*"(.*)"\\s*$`)
  );
  return match ? match[1] : null;
}

function parseCargoManifest(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf8');
  const lines = content.split(/\r?\n/);
  let inPackageTable = false;
  let name = null;
  let version = null;
  let license = null;
  let hasLicenseFile = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (/^\[\[/.test(trimmed)) {
      inPackageTable = false;
      continue;
    }

    const tableMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (tableMatch) {
      inPackageTable = tableMatch[1] === 'package';
      continue;
    }

    if (!inPackageTable) {
      continue;
    }

    name ||= parseTomlScalar(trimmed, 'name');
    version ||= parseTomlScalar(trimmed, 'version');
    license ||= normalizeLicense(parseTomlScalar(trimmed, 'license'));
    hasLicenseFile ||= Boolean(parseTomlScalar(trimmed, 'license-file'));
  }

  return {
    name,
    version,
    license,
    hasLicenseFile
  };
}

function walkFiles(rootDir, filename) {
  const results = [];

  if (!fileExists(rootDir)) {
    return results;
  }

  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'target' || entry.name === 'node_modules') {
          continue;
        }
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === filename) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function buildManifestIndex(manifestPaths) {
  const index = new Map();

  for (const manifestPath of manifestPaths) {
    try {
      const manifest = parseCargoManifest(manifestPath);
      if (!manifest.name || !manifest.version) {
        continue;
      }
      index.set(`${manifest.name}@${manifest.version}`, manifest);
    } catch {
      // Ignore malformed manifests outside this project's dependency graph.
    }
  }

  return index;
}

function buildRegistryManifestIndex() {
  const registryRoot = path.join(cargoHome, 'registry', 'src');
  const index = new Map();

  if (!fileExists(registryRoot)) {
    return index;
  }

  for (const sourceDir of fs.readdirSync(registryRoot, { withFileTypes: true })) {
    if (!sourceDir.isDirectory()) {
      continue;
    }

    const sourcePath = path.join(registryRoot, sourceDir.name);
    for (const crateDir of fs.readdirSync(sourcePath, { withFileTypes: true })) {
      if (!crateDir.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(sourcePath, crateDir.name, 'Cargo.toml');
      if (!fileExists(manifestPath)) {
        continue;
      }

      try {
        const manifest = parseCargoManifest(manifestPath);
        if (!manifest.name || !manifest.version) {
          continue;
        }
        index.set(`${manifest.name}@${manifest.version}`, manifest);
      } catch {
        // Ignore malformed cached manifests.
      }
    }
  }

  return index;
}

function parseCargoLock() {
  const cargoLockPath = resolveCargoLockPath();
  const content = fs.readFileSync(cargoLockPath, 'utf8');
  const packageBlocks = content.split('[[package]]').slice(1);
  const registryIndex = buildRegistryManifestIndex();
  const gitIndex = buildManifestIndex(
    walkFiles(path.join(cargoHome, 'git', 'checkouts'), 'Cargo.toml')
  );
  const workspaceIndex = buildManifestIndex(walkFiles(repoRoot, 'Cargo.toml'));
  const crates = [];

  for (const block of packageBlocks) {
    const name = parseTomlScalar(block.match(/^\s*name\s*=.*$/m)?.[0] || '', 'name');
    const version = parseTomlScalar(
      block.match(/^\s*version\s*=.*$/m)?.[0] || '',
      'version'
    );
    const source = parseTomlScalar(
      block.match(/^\s*source\s*=.*$/m)?.[0] || '',
      'source'
    );

    if (!name || !version) {
      continue;
    }

    const key = `${name}@${version}`;
    const manifest =
      registryIndex.get(key) || gitIndex.get(key) || workspaceIndex.get(key) || null;
    const license = manifest?.license || null;

    crates.push({
      ecosystem: 'rust',
      name,
      version,
      source,
      license,
      hasLicenseFile: manifest?.hasLicenseFile || false
    });
  }

  return crates;
}

function summarizePackages(packages) {
  let auditedCount = 0;
  let unknownLicenseCount = 0;
  let copyleftCount = 0;

  for (const pkg of packages) {
    if (pkg.license) {
      auditedCount += 1;
      if (isCopyleftLicense(pkg.license)) {
        copyleftCount += 1;
      }
      continue;
    }

    unknownLicenseCount += 1;
  }

  return {
    packageCount: packages.length,
    auditedCount,
    unknownLicenseCount,
    copyleftCount
  };
}

function enforceCoverage({ npmSummary, rustSummary }) {
  if (npmSummary.packageCount > 0 && npmSummary.auditedCount === 0) {
    throw new Error(
      'npm audit resolved zero licenses from package-lock.json; refusing to write misleading output'
    );
  }

  if (rustSummary.packageCount > 0 && rustSummary.auditedCount === 0) {
    throw new Error(
      'Rust audit resolved zero licenses from Cargo.lock and local manifests; refusing to write misleading output'
    );
  }
}

function auditLicenses() {
  const npmPackages = parsePackageLock();
  const rustPackages = parseCargoLock();
  const npmSummary = summarizePackages(npmPackages);
  const rustSummary = summarizePackages(rustPackages);

  enforceCoverage({ npmSummary, rustSummary });

  const result = {
    totalPackages: npmSummary.packageCount + rustSummary.packageCount,
    npmPackageCount: npmSummary.packageCount,
    rustPackageCount: rustSummary.packageCount,
    npmAuditedCount: npmSummary.auditedCount,
    rustAuditedCount: rustSummary.auditedCount,
    copyleftCount: npmSummary.copyleftCount + rustSummary.copyleftCount,
    unknownLicenseCount:
      npmSummary.unknownLicenseCount + rustSummary.unknownLicenseCount,
    generatedAt: new Date().toISOString()
  };

  ensureDirectory(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result, null, 2)}\n`);

  console.log(
    [
      `License audit complete: ${result.totalPackages} packages`,
      `npm audited ${result.npmAuditedCount}/${result.npmPackageCount}`,
      `rust audited ${result.rustAuditedCount}/${result.rustPackageCount}`,
      `unknown ${result.unknownLicenseCount}`,
      `copyleft ${result.copyleftCount}`
    ].join(', ')
  );
}

auditLicenses();
