# Publishing @airdgroup/mcp-server to npm

## Prerequisites

1. **npm account:** Create one at https://www.npmjs.com/signup
2. **npm login:** Run `npm login` and enter credentials
3. **Organization (optional):** Create `@clawtown` org on npm or use your personal scope

## Before First Publish

### 1. Update package.json

Replace placeholders in `package.json`:

```json
{
  "name": "@airdgroup/mcp-server",  // Or "@YOUR_ORG/clawtown-mcp" if org not available
  "repository": {
    "url": "https://github.com/airdgroup/clawtown.git"
  }
}
```

### 2. Test Locally

```bash
cd packages/mcp-server

# Test the package works
npm pack

# This creates @clawtown-mcp-server-1.0.0.tgz
# You can test it with:
# npm install -g ./clawtown-mcp-server-1.0.0.tgz
# MCP_CLAWTOWN_JOIN_TOKEN="..." npx @airdgroup/mcp-server
```

### 3. Verify README

Ensure `README.md` has:
- [x] Correct GitHub links
- [x] Working examples
- [x] Clear installation instructions
- [x] License

## Publishing

### First Time (v1.0.0)

```bash
cd packages/mcp-server

# Login to npm (if not already)
npm login

# Publish (public package)
npm publish --access public
```

If `@clawtown` org doesn't exist or you don't own it:
```bash
# Use a different scope or no scope
npm publish @yourname/clawtown-mcp --access public
# OR
npm publish clawtown-mcp --access public
```

### Subsequent Releases

1. Update version in `package.json`:
   ```json
   {
     "version": "1.0.1"  // Increment: 1.0.0 → 1.0.1 (patch)
   }
   ```

2. Commit version bump:
   ```bash
   git add package.json
   git commit -m "chore(mcp): bump version to 1.0.1"
   ```

3. Publish:
   ```bash
   npm publish --access public
   ```

4. Tag release:
   ```bash
   git tag mcp-v1.0.1
   git push origin mcp-v1.0.1
   ```

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):

- **Patch (1.0.x):** Bug fixes, documentation updates
- **Minor (1.x.0):** New tools/resources, backwards-compatible features
- **Major (x.0.0):** Breaking changes to tool signatures or resource URIs

## Post-Publish Checklist

- [ ] Verify package appears on npm: https://www.npmjs.com/package/@airdgroup/mcp-server
- [ ] Test installation: `npx @airdgroup/mcp-server`
- [ ] Update main README with correct npm install command
- [ ] Announce in Discord: https://discord.gg/W8PMu6p4
- [ ] Tweet about it (optional)

## Troubleshooting

### "Package name not available"

If `@airdgroup/mcp-server` is taken, use:
- `@YOURNAME/clawtown-mcp`
- `clawtown-mcp` (no scope)

Update README examples accordingly.

### "Need to login"

```bash
npm login
# Enter username, password, email
```

### "403 Forbidden"

You don't have access to publish under `@clawtown`. Options:
1. Create `@clawtown` org on npm and add yourself
2. Use your personal scope: `@yourname/clawtown-mcp`
3. Use no scope: `clawtown-mcp`

## CI/CD (Future)

Once the repo is public, set up GitHub Actions to auto-publish on tag:

```yaml
name: Publish MCP Server

on:
  push:
    tags:
      - 'mcp-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: cd packages/mcp-server && npm install
      - run: cd packages/mcp-server && npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Store `NPM_TOKEN` in GitHub repo secrets.
