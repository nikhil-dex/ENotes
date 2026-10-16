const PLACEHOLDER_MARKERS = ['<username>', '<password>', '<cluster-host>', 'replace-with-', 'your-'];

export function validateReleaseEnvironment(env = process.env) {
  const issues = [];
  const uri = typeof env.MONGODB_URI === 'string' ? env.MONGODB_URI.trim() : '';
  const secret = typeof env.ENOTES_SESSION_SECRET === 'string' ? env.ENOTES_SESSION_SECRET : '';

  if (!uri) {
    issues.push('MONGODB_URI is required.');
  } else {
    if (!/^mongodb(?:\+srv)?:\/\//i.test(uri)) {
      issues.push('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
    }
    if (PLACEHOLDER_MARKERS.some((marker) => uri.toLowerCase().includes(marker))) {
      issues.push('MONGODB_URI still contains an example placeholder.');
    }
    try {
      const parsed = new URL(uri);
      if (!parsed.hostname || parsed.hostname === 'cluster-host') {
        issues.push('MONGODB_URI must contain a real MongoDB host.');
      }
    } catch {
      issues.push('MONGODB_URI is not a valid URL.');
    }
  }

  if (secret.length < 32) {
    issues.push('ENOTES_SESSION_SECRET must contain at least 32 characters.');
  }
  if (/replace-with-|example|change-me|your-secret/i.test(secret)) {
    issues.push('ENOTES_SESSION_SECRET still looks like an example value.');
  }

  const dbName = typeof env.MONGODB_DB === 'string' ? env.MONGODB_DB.trim() : '';
  if (dbName && !/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    issues.push('MONGODB_DB may contain only letters, numbers, underscores, and hyphens.');
  }

  return issues;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const issues = validateReleaseEnvironment();
  if (issues.length) {
    console.error('Release environment check failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log('Release environment format check passed. This does not test live database connectivity.');
  }
}
