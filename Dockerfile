FROM node:22-slim

# Install pnpm via npm for better compatibility
RUN npm install -g pnpm

WORKDIR /app

# Switch to non-root user 'node' (UID 1000)
USER node

# Expose port
EXPOSE 3000

# Start command
CMD ["pnpm", "run", "dev"]
