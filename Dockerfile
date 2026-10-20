# Pinned to the same Node and pnpm versions as .nvmrc and package.json (packageManager).
FROM node:22.22.0-slim

# pnpm is pinned, so the image does not change when the registry publishes a new release.
RUN npm install -g pnpm@10.34.7

WORKDIR /app

# Switch to non-root user 'node' (UID 1000)
USER node

# Expose port
EXPOSE 3000

# Start command
CMD ["pnpm", "run", "dev"]
